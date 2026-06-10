"""
pipeline.py — CLI entry point for the Strata backend.

Stages (run in order unless flags skip them):
  1. Source separation  (Demucs v4 htdemucs)
  2. Feature extraction (librosa)
  3. Evaluation metrics (mir_eval) — optional
  4. WebSocket server   (asyncio + websockets)

Usage examples
--------------
  # Full pipeline
  python pipeline.py --audio hp_excerpt.wav

  # Skip separation (use cached stems)
  python pipeline.py --audio hp_excerpt.wav --skip-separation

  # Only run metrics, no server
  python pipeline.py --audio hp_excerpt.wav --eval-only

  # Custom port
  python pipeline.py --audio hp_excerpt.wav --port 9000

  # Force re-separation even if cache exists
  python pipeline.py --audio hp_excerpt.wav --force-separation

  # Export .mp4 instead of live server
  python pipeline.py --audio hp_excerpt.wav --export-mp4 output.mp4
"""

from __future__ import annotations
import asyncio
import json
import logging
import sys
from pathlib import Path

import click

import config
from separation.demucs_runner import separate
from analysis.feature_extractor import extract
from analysis.features import FeatureTimeline
from evaluation.metrics import evaluate


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-7s %(name)s — %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("strata.pipeline")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

@click.command()
@click.option("--audio",            required=False, type=click.Path(exists=True), help="Path to input .wav/.mp3 file")
@click.option("--port",             default=config.WS_PORT, show_default=True,    help="WebSocket port")
@click.option("--skip-separation",  is_flag=True,   help="Use cached stems, skip Demucs")
@click.option("--force-separation", is_flag=True,   help="Re-run Demucs even if cache exists")
@click.option("--skip-extraction",  is_flag=True,   help="Use cached features.json, skip librosa analysis")
@click.option("--eval-only",        is_flag=True,   help="Run evaluation metrics only, no server")
@click.option("--with-eval",        is_flag=True,   help="Run evaluation metrics before starting server")
@click.option("--prepare-only",     is_flag=True,   help="Prepare stems/features and exit without starting the server")
@click.option("--export-mp4",       default=None,   type=click.Path(),            help="Export .mp4 instead of live server")
@click.option("--features-file",    default=None,   type=click.Path(),            help="Override path for features.json")
@click.option("--track-manifest",   default=None,   type=click.Path(exists=True), help="Load prepared tracks from a JSON manifest")
@click.option("--vis-url",          default="http://localhost:5173", show_default=True, help="Three.js visualiser URL (for --export-mp4)")
def main(
    audio: str,
    port: int,
    skip_separation: bool,
    force_separation: bool,
    skip_extraction: bool,
    eval_only: bool,
    with_eval: bool,
    prepare_only: bool,
    export_mp4: str | None,
    features_file: str | None,
    track_manifest: str | None,
    vis_url: str,
) -> None:
    if track_manifest:
        tracks, default_track_id = _load_track_manifest(Path(track_manifest).resolve())
        timeline = tracks[default_track_id]["timeline"]
        _print_track_manifest_banner(Path(track_manifest).resolve(), tracks, default_track_id)
        _print_server_info(port, timeline)
        if export_mp4:
            asyncio.run(_run_export(timeline, output_path=Path(export_mp4),
                                    vis_url=vis_url, ws_port=port))
        else:
            asyncio.run(_run_server(
                timeline,
                port=port,
                tracks=tracks,
                default_track_id=default_track_id,
            ))
        return

    if not audio:
        raise click.UsageError("--audio is required unless --track-manifest is provided.")

    audio_path = Path(audio).resolve()
    features_path = Path(features_file) if features_file else config.FEATURES_FILE

    _print_banner(audio_path)

    # ------------------------------------------------------------------ #
    # Stage 1: Source separation
    # ------------------------------------------------------------------ #
    if skip_extraction and features_path.exists():
        log.info("Skipping separation (--skip-extraction, loading existing features)")
        stem_paths = None  # not needed if we load features directly
    else:
        stem_paths = separate(audio_path, force=force_separation)

    # ------------------------------------------------------------------ #
    # Stage 2: Feature extraction
    # ------------------------------------------------------------------ #
    if skip_extraction and features_path.exists():
        log.info("Loading existing features from %s", features_path)
        timeline = FeatureTimeline.load(features_path)
        log.info("Loaded %d frames (%.1f fps, %.1fs)",
                 len(timeline.frames), timeline.fps, timeline.duration)
    else:
        if stem_paths is None:
            # stem_paths might be None if we skipped extraction but file not found
            stem_paths = separate(audio_path, force=force_separation)
        log.info("Running feature extraction ...")
        timeline = extract(audio_path, stem_paths)
        features_path.parent.mkdir(parents=True, exist_ok=True)
        timeline.save(features_path)

    # ------------------------------------------------------------------ #
    # Stage 3: Evaluation (optional)
    # ------------------------------------------------------------------ #
    if eval_only or with_eval:
        if stem_paths is None:
            stem_paths = separate(audio_path, force=False)
        log.info("Running evaluation metrics ...")
        evaluate(audio_path, stem_paths)
        if eval_only:
            log.info("--eval-only: done.")
            return

    if prepare_only:
        log.info("--prepare-only: features ready at %s", features_path)
        return

    # ------------------------------------------------------------------ #
    # Stage 4: Server or export
    # ------------------------------------------------------------------ #
    if export_mp4:
        asyncio.run(_run_export(timeline, output_path=Path(export_mp4),
                                vis_url=vis_url, ws_port=port))
    else:
        _print_server_info(port, timeline)
        asyncio.run(_run_server(timeline, port=port))


