# Strata — Python Backend

Source-separation 3D music visualiser backend for the 6178 Seminar in Visual Computing.

## Directory Layout

```
strata/
├── README.md
├── requirements.txt
├── config.py                  # Central config (paths, frame rate, WS port, stems)
│
├── separation/
│   ├── __init__.py
│   └── demucs_runner.py       # Run Demucs, cache stems, validate output
│
├── analysis/
│   ├── __init__.py
│   ├── features.py            # Dataclasses for all feature types
│   ├── feature_extractor.py   # Per-stem librosa analysis → FeatureFrame objects
│   └── export.py              # Serialise feature timeline → features.json
│
├── evaluation/
│   ├── __init__.py
│   └── metrics.py             # SDR/SIR/SAR via mir_eval + spectrogram export
│
├── server/
│   ├── __init__.py
│   ├── player.py              # Playback clock — streams feature frames in sync
│   └── ws_server.py           # asyncio WebSocket server (playback + control)
│
├── export/
│   ├── __init__.py
│   └── mp4_export.py          # Puppeteer + ffmpeg offline render trigger
│
└── pipeline.py                # CLI entry: separation → analysis → server
```

## Quick Start

```bash
# 1. Install Python deps
pip install -r requirements.txt

# 2. Install Demucs (separate, needs torch)
pip install demucs

# 3. Run full pipeline (separate + analyse + serve)
python pipeline.py --audio path/to/hp_excerpt.wav

# 4. Skip separation if stems already exist
python pipeline.py --audio path/to/hp_excerpt.wav --skip-separation

# 5. Only compute evaluation metrics
python pipeline.py --audio path/to/hp_excerpt.wav --eval-only

# 6. Change WebSocket port (default 8765)
python pipeline.py --audio path/to/hp_excerpt.wav --port 9000
```

## WebSocket Protocol

### Server → Client

| Message type | Payload | When |
|---|---|---|
| `ready` | `{ duration, sr, hop_length, fps, stems[] }` | After features loaded |
| `frame` | `{ t, melody, bass, drums, harmonic }` | Every frame during playback |
| `seeked` | `{ t }` | After seek completes |
| `ended` | `{}` | Playback reached end |

Each stem sub-object in a `frame` message:
```json
{
  "rms":              0.042,
  "onset":            0.81,
  "spectral_centroid": 3200.5,
  "chroma":           [0.1, 0.9, 0.2, ...],  // 12 values
  "pitch_hz":         440.0,
  "beat_phase":       0.34
}
```

### Client → Server

```json
{ "cmd": "play" }
{ "cmd": "pause" }
{ "cmd": "seek",  "t": 12.5 }
{ "cmd": "speed", "factor": 1.5 }
{ "cmd": "mute",  "stem": "bass",   "muted": true }
{ "cmd": "solo",  "stem": "melody" }
{ "cmd": "unsolo" }
```

## Stem → Visual Mapping

| Stem | Features used | Visual effect |
|---|---|---|
| Melody | RMS, chroma, onset | Rising ribbon — hue & height ∝ pitch |
| Bass | sub-bass RMS, beat_phase | Ground shockwave — radius ∝ energy |
| Drums | onset, RMS envelope | Particle burst — count ∝ hit intensity |
| Harmonic (other) | spectral_centroid, RMS, chroma | Colour cloud — density & hue ∝ brightness |
