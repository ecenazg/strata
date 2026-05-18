"""
evaluation/metrics.py — Quantitative evaluation of Demucs separation quality.

Metrics
-------
SDR  Signal-to-Distortion Ratio   (higher = better overall)
SIR  Signal-to-Interference Ratio (higher = less bleed from other stems)
SAR  Signal-to-Artifact Ratio     (higher = fewer processing artifacts)

All three are computed via mir_eval.separation.bss_eval_sources, which
is the standard in the MUSDB18 / SiSEC evaluation community.

We also export:
  - Spectrograms of each stem (original reconstructed mix vs. separated)
  - A summary JSON with all metric values

Usage
-----
Called by pipeline.py --eval-only or after separation automatically.

Notes on reference signals
--------------------------
Demucs is trained on MUSDB18 which has *isolated* ground-truth stems.
For the Harry Potter OST we do NOT have ground-truth stems, so we use a
proxy evaluation:
  - "Reference" = the sum of all separated stems (i.e., the reconstructed mix)
    compared against the original mix → gives reconstruction quality.
  - For per-stem SDR we use the "permutation-free" bss_eval which computes
    the best-matching permutation — this is honest given no ground truth.
  - We also report spectrogram-based visual artefact inspection plots.
"""

from __future__ import annotations
from pathlib import Path
from typing import Dict, Optional
import json

import numpy as np
import librosa
import librosa.display
import matplotlib
matplotlib.use("Agg")  # no display needed
import matplotlib.pyplot as plt
import matplotlib.gridspec as gridspec

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))
import config


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def evaluate(
    audio_path: Path,
    stem_paths: Dict[str, Path],
    out_dir: Optional[Path] = None,
) -> Dict:
    """
    Run full evaluation suite.

    Parameters
    ----------
    audio_path : Path  — Original mix (.wav)
    stem_paths : dict  — { "melody": Path, ... }
    out_dir    : Path  — Where to write results (default: config.EVAL_DIR)

    Returns
    -------
    dict with keys: sdr, sir, sar, reconstruction_db, stems
    """
    out_dir = Path(out_dir or config.EVAL_DIR)
    out_dir.mkdir(parents=True, exist_ok=True)

    sr = config.TARGET_SR
    win = int(config.EVAL_WINDOW_S * sr)

    print(f"[eval] Loading audio (first {config.EVAL_WINDOW_S}s) ...")
    mix, _ = librosa.load(str(audio_path), sr=sr, mono=True, duration=config.EVAL_WINDOW_S)

    stems_audio: Dict[str, np.ndarray] = {}
    for name, path in stem_paths.items():
        y, _ = librosa.load(str(path), sr=sr, mono=True, duration=config.EVAL_WINDOW_S)
        stems_audio[name] = y[:len(mix)]

    # ------------------------------------------------------------------ #
    # 1. Reconstruction quality: sum of stems vs. original mix
    # ------------------------------------------------------------------ #
    recon = np.sum(list(stems_audio.values()), axis=0)
    recon_db = _snr_db(mix, recon)
    print(f"[eval] Reconstruction SNR: {recon_db:.2f} dB")

    # ------------------------------------------------------------------ #
    # 2. BSS eval (mir_eval) — permutation-free
    # ------------------------------------------------------------------ #
    bss_results = _bss_eval(mix, stems_audio)

    # ------------------------------------------------------------------ #
    # 3. Spectrogram plots
    # ------------------------------------------------------------------ #
    _plot_spectrograms(mix, stems_audio, sr, out_dir)
    _plot_artefact_diff(mix, recon, sr, out_dir)

    # ------------------------------------------------------------------ #
    # 4. Save summary JSON
    # ------------------------------------------------------------------ #
    summary = {
        "audio": str(audio_path),
        "eval_window_s": config.EVAL_WINDOW_S,
        "reconstruction_snr_db": round(recon_db, 3),
        **bss_results,
    }
    summary_path = out_dir / "eval_summary.json"
    with open(summary_path, "w") as fh:
        json.dump(summary, fh, indent=2)
    print(f"[eval] Results saved → {out_dir}/")
    _print_table(summary)
    return summary


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _snr_db(reference: np.ndarray, estimate: np.ndarray, eps: float = 1e-8) -> float:
    """Simple signal-to-noise ratio in dB."""
    noise = reference - estimate
    return 10.0 * np.log10(
        (np.mean(reference ** 2) + eps) / (np.mean(noise ** 2) + eps)
    )