# ---------------------------------------------------------------------------
# Async runners
# ---------------------------------------------------------------------------

async def _run_server(
    timeline: FeatureTimeline,
    port: int,
    tracks: dict | None = None,
    default_track_id: str | None = None,
) -> None:
    from server.ws_server import serve
    await serve(
        timeline,
        host=config.WS_HOST,
        port=port,
        tracks=tracks,
        default_track_id=default_track_id,
    )


async def _run_export(
    timeline: FeatureTimeline,
    output_path: Path,
    vis_url: str,
    ws_port: int,
) -> None:
    from export.mp4_export import export_mp4 as do_export
    # Run server and exporter concurrently
    server_task = asyncio.create_task(
        _run_server(timeline, port=ws_port)
    )
    ws_url = f"ws://{config.WS_HOST}:{ws_port}"
    try:
        await do_export(output_path=output_path, vis_url=vis_url, ws_url=ws_url)
    finally:
        server_task.cancel()
        try:
            await server_task
        except asyncio.CancelledError:
            pass


def _load_track_manifest(manifest_path: Path) -> tuple[dict, str]:
    with open(manifest_path) as fh:
        manifest = json.load(fh)

    raw_tracks = manifest.get("tracks", [])
    if not raw_tracks:
        raise click.UsageError(f"No tracks found in manifest: {manifest_path}")

    tracks = {}
    for item in raw_tracks:
        if not item.get("prepared", True):
            continue
        track_id = item.get("id")
        features_file = item.get("featuresFile")
        if not track_id or not features_file:
            raise click.UsageError("Each prepared track needs 'id' and 'featuresFile'.")

        features_path = Path(features_file)
        if not features_path.is_absolute():
            features_path = config.PROJECT_ROOT / features_path
        if not features_path.exists():
            raise click.UsageError(
                f"Features file for track '{track_id}' not found: {features_path}"
            )

        meta = {
            key: value
            for key, value in item.items()
            if key not in {"featuresFile"}
        }
        tracks[track_id] = {
            "timeline": FeatureTimeline.load(features_path),
            "meta": meta,
        }

    if not tracks:
        raise click.UsageError(f"No prepared tracks available in manifest: {manifest_path}")

    default_track_id = manifest.get("defaultTrackId") or next(iter(tracks))
    if default_track_id not in tracks:
        default_track_id = next(iter(tracks))

    return tracks, default_track_id


# ---------------------------------------------------------------------------
# Pretty printing
# ---------------------------------------------------------------------------

def _print_banner(audio_path: Path) -> None:
    print()
    print("  ╔══════════════════════════════════════╗")
    print("  ║   S T R A T A  —  Python Backend     ║")
    print("  ║   Source-Separation Music Visualiser ║")
    print("  ╚══════════════════════════════════════╝")
    print(f"  Audio: {audio_path.name}")
    print()


def _print_track_manifest_banner(
    manifest_path: Path,
    tracks: dict,
    default_track_id: str,
) -> None:
    print()
    print("  ╔══════════════════════════════════════╗")
    print("  ║   S T R A T A  —  Track Library      ║")
    print("  ║   Prepared source-separation tracks  ║")
    print("  ╚══════════════════════════════════════╝")
    print(f"  Manifest: {manifest_path}")
    print(f"  Tracks:   {len(tracks)}")
    print(f"  Default:  {default_track_id}")
    print()


def _print_server_info(port: int, timeline: FeatureTimeline) -> None:
    print()
    print(f"  WebSocket server:  ws://{config.WS_HOST}:{port}")
    print(f"  Duration:          {timeline.duration:.1f}s")
    print(f"  Frame rate:        {timeline.fps:.1f} fps")
    print(f"  Total frames:      {len(timeline.frames)}")
    print(f"  Stems:             {', '.join(timeline.stems)}")
    print()
    print("  Open the Three.js visualiser in your browser, then press")
    print("  play — the browser will connect automatically.")
    print()
    print("  Ctrl+C to stop.")
    print()


# ---------------------------------------------------------------------------

if __name__ == "__main__":
    main()
