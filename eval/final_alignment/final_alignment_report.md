# Strata Final Alignment Report

This report checks whether the current prototype matches the project report,
the G01 concept, and the latest instructor feedback.

## Final Claims

| Claim | Evidence in current project | Status |
| --- | --- | --- |
| Multi-track demo support | 7 prepared tracks listed in `frontend/public/tracks.json` | satisfied |
| Complete prepared library | Every prepared track has an audio file and feature JSON | satisfied |
| AI source separation pipeline | Prepared feature files are generated from the Demucs/librosa pipeline | satisfied |
| Silent-view readability | Motion profiles derive beat-locked, bass-dominant, harmonic-flow, and organic behavior from stem features plus visual profile priors | improved; still needs live demo validation |
| Static deployment | Feature JSON and MP3 files are loaded directly by the browser; no backend server is required for the deployed demo | satisfied |

## Prepared Track Coverage

| Track | Visual profile | Motion behavior | Duration | Frames | Assets |
| --- | --- | --- | ---: | ---: | --- |
| Bass Track | bass-heavy | bass-dominant | 0:57 | 4886 | yes |
| Tau mich auf | party | beat-locked | 0:27 | 2364 | yes |
| Innerbloom | melodic | harmonic-flow | 1:36 | 8252 | yes |
| Heartless | hip-hop | bass-dominant | 3:41 | 19013 | yes |
| Dracula | melodic | harmonic-flow | 3:53 | 20103 | yes |
| Outro | cinematic | harmonic-flow | 1:19 | 6791 | yes |
| The Mountain | cinematic | harmonic-flow | 2:02 | 10513 | yes |

## Motion Profile Interpretation

- **Beat-locked**: short, sharp particle bursts; tighter camera/lighting response.
- **Bass-dominant**: stronger low-frequency shockwave scale and opacity.
- **Harmonic-flow**: longer ribbon trails and more persistent harmonic cloud motion.
- **Organic/balanced**: softer timing and less grid-locked movement.

## What This Adds Beyond The June Report

- The June report described a single-track static demo. The current prototype
  supports a prepared multi-track library.
- The June report described color and stem-specific mapping. The current
  prototype adds feature-derived motion behavior, which addresses the instructor
  feedback that viewers should infer the music character even without audio.
- The June report's evaluation is still useful as a source-separation example,
  but final evaluation should present it as an example track and add this
  multi-track/motion-profile coverage report.

## Remaining Final-Demo Risks

- The motion behavior is a hybrid system: each prepared track has a visual
  profile label, then extracted audio features modulate the final movement.
- The browser demo does not yet run Demucs for arbitrary uploaded songs live.
  New songs must be prepared offline with `prepare_tracks.py`.
- The final presentation should explicitly show at least two contrasting tracks:
  one beat-heavy/party track and one harmonic/cinematic/piano track.
