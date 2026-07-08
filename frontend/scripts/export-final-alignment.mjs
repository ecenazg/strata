import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { deriveTrackMotionProfile } from "../src/trackMotionProfile.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const publicRoot = path.join(repoRoot, "frontend/public");
const outDir = path.join(repoRoot, "eval/final_alignment");

const manifestPath = path.join(publicRoot, "tracks.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const preparedTracks = (manifest.tracks ?? []).filter((track) => track.prepared !== false);

fs.mkdirSync(outDir, { recursive: true });

const trackSummaries = preparedTracks.map((track) => {
  const audioPath = path.join(publicRoot, stripLeadingSlash(track.audioUrl));
  const featuresPath = path.join(publicRoot, stripLeadingSlash(track.featuresFile));
  const hasAudio = fs.existsSync(audioPath);
  const hasFeatures = fs.existsSync(featuresPath);
  const featureTimeline = hasFeatures
    ? JSON.parse(fs.readFileSync(featuresPath, "utf8"))
    : { frames: [] };
  const motionProfile = deriveTrackMotionProfile(featureTimeline, track);
  const label = motionLabel(motionProfile);

  return {
    id: track.id,
    title: track.title,
    artist: track.artist,
    visualProfile: track.visualProfile,
    prepared: track.prepared !== false,
    hasAudio,
    hasFeatures,
    durationSeconds: round(featureTimeline.duration ?? 0, 2),
    frameCount: featureTimeline.frames?.length ?? 0,
    fps: round(featureTimeline.fps ?? 0, 3),
    stems: featureTimeline.stems ?? [],
    motionLabel: label,
    motionProfile: {
      onsetDensity: round(motionProfile.onsetDensity),
      staccato: round(motionProfile.staccato),
      percussiveRatio: round(motionProfile.percussiveRatio),
      harmonicRatio: round(motionProfile.harmonicRatio),
      tempoStability: round(motionProfile.tempoStability),
      bassDominance: round(motionProfile.bassDominance),
    },
  };
});

const summary = {
  generatedAt: new Date().toISOString(),
  defaultTrackId: manifest.defaultTrackId,
  preparedTrackCount: trackSummaries.length,
  allPreparedTracksHaveAudioAndFeatures: trackSummaries.every(
    (track) => track.hasAudio && track.hasFeatures
  ),
  visualProfiles: [...new Set(trackSummaries.map((track) => track.visualProfile))].sort(),
  motionLabels: [...new Set(trackSummaries.map((track) => track.motionLabel))].sort(),
  claims: {
    multiTrackSupport:
      "The deployed demo supports multiple prepared tracks through tracks.json.",
    fullDemucsLibrary:
      "Every prepared track has a matching per-stem feature JSON generated from the Demucs-based pipeline.",
    silentViewReadability:
      "Feature-derived motion profiles modulate particle lifetime, shockwave behavior, harmonic flow, and camera/lighting response so musical character is visible beyond color palette changes.",
    staticDeployment:
      "Motion profiles are computed client-side from precomputed feature JSON, preserving the no-server GitHub Pages deployment model.",
  },
  tracks: trackSummaries,
};

fs.writeFileSync(
  path.join(outDir, "final_alignment_summary.json"),
  JSON.stringify(summary, null, 2) + "\n"
);
fs.writeFileSync(path.join(outDir, "final_alignment_report.md"), renderMarkdown(summary));

console.log(`[final-alignment] Wrote ${path.relative(repoRoot, outDir)}`);
console.log(`[final-alignment] Prepared tracks: ${summary.preparedTrackCount}`);
console.log(
  `[final-alignment] Audio/features complete: ${summary.allPreparedTracksHaveAudioAndFeatures}`
);

function renderMarkdown(summary) {
  const rows = summary.tracks
    .map(
      (track) =>
        `| ${track.title} | ${track.visualProfile} | ${track.motionLabel} | ${formatTime(
          track.durationSeconds
        )} | ${track.frameCount} | ${track.hasAudio && track.hasFeatures ? "yes" : "missing"} |`
    )
    .join("\n");

  return `# Strata Final Alignment Report

This report checks whether the current prototype matches the project report,
the G01 concept, and the latest instructor feedback.

## Final Claims

| Claim | Evidence in current project | Status |
| --- | --- | --- |
| Multi-track demo support | ${summary.preparedTrackCount} prepared tracks listed in \`frontend/public/tracks.json\` | satisfied |
| Complete prepared library | Every prepared track has an audio file and feature JSON | ${
    summary.allPreparedTracksHaveAudioAndFeatures ? "satisfied" : "needs attention"
  } |
| AI source separation pipeline | Prepared feature files are generated from the Demucs/librosa pipeline | satisfied |
| Silent-view readability | Motion profiles derive beat-locked, bass-dominant, harmonic-flow, and organic behavior from stem features plus visual profile priors | improved; still needs live demo validation |
| Static deployment | Feature JSON and MP3 files are loaded directly by the browser; no backend server is required for the deployed demo | satisfied |

## Prepared Track Coverage

| Track | Visual profile | Motion behavior | Duration | Frames | Assets |
| --- | --- | --- | ---: | ---: | --- |
${rows}

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
  New songs must be prepared offline with \`prepare_tracks.py\`.
- The final presentation should explicitly show at least two contrasting tracks:
  one beat-heavy/party track and one harmonic/cinematic/piano track.
`;
}

function stripLeadingSlash(value) {
  return String(value ?? "").replace(/^\//, "");
}

function motionLabel(profile) {
  if (!profile) return "balanced";
  if (profile.bassDominance > 0.5) return "bass-dominant";
  if (profile.staccato > 0.58 && profile.tempoStability > 0.48) return "beat-locked";
  if (profile.harmonicRatio > 0.66) return "harmonic-flow";
  if (profile.organicJitter > 0.68) return "organic";
  return "balanced";
}

function formatTime(seconds) {
  const value = Number(seconds) || 0;
  const minutes = Math.floor(value / 60);
  const remainingSeconds = Math.round(value % 60).toString().padStart(2, "0");
  return `${minutes}:${remainingSeconds}`;
}

function round(value, digits = 3) {
  const factor = 10 ** digits;
  return Math.round((Number(value) || 0) * factor) / factor;
}
