# Strata — Progress Report
**Date:** July 8, 2026  
**Live Demo:** https://ecenazg.github.io/strata/  
**Status:** Deployed prototype, final-demo alignment in progress

---

## What Is Strata?

Strata is an AI-powered real-time 3D music visualizer. It separates prepared songs into hidden musical layers — **bass, drums, melody, and harmony** — and translates each layer into a distinct cinematic 3D animation synchronized to the audio.

The current prototype supports a prepared multi-track library and uses feature-derived motion profiles so that different tracks do not only change color: rhythm-heavy music becomes sharper and more beat-locked, bass-heavy music produces stronger shockwaves, and harmonic/cinematic music becomes smoother and more flowing.

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

**Step 3 — Prepared Track Library**  
Each prepared song is exported as its own feature timeline under `features/*.json` and copied to `frontend/public/features/*.json`. The browser reads `frontend/public/tracks.json` to switch between prepared songs without requiring a backend server during the live demo.

**Key data structures:**
- `StemFeatures` — per-frame features for one instrument
- `FrameFeatures` — all four stems at one timestamp
- `FeatureTimeline` — the complete song analysis, serializable to/from JSON

---

### 2. JavaScript Frontend — Real-Time 3D Visualizer

**Stack:** Three.js, Vite, lil-gui  
**Files:** `frontend/src/`

The frontend loads `tracks.json`, the selected MP3, and the selected feature JSON, then drives a full 3D scene in sync with the audio.

#### AudioSyncManager (`AudioSyncManager.js`)
- Loads the selected track's feature timeline from JSON
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

#### Feature-Derived Motion Profiles

To address the instructor feedback that viewers should infer the music
character even without hearing it, the current frontend derives a lightweight
motion profile from each selected track's feature JSON:

| Motion cue | Feature evidence | Visual effect |
|---|---|---|
| Beat-locked / rhythm-heavy | onset density + tempo regularity | shorter, sharper particle bursts and tighter camera/lighting response |
| Bass-dominant | bass energy share and bass motion profile | larger, stronger low-frequency shockwaves |
| Harmonic-flow | harmonic/melodic balance | smoother ribbon motion and longer harmonic cloud persistence |

This is implemented client-side from precomputed features, preserving the static
GitHub Pages deployment while still keeping the final motion behavior
data-driven.

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

The prepared MP3 files, `tracks.json`, and `features/*.json` files are bundled
into the static build (`dist/`), so the app runs entirely in the browser with no
server needed.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────┐
│                  PYTHON BACKEND                      │
│                                                     │
│  frontend/public/audio/*.mp3                        │
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
│  Export per-track feature timeline                  │
│       │                                             │
│       ▼                                             │
│  features/<track-id>.json ◄────────────────────── │
└─────────────────────────────────────────────────────┘
                         │
                         │ (bundled into dist/)
                         ▼
┌─────────────────────────────────────────────────────┐
│              JAVASCRIPT FRONTEND (Three.js)          │
│                                                     │
│  AudioSyncManager                                   │
│  ├── Loads tracks.json + selected feature JSON      │
│  ├── Plays MP3                                      │
│  └── Streams timestamp-aligned FrameFeatures        │
│                         │                           │
│           MotionProfile derives behavior style      │
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

**Why client-side motion profiles?**  
The final deployed demo must remain static and reliable on GitHub Pages. Motion
profiles are therefore derived in the browser from already-precomputed stem
features. This keeps deployment simple while making the visualization respond
to track character beyond color palette changes.

**Why Three.js?**  
WebGL gives us GPU-accelerated rendering for particles, geometry shaders, and post-processing bloom — essential for smooth 60fps visuals.

**Why Vite?**  
Fast HMR during development, minimal config, and clean static output for GitHub Pages deployment.

---

## What's Next (Future Work)

- **Upload your own song** — drag & drop any MP3, run the backend pipeline, visualize it
- **Automatic genre/profile inference** — infer the visual profile for new songs instead of assigning a prepared track category
- **WebSocket mode** — stream features in real time from a running Python server instead of loading a static JSON
- **More visualizers** — waveform oscilloscope, frequency spectrum bars, chord wheel
- **Export to MP4** — ffmpeg-based server-side render at full 1920×1080 resolution

---

*Built with Python (Demucs, librosa, NumPy), JavaScript (Three.js, Vite, lil-gui), deployed on GitHub Pages.*
