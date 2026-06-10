#!/usr/bin/env python3
"""
quick_extract.py — Fast feature extraction using librosa HPSS (no Demucs needed).

Uses harmonic-percussive source separation to approximate the 4-stem split.
Runs in ~30-60 s per track on CPU. Output format is identical to the full
pipeline, so the frontend works exactly the same way.

Usage
-----
  # Extract specific tracks by ID
  python3 quick_extract.py hip-hop-heartless psychedelic-dracula

  # Extract ALL tracks marked prepared=false in tracks.json
  python3 quick_extract.py --all

  # Force re-extraction even if features file already exists
  python3 quick_extract.py --force hip-hop-heartless
"""
from __future__ import annotations

import json
import logging
import sys
import time
from pathlib import Path

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-7s %(name)s — %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("strata.quick")

PROJECT_ROOT = Path(__file__).resolve().parent
TRACKS_JSON  = PROJECT_ROOT / "frontend" / "public" / "tracks.json"
FEATURES_DIR = PROJECT_ROOT / "features"
TARGET_SR    = 22050
TARGET_FPS   = 60
HOP_LENGTH   = TARGET_SR // TARGET_FPS   # ~368


def main() -> None:
    args = sys.argv[1:]
    force = "--force" in args
    all_tracks = "--all" in args
    track_ids = [a for a in args if not a.startswith("--")]

    if not TRACKS_JSON.exists():
        log.error("tracks.json not found at %s", TRACKS_JSON)
        sys.exit(1)

    manifest = json.loads(TRACKS_JSON.read_text())
    all_manifest_tracks = manifest.get("tracks", [])

    if all_tracks:
        to_process = [t for t in all_manifest_tracks if not t.get("prepared", True)]
    elif track_ids:
        to_process = [t for t in all_manifest_tracks if t.get("id") in track_ids]
        unknown = set(track_ids) - {t["id"] for t in to_process}
        if unknown:
            log.warning("Unknown track IDs: %s", ", ".join(unknown))
    else:
        log.error("Specify track IDs or --all. Example:\n  python3 quick_extract.py hip-hop-heartless psychedelic-dracula")
        sys.exit(1)

    if not to_process:
        log.info("Nothing to extract.")
        return

    try:
        import librosa
        import numpy as np
    except ImportError:
        log.error("librosa not installed. Run:  pip3 install librosa")
        sys.exit(1)

    changed = False
    for track in to_process:
        track_id = track["id"]
        audio_rel = (track.get("sourceAudioUrl") or track.get("audioUrl", "")).lstrip("/")
        audio_path = PROJECT_ROOT / "frontend" / "public" / audio_rel
        if not audio_path.exists():
            root_mp3 = PROJECT_ROOT / audio_path.name
            if root_mp3.exists():
                audio_path = root_mp3
            else:
                log.error("Audio not found: %s — skipping %s", audio_path, track_id)
                continue

        features_out = FEATURES_DIR / f"{track_id}.json"
        if features_out.exists() and not force:
            log.info("[%s] Features already exist — skipping (use --force to re-extract)", track_id)
            track["prepared"] = True
            track["featuresFile"] = f"features/{track_id}.json"
            changed = True
            continue

        log.info("[%s] Extracting from %s …", track_id, audio_path.name)
        t0 = time.perf_counter()

        try:
            timeline_dict = extract_hpss(audio_path, track_id, librosa, np)
        except Exception as exc:
            log.error("[%s] Failed: %s", track_id, exc)
            continue

        features_out.parent.mkdir(parents=True, exist_ok=True)
        with open(features_out, "w") as fh:
            json.dump(timeline_dict, fh, separators=(",", ":"))

        elapsed = time.perf_counter() - t0
        n_frames = len(timeline_dict["frames"])
        log.info("[%s] Done — %d frames @ %.0f fps, %.1f s audio, took %.1f s",
                 track_id, n_frames, timeline_dict["fps"],
                 timeline_dict["duration"], elapsed)

        track["prepared"] = True
        track["featuresFile"] = f"features/{track_id}.json"
        changed = True

    if changed:
        TRACKS_JSON.write_text(json.dumps(manifest, indent=2) + "\n")
        log.info("Updated %s", TRACKS_JSON)

    log.info("Done.")


# ──────────────────────────────────────────────────────────────────────────────

