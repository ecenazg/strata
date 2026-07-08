# Strata Live Demo Script

Use this as the presenter script during the final seminar.

## Setup

For the deployed/static demo, no Python backend is required during
presentation. The prepared MP3 files and feature JSON files are loaded directly
from `frontend/public/tracks.json`.

Run frontend locally:

```bash
cd /Users/humeyrapolat/Documents/AI/strata-latest/frontend
npm run dev -- --host 127.0.0.1
```

Open:

```text
http://127.0.0.1:5173/strata/
```

If the deployed GitHub Pages build has been pushed, use:

```text
https://ecenazg.github.io/strata/
```

The track selector reads `frontend/public/tracks.json`. Prepared tracks must
have a matching browser audio file and a matching precomputed features file.
New songs are prepared offline with `prepare_tracks.py`; the live deployed demo
does not run Demucs on arbitrary uploads yet.

## Live Demo Timeline

| Timestamp | Action                     | Talk track                                                                                           |
| --------: | -------------------------- | ---------------------------------------------------------------------------------------------------- |
|      0:00 | Start at opening           | "This is Strata, an AI-driven source separation music visualizer."                                   |
|      0:04 | separation phase           | "The system splits the track into visual streams mapped to separated audio stems."                   |
|      0:11 | seek / let bass phase play | "Bass RMS drives the blue shockwave rings and floor pulse."                                          |
|      0:20 | drums phase                | "Drum onsets trigger transient particle bursts."                                                     |
|      0:28 | melody phase               | "Melody pitch and energy bend the green ribbon in 3D space."                                         |
|      0:36 | harmony phase              | "Harmonic RMS and spectral centroid control the atmospheric cloud field."                            |
|      1:35 | combined scene             | "After the reveal, all layers react together inside one 3D audiovisual space."                       |
|      3:05 | energetic combined section | "The seek bar lets us inspect whether the mapping still works at any point in the song."             |
|      4:16 | closing                    | "The final statement summarizes the pipeline: AI source separation plus real-time 3D visualization." |

## Multi-Track / Silent-View Demonstration

Use this sequence to answer the latest instructor feedback.

| Action | Track | What to point out |
| --- | --- | --- |
| Start with a beat-heavy track | `Tau mich auf` | Shorter, sharper particle bursts and more beat-locked camera/lighting response. |
| Switch to a bass-dominant track | `Bass Track` or `Heartless` | Larger low-frequency shockwaves and stronger floor-ring dominance. |
| Switch to a harmonic/cinematic track | `The Mountain`, `Outro`, or `Innerbloom` | Smoother ribbon motion, longer harmonic-cloud persistence, less staccato behavior. |

Presentation sentence:

> We use color as an aesthetic layer, but the stronger genre cue is motion
> behavior. The browser derives a motion profile from precomputed stem features:
> onset density, percussive/harmonic balance, tempo regularity, and bass
> dominance. This makes tracks read as beat-locked, bass-dominant, or
> harmonic-flow even when the audio is muted.

## Defense Lines

Use these sentences if the instructor asks why the project is visually and
technically justified.

> We moved beyond a debug-style visualizer by designing a cinematic scene where
> each audio stem has a distinct spatial behavior, color, and motion language.

> The mapping is data-driven: bass RMS, drum onset, melody pitch, and harmonic
> spectral centroid directly control visual parameters in the Three.js scene.

> Because we do not have ground-truth studio stems for this commercial track, we
> evaluate reconstruction consistency and stem distinctness instead of claiming
> absolute source-separation accuracy.

> The evaluation shows that the separated stems reconstruct the original mix
> consistently, while the visual mapping evaluation shows that the four visual
> layers react through different control signals.

> The final prototype extends the original report: it now supports seven
> prepared tracks and adds feature-derived motion profiles, which directly
> address the feedback that different music types should be visually readable.

## Things To Avoid Saying

- Do not say: "The source separation is perfectly accurate."
- Say instead: "The separated stems are technically consistent and distinct
  enough to drive the visualization."

- Do not say: "The visuals are manually animated."
- Say instead: "The visuals are parameterized by real-time audio features."

- Do not say: "The system automatically runs Demucs for any uploaded song in
  the browser."
- Say instead: "The final demo is static and reliable: prepared songs are
  processed offline with Demucs, then the browser visualizes their feature JSON
  without needing a server."
