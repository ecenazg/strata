# Strata Live Demo Script

Use this as the presenter script during the final seminar.

## Setup

Run backend:

```bash
cd /Users/humeyrapolat/Documents/AI/strata
python3 pipeline.py --track-manifest frontend/public/tracks.json
```

Run frontend:

```bash
cd /Users/humeyrapolat/Documents/AI/strata/frontend
npm run dev -- --host 127.0.0.1
```

Open:

```text
http://127.0.0.1:5173/
```

The track selector reads `frontend/public/tracks.json`. Prepared tracks must
have a matching browser audio file and a matching precomputed features file.

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

## Things To Avoid Saying

- Do not say: "The source separation is perfectly accurate."
- Say instead: "The separated stems are technically consistent and distinct
  enough to drive the visualization."

- Do not say: "The visuals are manually animated."
- Say instead: "The visuals are parameterized by real-time audio features."
