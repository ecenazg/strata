"""
config.py — Central configuration for the Strata backend.

All tuneable constants live here so nothing is scattered across modules.
"""

from pathlib import Path

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

PROJECT_ROOT   = Path(__file__).parent
STEMS_DIR      = PROJECT_ROOT / "stems"          # Demucs output cache
FEATURES_FILE  = PROJECT_ROOT / "features.json"  # Serialised feature timeline
EVAL_DIR       = PROJECT_ROOT / "eval"           # SDR/SIR/SAR results + spectrograms

# ---------------------------------------------------------------------------
# Audio / analysis
# ---------------------------------------------------------------------------

TARGET_SR     = 44100   # Resample everything to this sample rate
HOP_LENGTH    = 512     # librosa hop — ~11.6 ms at 44100 Hz
N_FFT         = 2048    # FFT window for STFT-based features
N_CHROMA      = 12      # Chroma bins (one per semitone)
N_MELS        = 128     # Mel bands used internally by librosa

# Desired output frames per second for the feature stream.
# hop_length / sr ≈ 11.6 ms → ~86 fps raw; we down-sample to TARGET_FPS
# by skipping frames so the JSON stays small and the browser loop is sane.
TARGET_FPS    = 60

# Sub-bass band used for bass-layer energy (Hz)
BASS_LOW_HZ   = 20
BASS_HIGH_HZ  = 200

# ---------------------------------------------------------------------------
# Demucs
# ---------------------------------------------------------------------------

DEMUCS_MODEL  = "htdemucs"      # Hybrid transformer model (v4)
DEMUCS_DEVICE = "cpu"           # "cuda" if GPU available

# Demucs output stem names → our internal names
STEM_MAP = {
    "vocals": "melody",
    "bass":   "bass",
    "drums":  "drums",
    "other":  "harmonic",
}

STEM_NAMES = list(STEM_MAP.values())  # ["melody", "bass", "drums", "harmonic"]

# ---------------------------------------------------------------------------
# WebSocket server
# ---------------------------------------------------------------------------

WS_HOST           = "localhost"
WS_PORT           = 8765
WS_FRAME_INTERVAL = 1.0 / TARGET_FPS   # seconds between frame messages
PLAYBACK_BUFFER_S = 0.05               # look-ahead tolerance for frame scheduling

# ---------------------------------------------------------------------------
# Evaluation
# ---------------------------------------------------------------------------

EVAL_WINDOW_S   = 30.0   # seconds of audio to use for metric computation
                          # (use a representative excerpt, not the whole file)

# ---------------------------------------------------------------------------
# Export / MP4
# ---------------------------------------------------------------------------

EXPORT_WIDTH  = 1920
EXPORT_HEIGHT = 1080
EXPORT_FPS    = 60
