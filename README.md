# Strata — AI-Driven Source Separation & 3D Visualisation

Source-separation 3D music visualiser backend and WebGL frontend for the 6178 Seminar in Visual Computing.

## Directory Layout

\`\`\`
strata/
├── README.md
├── requirements.txt
├── config.py # Central config (paths, frame rate, WS port, stems)
│
├── separation/
│ ├── **init**.py
│ └── demucs_runner.py # Run Demucs, cache stems, validate output
│
├── analysis/
│ ├── **init**.py
│ ├── features.py # Dataclasses for all feature types
│ ├── feature_extractor.py # Per-stem librosa analysis → FeatureFrame objects
│ └── export.py # Serialise feature timeline → features.json
│
├── evaluation/
│ ├── **init**.py
│ └── metrics.py # SDR/SIR/SAR via mir_eval + spectrogram export
│
├── server/
│ ├── **init**.py
│ ├── player.py # Playback clock — streams feature frames in sync
│ └── ws_server.py # asyncio WebSocket server (playback + control)
│
├── export/
│ ├── **init**.py
│ └── mp4_export.py # Puppeteer + ffmpeg offline render trigger
│
└── pipeline.py # CLI entry: separation → analysis → server
\`\`\`

## Quick Start

\`\`\`bash

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
\`\`\`

## WebSocket Protocol

### Server → Client

| Message type | Payload                                      | When                        |
| ------------ | -------------------------------------------- | --------------------------- |
| `ready`      | `{ duration, sr, hop_length, fps, stems[] }` | After features loaded       |
| `frame`      | `{ t, melody, bass, drums, harmonic }`       | Every frame during playback |
| `seeked`     | `{ t }`                                      | After seek completes        |
| `ended`      | `{}`                                         | Playback reached end        |

Each stem sub-object in a `frame` message:
\`\`\`json
{
"rms": 0.042,
"onset": 0.81,
"spectral_centroid": 3200.5,
"chroma": [0.1, 0.9, 0.2, ...], // 12 values
"pitch_hz": 440.0,
"beat_phase": 0.34
}
\`\`\`

### Client → Server

\`\`\`json
{ "cmd": "play" }
{ "cmd": "pause" }
{ "cmd": "seek", "t": 12.5 }
{ "cmd": "speed", "factor": 1.5 }
{ "cmd": "mute", "stem": "bass", "muted": true }
{ "cmd": "solo", "stem": "melody" }
{ "cmd": "unsolo" }
\`\`\`

## Stem → Visual Mapping (Pastel / Ethereal Aesthetic)

The visualization maps mathematical audio features to specific 3D geometries in a volumetric pastel environment (peach/cream fog) to emphasize the magical, ethereal nature of orchestral music.

| Stem             | Features used                  | Visual effect                                                                            |
| ---------------- | ------------------------------ | ---------------------------------------------------------------------------------------- |
| Melody           | RMS, chroma, onset             | **Mint-green double-helix ribbon** — height ∝ pitch, undulating in 3D                    |
| Bass             | sub-bass RMS, beat_phase       | **Pastel coral-pink 3D Torus** (Ground shockwave) — radius & opacity ∝ energy            |
| Drums            | onset, RMS envelope            | **Soft lemon-yellow particle burst** — scale & rotation ∝ hit intensity                  |
| Harmonic (other) | spectral_centroid, RMS, chroma | **Lavender/soft-blue quantum gyroscope** (nested rings) — density & opacity ∝ brightness |

## Frontend Features & Interactivity (Three.js)

_Added to support real-time artifact inspection and presentation._

- **Live Layer Control (GUI):** A built-in `lil-gui` dashboard allows users to Solo or Mute individual AI stems in real-time. This is crucial for isolating specific channels to visually inspect Demucs separation artifacts.
- **High-Quality Browser Export:** Integrated `MediaRecorder` API inside the GUI to capture the WebGL canvas as a 60 FPS, high-bitrate `.webm` video, providing a seamless offline presentation alternative to the backend Puppeteer export.
