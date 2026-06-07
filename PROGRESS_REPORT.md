# Strata — Progress Report
**Date:** June 7, 2026  
**Live Demo:** https://ecenazg.github.io/strata/  
**Status:** ✅ Deployed

---

## What Is Strata?

Strata is an AI-powered real-time 3D music visualizer. It separates a song into its four hidden instrument layers — **bass, drums, melody, and harmony** — and translates each layer into a distinct cinematic 3D animation, all synchronized to the audio as it plays.

The name "Strata" refers to geological layers: music has hidden layers too, and this project makes them visible.

---

## What We Built

### 1. Python Backend — Audio Analysis Pipeline

**Files:** `config.py`, `analysis/features.py`, `analysis/feature_extractor.py`

The backend is responsible for breaking a song apart and extracting detailed musical data from each piece.

**Step 1 — Source Separation (Demucs)**  
We run the song through Meta's `htdemucs` model, which separates it into four stems: `vocals` (mapped to *melody*), `bass`, `drums`, and `other` (mapped to *harmonic*). The separated `.wav` files are cached in `stems/`.

**Step 2 — Feature Extraction (librosa)**  
Each stem is analyzed frame-by-frame at 44,100 Hz with a 512-sample hop (~11.6 ms resolution). For every frame we extract:

| Feature | What it captures |
|---|---|
| `rms` | Volume / energy level (normalized 0–1) |
| `onset` | Attack sharpness — how sudden a sound hits |
| `spectral_centroid` | Brightness — where frequency mass is centered |
| `chroma` | 12 pitch-class energies (one per musical semitone) |
| `pitch_hz` | Dominant pitch in Hz |
| `beat_phase` | Position within the current beat cycle (0–1) |

**Step 3 — Down-sampling to 60 FPS**  
Raw librosa output is ~86 fps. We down-sample to exactly 60 fps to match the renderer, producing a compact `features.json` (~timeline of all four stems).

**Key data structures:**
- `StemFeatures` — per-frame features for one instrument
- `FrameFeatures` — all four stems at one timestamp
- `FeatureTimeline` — the complete song analysis, serializable to/from JSON

---

### 2. JavaScript Frontend — Real-Time 3D Visualizer

**Stack:** Three.js, Vite, lil-gui  
**Files:** `frontend/src/`

The frontend loads `features.json` and the MP3, then drives a full 3D scene in sync with the audio.

#### AudioSyncManager (`AudioSyncManager.js`)
- Loads the feature timeline from JSON on startup
- Plays the HTML5 `<audio>` element and runs a `requestAnimationFrame` loop
- On each frame, finds the correct `FrameFeatures` by binary-searching the timestamp
- Dispatches feature data to all four visualizers
- Supports **play, pause, seek** — including click-to-seek on the progress bar

#### SceneManager (`SceneManager.js`)
Owns the Three.js scene, camera, lighting, and post-processing:
- **Camera:** Perspective camera with drag-to-orbit and scroll-to-zoom. Auto-rotates slowly when idle. Beat-pulse pushes the camera slightly closer for a "punch" effect.
- **Lighting:** Ambient fill + directional key light + warm point light + cyan point light. Warm and cyan intensities pulse with bass and harmonic energy.
- **Post-processing:** `UnrealBloomPass` — bloom strength scales with beat energy for a glowing HDR look.
- **Star field:** 900 colored particles forming a deep-space backdrop, slowly rotating.
- **Energy rings:** 4 concentric torus rings at the bass layer origin, pulsing outward on bass hits.
- **Separation streams:** Animated Catmull-Rom spline streams that show the signal flowing from the source into each separated stem — most visible during the "source separation" demo phase.
- **Phase system:** The song is divided into 8 narrative phases (opening → separation → bass → drums → melody → harmony → combined → closing), each with its own camera behavior and layer mix.

#### Four Visualizers

| Visualizer | File | What it shows | Three.js primitive |
|---|---|---|---|
| **BassShockwave** | `BassShockwave.js` | Bass energy as expanding floor rings + shockwave | Torus + CircleGeometry |
| **MelodyRibbon** | `MelodyRibbon.js` | Melody as a flowing 3D ribbon colored by pitch | BufferGeometry line with vertex colors |
| **DrumParticles** | `DrumParticles.js` | Drum hits as exploding particle bursts | Points / particle system |
| **HarmonicCloud** | `HarmonicCloud.js` | Harmonic field as a floating luminous cloud | Instanced mesh / point cloud |

