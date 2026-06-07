# Suggested Slide Outline

## Slide 1: STRATA

Show `screenshots/01_opening.png` or open the live demo immediately.

Message:

> AI source separation + real-time 3D music visualization.

## Slide 2: Motivation

Problem:

> Traditional music visualizers often react to a single global amplitude value.
> Strata uses separated musical layers so different parts of the song can drive
> different visual systems.

## Slide 3: Pipeline

Diagram content:

```text
Input song
  -> Demucs source separation
  -> bass / drums / melody / harmonic stems
  -> feature extraction
  -> WebSocket feature stream
  -> Three.js visual scene
```

## Slide 4: Technical Evaluation

Use:

- `../technical/technical_scorecard.png`
- `../technical/spectrogram_plate.png`
- `../technical/stem_correlation_heatmap.png`

Key numbers:

- Reconstruction SNR: **28.49 dB**
- Mean absolute stem correlation: **0.052**

Main sentence:

> The separated stems are consistent enough to reconstruct the track and distinct
> enough to drive separate visual layers.

Presentation order:

> Start with the scorecard so the audience understands the judgement, then use
> the spectrogram and correlation heatmap as supporting evidence.

## Slide 5: Visual Mapping

Use:

- `../visual_mapping/visual_mapping_storyboard.png`
- `../visual_mapping/visual_mapping_table.png`
- `../visual_mapping/visual_mapping_controls.png`

Main sentence:

> Each visual behavior is tied to a specific audio descriptor extracted from a
> specific stem.

Presentation order:

> Start with the storyboard to teach the mapping logic, then show the table and
> control plots to prove that the mapping is measurable.

## Slide 6: Live Demo

Use the seek bar to jump between:

- 0:11 bass
- 0:20 drums
- 0:28 melody
- 0:36 harmony
- 1:35 combined
- 3:05 energetic combined scene

## Slide 7: Results

Use:

- `../visual_mapping/visual_control_timeline.png`
- `screenshots/07_combined_scene.png`

Main sentence:

> The result is a cinematic audiovisual system where source-separated musical
> layers become spatial layers in a 3D scene.

## Slide 8: Limitations And Future Work

Limitations:

- No isolated ground-truth stems for the selected commercial song.
- Demucs output may contain bleed between stems.
- Visual mapping is hand-designed, not learned.

Future work:

- Add shader-based post-processing.
- Add beat-aware scene transitions.
- Add TouchDesigner or Blender-rendered assets for a more stage-ready show mode.
- Compare multiple tracks and mapping presets.

## Slide 9: Closing Claim

> Strata turns hidden musical layers into visible spatial structures.