def extract_hpss(audio_path: Path, track_id: str, librosa, np) -> dict:
    """
    Load audio, split with HPSS, derive 4 pseudo-stems, extract features.

    Stem mapping
    ─────────────
    bass     ← low-frequency content of the harmonic layer (<250 Hz)
    melody   ← full harmonic layer (preserves pitch / chroma)
    drums    ← percussive layer (onset/transient content)
    harmonic ← combined harmonic (for cloud / harmony visualiser)
    """
    sr = TARGET_SR
    hop = HOP_LENGTH

    log.info("  Loading audio …")
    y, _ = librosa.load(str(audio_path), sr=sr, mono=True)
    duration = len(y) / sr

    log.info("  HPSS separation …")
    y_harm, y_perc = librosa.effects.hpss(y, margin=3.0)

    # Bass: keep spectral content below 250 Hz from the harmonic layer
    # We approximate by weighting the RMS of the low-frequency portion
    # using a simple stft-based low-pass mask.
    log.info("  Computing bass layer …")
    D = librosa.stft(y_harm, n_fft=2048, hop_length=hop)
    freqs = librosa.fft_frequencies(sr=sr, n_fft=2048)
    bass_mask = (freqs < 250).astype(float)[:, None]
    D_bass = D * bass_mask
    y_bass_approx = None  # not needed beyond RMS

    # Pre-compute shared analysis on full mix
    log.info("  Computing shared features …")
    onset_env = librosa.onset.onset_strength(y=y, sr=sr, hop_length=hop, n_mels=128)
    _, beat_frames = librosa.beat.beat_track(onset_envelope=onset_env, sr=sr,
                                              hop_length=hop, start_bpm=120.0, tightness=100)
    beat_set = set(beat_frames.tolist())

    # ── per-stem feature computation ──────────────────────────────────────

    def stem_features(y_stem, label: str) -> dict:
        """Extract StemFeatures dict for one audio signal."""
        n_fft = 2048

        rms_f   = librosa.feature.rms(y=y_stem, frame_length=n_fft, hop_length=hop)[0]
        onset_f = librosa.onset.onset_strength(y=y_stem, sr=sr, hop_length=hop, n_mels=64)
        cent_f  = librosa.feature.spectral_centroid(y=y_stem, sr=sr, n_fft=n_fft, hop_length=hop)[0]
        chroma  = librosa.feature.chroma_cqt(y=y_stem, sr=sr, hop_length=hop, bins_per_octave=36)

        n = min(len(rms_f), len(onset_f), len(cent_f), chroma.shape[1])

        rms_max   = float(np.percentile(rms_f[:n], 99)) or 1e-6
        onset_max = float(onset_f[:n].max()) or 1e-6

        result = []
        for i in range(n):
            cr  = chroma[:, i].astype(float)
            cs  = cr.sum()
            ch  = (cr / cs).tolist() if cs > 1e-8 else [0.0] * 12
            result.append({
                "rms":                round(float(np.clip(rms_f[i] / rms_max, 0, 1)), 4),
                "onset":              round(float(np.clip(onset_f[i] / onset_max, 0, 1)), 4),
                "spectral_centroid":  round(float(cent_f[i]), 1),
                "chroma":             [round(v, 4) for v in ch],
                "pitch_hz":           float(60 + int(np.argmax(cr))),  # MIDI-like via chroma peak
                "beat_phase":         1.0 if i in beat_set else 0.0,
            })
        return result, n

    log.info("  Extracting melody features …")
    melody_frames, n_frames = stem_features(y_harm, "melody")

    log.info("  Extracting drums features …")
    drums_frames, _ = stem_features(y_perc, "drums")

    # Bass: derive from the low-pass masked STFT magnitudes + harmonic signal
    log.info("  Extracting bass features …")
    y_bass = librosa.griffinlim(np.abs(D_bass), hop_length=hop, n_fft=2048)
    # griffinlim may produce a slightly different length — trim/pad
    target_len = len(y)
    if len(y_bass) > target_len:
        y_bass = y_bass[:target_len]
    elif len(y_bass) < target_len:
        y_bass = np.pad(y_bass, (0, target_len - len(y_bass)))
    bass_frames, _ = stem_features(y_bass, "bass")

    log.info("  Extracting harmonic features …")
    harm_frames, _ = stem_features(y_harm, "harmonic")

    # Align all stem frame arrays to the shortest length
    n_out = min(n_frames, len(melody_frames), len(drums_frames),
                len(bass_frames), len(harm_frames))

    frames = []
    for i in range(n_out):
        t = round(i * hop / sr, 4)
        frames.append({
            "t":         t,
            "frame_idx": i,
            "melody":    melody_frames[i],
            "bass":      bass_frames[i],
            "drums":     drums_frames[i],
            "harmonic":  harm_frames[i],
        })

    return {
        "audio_path": str(audio_path),
        "duration":   round(duration, 4),
        "sr":         sr,
        "hop_length": hop,
        "fps":        round(sr / hop, 2),
        "stems":      ["melody", "bass", "drums", "harmonic"],
        "frames":     frames,
    }


if __name__ == "__main__":
    main()
