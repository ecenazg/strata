# Strata Presentation-Ready Proof

This folder collects the evidence package for the final Visual Computing
seminar presentation. It is designed to support one central claim:

> Strata is an AI source-separation driven real-time 3D music visualization
> system, not a decorative animation.

## Proof Assets

### Live Demo Captures

Screenshots from the running Three.js demo:

| File | Moment | What it proves |
| --- | --- | --- |
| `screenshots/01_opening.png` | opening | branded cinematic system entry |
| `screenshots/02_live_start.png` | playback start | feature stream is live |
| `screenshots/03_bass_layer.png` | bass phase | bass controls shockwave/rings |
| `screenshots/04_drums_layer.png` | drums phase | drum transients control particles |
| `screenshots/05_melody_ribbon.png` | melody phase | pitch/energy controls ribbon motion |
| `screenshots/06_harmonic_field.png` | harmony phase | harmonic texture controls cloud/rings |
| `screenshots/07_combined_scene.png` | combined phase | all layers interact in one 3D scene |
| `screenshots/08_drop_combined.png` | later combined phase | energetic show mode |
| `screenshots/09_closing_sequence.png` | closing | final system statement |

### Technical Evaluation

Use these when explaining whether the audio separation is technically coherent:

| File | Use |
| --- | --- |
| `../technical/technical_report.md` | written technical evaluation |
| `../technical/technical_scorecard.png` | presentation-friendly summary of the technical claim |
| `../technical/spectrogram_plate.png` | visual proof of separated spectral structures |
| `../technical/stem_energy_distribution.png` | separated stem energy distribution |
| `../technical/stem_correlation_heatmap.png` | low cross-stem correlation / bleed proxy |
| `../technical/technical_summary.json` | machine-readable metrics |

Key metrics:

- Reconstruction SNR: **28.49 dB**
- Residual RMS: **-41.55 dBFS**
- Mean absolute stem correlation: **0.052**

Academic framing:

> Since isolated ground-truth stems are not available for this commercial track,
> we evaluate technical consistency rather than absolute source-separation
> accuracy.

### Visual Mapping Evaluation

Use these when explaining how sound features become visual behavior:

| File | Use |
| --- | --- |
| `../visual_mapping/visual_mapping_report.md` | written visual mapping evaluation |
| `../visual_mapping/visual_mapping_storyboard.png` | teaching diagram from stem to feature to 3D behavior |
| `../visual_mapping/visual_mapping_table.png` | compact audio-to-visual mapping table |
| `../visual_mapping/visual_control_timeline.png` | normalized visual control signals over time |
| `../visual_mapping/visual_mapping_controls.png` | per-layer control signal plots |
| `../visual_mapping/visual_mapping_summary.json` | machine-readable mapping metrics |

Key metrics:

- Bass floor scale max: **1.420**
- Drum burst events: **579** events, about **132.31/min**
- Melody active pitch coverage: **64.31%**
- Harmonic scale max: **1.709**

Defense sentence:

> The visual system is not driven by arbitrary animation. Each visual layer is
> controlled by a specific descriptor extracted from an AI-separated stem.

## Recommended Presentation Flow

1. Start with the live demo for emotional impact.
2. Pause and show the pipeline: input song -> Demucs stems -> feature timeline -> Three.js scene.
3. Show technical evaluation: scorecard first, then spectrograms and correlation.
4. Show visual mapping evaluation: storyboard first, then mapping table and control timeline.
5. Return to the live demo and jump between sections with the seek bar.
6. Close with the system claim: AI separation plus real-time 3D audiovisual mapping.

## Demo Controls

- Track selector: switch between prepared demo tracks
- Click canvas: play / pause
- Drag scene: orbit camera
- Scroll / trackpad: zoom in or out
- Bottom progress line: seek to any song position
- Arrow right / left: jump 10 seconds
- `G`: debug GUI
- `R`: record video export