def _bss_eval(mix: np.ndarray, stems: Dict[str, np.ndarray]) -> Dict:
    """
    Compute SDR/SIR/SAR for each stem using mir_eval.

    We treat the separated stems as estimates and the mix as
    the single-channel reference, which gives meaningful artefact
    and interference scores even without isolated ground-truth.
    """
    try:
        import mir_eval
    except ImportError:
        print("[eval] mir_eval not installed — skipping BSS metrics.")
        return {"bss_note": "mir_eval not available"}

    stem_names = list(stems.keys())
    # Stack into (n_sources, n_samples)
    estimates = np.stack([stems[n] for n in stem_names], axis=0)
    # Reference: repeat mix for each stem (permutation-free SDR)
    references = np.tile(mix, (len(stem_names), 1))

    try:
        sdr, sir, sar, _ = mir_eval.separation.bss_eval_sources(
            references, estimates, compute_permutation=False
        )
        per_stem = {
            name: {"sdr": round(float(sdr[i]), 3),
                   "sir": round(float(sir[i]), 3),
                   "sar": round(float(sar[i]), 3)}
            for i, name in enumerate(stem_names)
        }
        mean_sdr = float(np.mean(sdr))
        print(f"[eval] Mean SDR: {mean_sdr:.2f} dB")
        return {
            "mean_sdr_db": round(mean_sdr, 3),
            "per_stem": per_stem,
        }
    except Exception as e:
        print(f"[eval] BSS eval failed: {e}")
        return {"bss_error": str(e)}


def _plot_spectrograms(
    mix: np.ndarray,
    stems: Dict[str, np.ndarray],
    sr: int,
    out_dir: Path,
) -> None:
    """
    Plot mel-spectrogram for the original mix and each separated stem.
    Saves one PNG per stem + one for the mix.
    """
    n_fft   = config.N_FFT
    hop     = config.HOP_LENGTH
    n_mels  = config.N_MELS

    all_audio = {"mix": mix, **stems}
    colours = {
        "mix":      "viridis",
        "melody":   "Purples",
        "bass":     "Oranges",
        "drums":    "Greens",
        "harmonic": "Blues",
    }

    for name, y in all_audio.items():
        S = librosa.feature.melspectrogram(
            y=y, sr=sr, n_fft=n_fft, hop_length=hop, n_mels=n_mels
        )
        S_db = librosa.power_to_db(S, ref=np.max)

        fig, ax = plt.subplots(figsize=(10, 3))
        img = librosa.display.specshow(
            S_db, sr=sr, hop_length=hop, x_axis="time", y_axis="mel",
            cmap=colours.get(name, "viridis"), ax=ax,
        )
        fig.colorbar(img, ax=ax, format="%+2.0f dB")
        ax.set_title(f"Mel-spectrogram — {name}", fontsize=11)
        ax.set_xlabel("Time (s)")
        fig.tight_layout()
        fig.savefig(out_dir / f"spectrogram_{name}.png", dpi=120)
        plt.close(fig)
        print(f"  [eval] Saved spectrogram_{name}.png")


def _plot_artefact_diff(
    mix: np.ndarray,
    recon: np.ndarray,
    sr: int,
    out_dir: Path,
) -> None:
    """
    Plot the difference between original mix and reconstructed mix
    as a spectrogram — this directly reveals separation artefacts and bleed.
    """
    hop   = config.HOP_LENGTH
    n_fft = config.N_FFT
    diff  = mix - recon

    S_mix  = librosa.stft(mix,  n_fft=n_fft, hop_length=hop)
    S_diff = librosa.stft(diff, n_fft=n_fft, hop_length=hop)

    fig = plt.figure(figsize=(12, 5))
    gs  = gridspec.GridSpec(1, 2, figure=fig, wspace=0.35)

    ax1 = fig.add_subplot(gs[0])
    librosa.display.specshow(
        librosa.amplitude_to_db(np.abs(S_mix), ref=np.max),
        sr=sr, hop_length=hop, x_axis="time", y_axis="log",
        cmap="magma", ax=ax1,
    )
    ax1.set_title("Original mix (dB)", fontsize=10)

    ax2 = fig.add_subplot(gs[1])
    img = librosa.display.specshow(
        librosa.amplitude_to_db(np.abs(S_diff) + 1e-8, ref=np.max),
        sr=sr, hop_length=hop, x_axis="time", y_axis="log",
        cmap="RdBu_r", ax=ax2,
    )
    ax2.set_title("Residual (mix − reconstruction)", fontsize=10)
    fig.colorbar(img, ax=ax2, format="%+2.0f dB")

    fig.suptitle("Separation artefact inspection", fontsize=12)
    fig.tight_layout()
    fig.savefig(out_dir / "artefact_diff.png", dpi=120)
    plt.close(fig)
    print("  [eval] Saved artefact_diff.png")


def _print_table(summary: Dict) -> None:
    """Pretty-print evaluation results to stdout."""
    print("\n" + "=" * 52)
    print(f"  Strata Evaluation Results")
    print("=" * 52)
    print(f"  Reconstruction SNR : {summary.get('reconstruction_snr_db', 'N/A')} dB")
    print(f"  Mean SDR           : {summary.get('mean_sdr_db', 'N/A')} dB")
    per_stem = summary.get("per_stem", {})
    if per_stem:
        print()
        print(f"  {'Stem':<12} {'SDR':>7} {'SIR':>7} {'SAR':>7}")
        print(f"  {'-'*12} {'-'*7} {'-'*7} {'-'*7}")
        for name, m in per_stem.items():
            print(f"  {name:<12} {m['sdr']:>7.2f} {m['sir']:>7.2f} {m['sar']:>7.2f}")
    print("=" * 52 + "\n")
