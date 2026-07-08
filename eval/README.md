# Strata Evaluation Package

This folder is the presentation evidence package for Strata. It is organized
around one defensible claim:

> Strata uses AI source separation to reveal hidden musical layers, then maps
> those layers into readable real-time 3D visual behavior.

## How To Read The Evaluation

Use the evaluation in this order during the seminar:

1. Live demo first, so the audience understands the experience.
2. Technical evaluation, to show that the AI-separated stems are coherent and
   distinct enough to drive the system.
3. Visual mapping evaluation, to show that the visuals are controlled by
   measured audio features rather than arbitrary animation.
4. Final alignment evaluation, to show that the current prototype addresses the
   latest feedback: multiple songs and visually readable music character.
5. Presentation-ready proof, to connect the evidence back to the final demo.

## Technical Evaluation

Folder: `technical/`

Main report: `technical/technical_report.md`

Best slide assets:

- `technical/technical_scorecard.png`
- `technical/spectrogram_plate.png`
- `technical/stem_energy_distribution.png`
- `technical/stem_correlation_heatmap.png`

Core interpretation:

- Reconstruction SNR: `28.49 dB`, good and close to very strong.
- Residual RMS: `-41.55 dBFS`, low residual error.
- Mean cross-stem correlation: `0.052`, distinct visual drivers.

Important limitation:

We do not have isolated studio ground-truth stems for the commercial track, so
we do not claim absolute SDR/SIR/SAR. The evaluation focuses on reconstruction
consistency, spectral inspection, and visual-control suitability.

Note for the final presentation:

The technical metrics are an example-track source-separation evaluation. The
current deployed prototype now supports a larger prepared track library, so use
the final alignment report below when defending multi-track coverage.

## Visual Mapping Evaluation

Folder: `visual_mapping/`

Main report: `visual_mapping/visual_mapping_report.md`

Best slide assets:

- `visual_mapping/visual_mapping_storyboard.png`
- `visual_mapping/visual_mapping_table.png`
- `visual_mapping/visual_control_timeline.png`
- `visual_mapping/visual_mapping_controls.png`

Core interpretation:

- Bass RMS drives blue shockwaves and floor rings.
- Drum onset/RMS drives gold particle bursts.
- Melody pitch/RMS drives the green ribbon.
- Harmonic RMS/spectral centroid drives the purple atmospheric field.
- Feature-derived motion profiles modulate the behavior further: beat-heavy
  tracks become sharper and more rhythm-locked, while cinematic/harmonic tracks
  become smoother and more persistent.

## Final Alignment Evaluation

Folder: `final_alignment/`

Main report: `final_alignment/final_alignment_report.md`

Machine-readable summary:

- `final_alignment/final_alignment_summary.json`

Core interpretation:

- The demo currently includes `7` prepared tracks.
- Every prepared track has a matching browser audio file and feature JSON.
- Motion profiles classify the prepared tracks into beat-locked,
  bass-dominant, and harmonic-flow behavior.
- This is the direct answer to the instructor feedback that the visualization
  should make different kinds of music visually distinguishable even without
  hearing the audio.

## Presentation-Ready Proof

Folder: `presentation_ready/`

Use these files to build the final seminar story:

- `presentation_ready/README.md`
- `presentation_ready/slide_outline.md`
- `presentation_ready/demo_script.md`
- `presentation_ready/screenshots/`

Defense sentence:

> The evaluation does not argue that source separation is perfect. It argues
> that the separated stems are coherent, distinct, and expressive enough to
> support a real-time visual computing system. The current final prototype also
> extends the June report with multi-track support and feature-derived motion
> behavior for silent-view music character readability.
