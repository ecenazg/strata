#!/usr/bin/env python3
"""
prepare_tracks.py — batch feature extraction for Strata demo tracks.

Reads frontend/public/tracks.json, runs the Demucs + librosa pipeline for any
track that is marked "prepared": false (or a specific subset you name), writes
the output features JSON to features/<id>.json, then updates tracks.json to
set "prepared": true so the frontend shows the track in the picker.

Usage
-----
  # Process ALL tracks that still need extraction
  python prepare_tracks.py

  # Process specific tracks by ID
  python prepare_tracks.py --tracks hip-hop-heartless psychedelic-dracula

  # Force re-extraction even if the features file already exists
  python prepare_tracks.py --force

  # Dry-run — show what would be extracted without doing anything
  python prepare_tracks.py --dry-run

Requirements (install once in your local venv)
-----------------------------------------------
  pip install demucs librosa click
"""
from __future__ import annotations

import json
import logging
import sys
from pathlib import Path

import click

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-7s %(name)s — %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("strata.prepare")

PROJECT_ROOT = Path(__file__).resolve().parent
TRACKS_JSON  = PROJECT_ROOT / "frontend" / "public" / "tracks.json"
FEATURES_DIR = PROJECT_ROOT / "features"


@click.command()
@click.argument("tracks", nargs=-1, metavar="[TRACK_ID...]")
@click.option("--force", is_flag=True, help="Re-extract even if features file already exists.")
@click.option("--dry-run", is_flag=True, help="Print what would happen without doing anything.")
def main(tracks: tuple[str, ...], force: bool, dry_run: bool) -> None:
    if not TRACKS_JSON.exists():
        log.error("tracks.json not found at %s", TRACKS_JSON)
        sys.exit(1)

    manifest = json.loads(TRACKS_JSON.read_text())
    all_tracks = manifest.get("tracks", [])

    # Determine which tracks to process
    if tracks:
        to_process = [t for t in all_tracks if t.get("id") in tracks]
        unknown = set(tracks) - {t["id"] for t in to_process}
        if unknown:
            log.warning("Unknown track IDs (not in tracks.json): %s", ", ".join(unknown))
    else:
        to_process = [t for t in all_tracks if not t.get("prepared", True)]

    if not to_process:
        log.info("Nothing to do — all specified tracks are already prepared.")
        return

    log.info("Tracks to extract: %s", ", ".join(t["id"] for t in to_process))

    changed = False
    for track in to_process:
        track_id     = track["id"]
        # Prefer sourceAudioUrl (full mix); fall back to audioUrl
        audio_rel    = track.get("sourceAudioUrl") or track.get("audioUrl", "")
        # Strip leading / and resolve relative to project root
        audio_rel    = audio_rel.lstrip("/")
        audio_path   = PROJECT_ROOT / "frontend" / "public" / audio_rel
        features_out = FEATURES_DIR / f"{track_id}.json"

        log.info("─── %s (%s)", track_id, track.get("title", ""))

        if not audio_path.exists():
            # Also check at project root (user might have the mp3 there)
            root_mp3 = PROJECT_ROOT / audio_path.name
            if root_mp3.exists():
                audio_path = root_mp3
                log.info("  Found audio at project root: %s", audio_path.name)
            else:
                log.error("  Audio file not found: %s — skipping", audio_path)
                log.error("  Also checked: %s", root_mp3)
                continue

        if features_out.exists() and not force:
            log.info("  Features already exist at %s — skipping (use --force to re-extract)", features_out)
            # Mark prepared in case it wasn't set
            track["prepared"] = True
            changed = True
            continue

        if dry_run:
            log.info("  [DRY RUN] Would extract: %s → %s", audio_path, features_out)
            continue

        # ── Run the pipeline ──────────────────────────────────────────────
        log.info("  Audio:    %s", audio_path)
        log.info("  Output:   %s", features_out)

        try:
            _run_extraction(audio_path, features_out, track_id)
        except Exception as exc:
            log.error("  Extraction failed for %s: %s", track_id, exc)
            continue

        # Mark track as prepared in the manifest
        track["prepared"] = True
        # Point featuresFile to the relative path the frontend expects
        track["featuresFile"] = f"features/{track_id}.json"
        changed = True
        log.info("  ✓ Done")

    if changed and not dry_run:
        TRACKS_JSON.write_text(json.dumps(manifest, indent=2) + "\n")
        log.info("Updated %s", TRACKS_JSON)

    log.info("Finished.")


def _run_extraction(audio_path: Path, features_out: Path, track_id: str) -> None:
    """Run Demucs separation + librosa feature extraction for one track."""
    # Import here so the script gives a clear error if dependencies are missing
    try:
        from separation.demucs_runner import separate
    except ImportError:
        raise RuntimeError(
            "Could not import separation.demucs_runner.\n"
            "Make sure you're running from the project root and demucs is installed:\n"
            "  pip install demucs"
        )
    try:
        from analysis.feature_extractor import extract
    except ImportError:
        raise RuntimeError(
            "Could not import analysis.feature_extractor.\n"
            "Make sure librosa is installed:\n"
            "  pip install librosa"
        )

    import config

    log.info("  Stage 1/2: Source separation (Demucs htdemucs)...")
    stem_paths = separate(audio_path, force=False)

    log.info("  Stage 2/2: Feature extraction (librosa @ %d Hz, hop=%d)...",
             config.TARGET_SR, config.HOP_LENGTH)
    timeline = extract(audio_path, stem_paths)

    features_out.parent.mkdir(parents=True, exist_ok=True)
    timeline.save(features_out)
    log.info("  Saved %d frames (%.1f fps, %.1fs) → %s",
             len(timeline.frames), timeline.fps, timeline.duration, features_out)


if __name__ == "__main__":
    main()
