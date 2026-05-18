"""
separation/demucs_runner.py — Run Demucs v4 (htdemucs) on an audio file.

Design decisions
----------------
* Demucs is invoked via its Python API (not subprocess) so we can capture
  progress and re-use the loaded model across calls in the same process.
* Output stems are cached under STEMS_DIR / <audio_stem_name>/ so repeated
  runs skip separation entirely.
* We validate each output file (non-zero length, loadable by soundfile)
  before declaring success.
* The function returns a dict mapping our internal stem names to file paths.
"""

from __future__ import annotations
import hashlib
import shutil
from pathlib import Path
from typing import Dict

import numpy as np
import soundfile as sf

import sys
import os
sys.path.insert(0, str(Path(__file__).parent.parent))
import config


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def separate(audio_path: Path, force: bool = False) -> Dict[str, Path]:
    """
    Separate *audio_path* into four stems using Demucs htdemucs.

    Parameters
    ----------
    audio_path : Path
        Input .wav / .mp3 / .flac file.
    force : bool
        Re-run Demucs even if cached stems exist.

    Returns
    -------
    dict mapping internal stem names → Path of separated .wav file:
        { "melody": Path(...), "bass": Path(...),
          "drums": Path(...),  "harmonic": Path(...) }
    """
    audio_path = Path(audio_path).resolve()
    if not audio_path.exists():
        raise FileNotFoundError(f"Audio file not found: {audio_path}")

    cache_dir = _cache_dir(audio_path)
    stem_paths = _expected_stem_paths(cache_dir)

    if not force and _cache_valid(stem_paths):
        print(f"[demucs] Using cached stems in {cache_dir}")
        return stem_paths

    print(f"[demucs] Separating {audio_path.name} with {config.DEMUCS_MODEL} …")
    cache_dir.mkdir(parents=True, exist_ok=True)

    _run_demucs(audio_path, cache_dir)
    _validate_stems(stem_paths)

    print("[demucs] Separation complete.")
    return stem_paths


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _cache_dir(audio_path: Path) -> Path:
    """
    Unique directory for this audio file's stems.

    We hash the first 4 MB of the file so the cache key survives file renames
    while still being fast (we don't hash a 100 MB FLAC).
    """
    h = hashlib.md5()
    with open(audio_path, "rb") as fh:
        h.update(fh.read(4 * 1024 * 1024))
    key = f"{audio_path.stem}_{h.hexdigest()[:8]}"
    return config.STEMS_DIR / key


def _expected_stem_paths(cache_dir: Path) -> Dict[str, Path]:
    """Return the paths we expect Demucs to produce for each stem."""
    return {
        internal: cache_dir / f"{demucs_name}.wav"
        for demucs_name, internal in config.STEM_MAP.items()
    }


def _cache_valid(stem_paths: Dict[str, Path]) -> bool:
    """All expected stem files exist and are non-empty."""
    return all(p.exists() and p.stat().st_size > 0 for p in stem_paths.values())


def _run_demucs(audio_path: Path, cache_dir: Path) -> None:
    """
    Call Demucs via its Python API.

    Demucs writes stems into a subdirectory structured as:
        <out_dir>/<model>/<audio_stem>/{vocals,bass,drums,other}.wav

    We move them up to cache_dir and rename to match STEM_MAP.
    """
    try:
        from demucs.apply import apply_model
        from demucs.pretrained import get_model
        from demucs.audio import AudioFile, save_audio
        import torch
    except ImportError as e:
        raise ImportError(
            "Demucs is not installed. Run: pip install demucs\n"
            "(PyTorch must be installed first: https://pytorch.org/get-started/locally/)"
        ) from e

    device = config.DEMUCS_DEVICE
    if device == "cuda" and not torch.cuda.is_available():
        print("[demucs] CUDA not available, falling back to CPU.")
        device = "cpu"

    # Load model
    model = get_model(config.DEMUCS_MODEL)
    model.to(device)
    model.eval()

    # Load audio — Demucs AudioFile handles resampling to model's sample rate
    wav = AudioFile(audio_path).read(
        streams=0,
        samplerate=model.samplerate,
        channels=model.audio_channels,
    )
    # wav shape: (channels, samples) → add batch dim
    wav = wav.unsqueeze(0).to(device)

    # Run separation
    with torch.no_grad():
        sources = apply_model(model, wav, device=device, progress=True)
    # sources shape: (batch=1, n_stems, channels, samples)
    sources = sources[0]  # → (n_stems, channels, samples)

    # Save each stem
    demucs_stem_order = model.sources  # e.g. ["drums","bass","other","vocals"]
    for i, demucs_name in enumerate(demucs_stem_order):
        internal_name = config.STEM_MAP.get(demucs_name)
        if internal_name is None:
            continue  # skip unexpected stems
        out_path = cache_dir / f"{demucs_name}.wav"
        save_audio(sources[i].cpu(), str(out_path), samplerate=model.samplerate)
        print(f"  [demucs] Saved {demucs_name} → {out_path.name}")


def _validate_stems(stem_paths: Dict[str, Path]) -> None:
    """Load each stem briefly to confirm it's a valid audio file."""
    for name, path in stem_paths.items():
        if not path.exists():
            raise RuntimeError(
                f"Demucs did not produce stem '{name}' at {path}. "
                "Check Demucs output above for errors."
            )
        try:
            info = sf.info(str(path))
            if info.frames == 0:
                raise RuntimeError(f"Stem '{name}' is empty: {path}")
        except Exception as e:
            raise RuntimeError(f"Could not validate stem '{name}': {e}") from e
        print(f"  [demucs] Validated {name}: {info.duration:.1f}s @ {info.samplerate} Hz")
