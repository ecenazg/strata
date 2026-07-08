# Strata — AI-Driven Source Separation & 3D Visualisation

Source-separation 3D music visualiser backend and WebGL frontend for the 6178
Seminar in Visual Computing.

The current final-demo prototype uses a prepared multi-track library: each
track is separated with Demucs, analyzed into per-stem feature JSON, and loaded
by a static Three.js frontend. The browser demo also derives motion profiles
from the precomputed features so rhythm-heavy, bass-heavy, and harmonic tracks
move differently even when the audio is muted.

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

### Run The Static Frontend Demo

\`\`\`bash
cd frontend
npm install
npm run dev -- --host 127.0.0.1
\`\`\`

Open:

\`\`\`text
http://127.0.0.1:5173/strata/
\`\`\`

The browser reads `frontend/public/tracks.json`, then loads the selected MP3
and matching `frontend/public/features/<track-id>.json`.

### Prepare Tracks Offline

\`\`\`bash
python3 prepare_tracks.py party-tau-mich-auf bass-track piano-the-mountain
\`\`\`

This runs the Demucs/librosa preparation pipeline for selected track IDs and
updates the corresponding feature JSON files. The deployed GitHub Pages demo
does not run Demucs live in the browser.

### Legacy WebSocket Pipeline

The repository still contains the original WebSocket pipeline for development
experiments:

\`\`\`bash
python3 pipeline.py --track-manifest frontend/public/tracks.json
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

## Stem → Visual Mapping

The visualization maps mathematical audio features to specific 3D geometries in
a cinematic volumetric scene.

| Stem             | Features used                  | Visual effect                                                                            |
| ---------------- | ------------------------------ | ---------------------------------------------------------------------------------------- |
| Melody           | RMS, pitch, chroma             | glowing 3D ribbon — height and trail follow pitched material |
| Bass             | RMS, onset, motion profile     | floor shockwaves and expanding low-frequency rings |
| Drums            | onset, RMS, motion profile     | particle bursts whose frequency and lifetime follow transient density |
| Harmonic (other) | spectral_centroid, RMS, chroma, motion profile | atmospheric cloud/ring field with smooth harmonic-flow behavior |

## Feature-Derived Motion Profiles

Color profiles provide the aesthetic mood, but genre readability is supported
by motion behavior:

- **Beat-locked** tracks create short, sharp particle bursts and tighter
  camera/lighting response.
- **Bass-dominant** tracks emphasize large low-frequency shockwaves.
- **Harmonic-flow** tracks create smoother ribbon motion and longer cloud
  persistence.

The motion profile is computed client-side from precomputed feature JSON plus
the prepared track's visual profile. This keeps the deployed demo static while
making the visual behavior data-driven.

## Frontend Features & Interactivity (Three.js)

_Added to support real-time artifact inspection and presentation._

- **Live Layer Control (GUI):** A built-in `lil-gui` dashboard allows users to Solo or Mute individual AI stems in real-time. This is crucial for isolating specific channels to visually inspect Demucs separation artifacts.
- **High-Quality Browser Export:** Integrated `MediaRecorder` API inside the GUI to capture the WebGL canvas as a 60 FPS, high-bitrate `.webm` video, providing a seamless offline presentation alternative to the backend Puppeteer export.