Each visualizer has a `setMix(value)` method that scales its visual intensity. The phase system uses `applyPhaseMix()` to spotlight one layer at a time — for example, during the "bass" phase, `mix.bass = 1` while all others are reduced.

#### Cinematic Overlay (HTML/CSS)
- **Title lockup:** "STRATA" headline with eyebrow text and subtitle
- **Phase label:** Live text showing the current narrative phase
- **Stem legend:** Color-coded guide (bass = blue, drums = yellow, melody = green, harmony = purple)
- **Progress bar:** Clickable/draggable seek bar with ARIA accessibility
- **Closing sequence:** Fade-in outro text when the song nears its end

#### Debug Panel (lil-gui, press `G`)
- Toggle each of the 4 instrument layers on/off individually
- **Video recorder:** Press `R` or use the GUI to capture a `.webm` video of the canvas at 60fps, 7 Mbps — download happens automatically on stop

---

### 3. Deployment

The frontend is built with Vite and deployed to **GitHub Pages** at:  
**https://ecenazg.github.io/strata/**

The `features.json` and the test MP3 are bundled into the static build (`dist/`), so the app runs entirely in the browser with no server needed.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────┐
│                  PYTHON BACKEND                      │
│                                                     │
│  frontend/public/audio/test_music.mp3               │
│       │                                             │
│       ▼                                             │
│  Demucs (htdemucs) ──────────────────────────────►  stems/
│       │                                    vocals.wav
│       │                                    bass.wav
│       │                                    drums.wav
│       │                                    other.wav
│       ▼                                             │
│  librosa feature extraction                         │
│  (RMS, onset, centroid, chroma, pitch, beat)        │
│       │                                             │
│       ▼                                             │
│  Down-sample → 60 FPS                               │
│       │                                             │
│       ▼                                             │
│  features.json  ◄───────────────────────────────── │
└─────────────────────────────────────────────────────┘
                         │
                         │ (bundled into dist/)
                         ▼
┌─────────────────────────────────────────────────────┐
│              JAVASCRIPT FRONTEND (Three.js)          │
│                                                     │
│  AudioSyncManager                                   │
│  ├── Loads features.json                            │
│  ├── Plays MP3                                      │
│  └── Streams FrameFeatures @ 60fps                  │
│                         │                           │
│           ┌─────────────┼──────────────┐            │
│           ▼             ▼              ▼            │
│    BassShockwave  MelodyRibbon  DrumParticles  HarmonicCloud
│           │             │              │            │
│           └─────────────┴──────────────┘            │
│                         ▼                           │
│               SceneManager (Three.js)               │
│               Camera + Bloom + Phase system         │
│                         │                           │
│                         ▼                           │
│              WebGL Canvas → Browser                 │
└─────────────────────────────────────────────────────┘
                         │
              GitHub Pages deployment
                         ▼
          https://ecenazg.github.io/strata/
```

---

## Key Technical Decisions

**Why Demucs?**  
Meta's `htdemucs` is state-of-the-art for music source separation. It uses a hybrid architecture (waveform + spectrogram domains) and handles the full frequency range of each instrument well.

**Why pre-computed features instead of real-time analysis?**  
Running librosa in the browser is not feasible. Pre-computing to JSON keeps the frontend purely presentational — no heavy audio math at runtime, just array lookups.

**Why Three.js?**  
WebGL gives us GPU-accelerated rendering for particles, geometry shaders, and post-processing bloom — essential for smooth 60fps visuals.

**Why Vite?**  
Fast HMR during development, minimal config, and clean static output for GitHub Pages deployment.

---

## What's Next (Future Work)

- **Upload your own song** — drag & drop any MP3, run the backend pipeline, visualize it
- **WebSocket mode** — stream features in real time from a running Python server instead of loading a static JSON
- **More visualizers** — waveform oscilloscope, frequency spectrum bars, chord wheel
- **Export to MP4** — ffmpeg-based server-side render at full 1920×1080 resolution

---

*Built with Python (Demucs, librosa, NumPy), JavaScript (Three.js, Vite, lil-gui), deployed on GitHub Pages.*
