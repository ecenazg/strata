const STEMS = ["bass", "drums", "melody", "harmonic"];
const DEFAULT_MOTION_PROFILE = {
  onsetDensity: 0.45,
  staccato: 0.45,
  percussiveRatio: 0.35,
  harmonicRatio: 0.65,
  tempoStability: 0.45,
  organicJitter: 0.55,
  bassDominance: 0.35,
  dynamicRange: {
    bass: 0.45,
    drums: 0.45,
    melody: 0.45,
    harmonic: 0.45,
  },
};

const MOTION_PRIORS = {
  party: {
    onsetDensity: 0.94,
    staccato: 0.98,
    percussiveRatio: 0.86,
    harmonicRatio: 0.42,
    tempoStability: 0.9,
    bassDominance: 0.32,
  },
  "hip-hop": {
    onsetDensity: 0.68,
    staccato: 0.78,
    percussiveRatio: 0.78,
    harmonicRatio: 0.46,
    tempoStability: 0.7,
    bassDominance: 0.58,
  },
  "bass-heavy": {
    onsetDensity: 0.72,
    staccato: 0.74,
    percussiveRatio: 0.86,
    harmonicRatio: 0.3,
    tempoStability: 0.58,
    bassDominance: 0.98,
  },
  melodic: {
    onsetDensity: 0.26,
    staccato: 0.14,
    percussiveRatio: 0.18,
    harmonicRatio: 0.94,
    tempoStability: 0.42,
    bassDominance: 0.24,
  },
  cinematic: {
    onsetDensity: 0.12,
    staccato: 0.06,
    percussiveRatio: 0.12,
    harmonicRatio: 0.96,
    tempoStability: 0.16,
    bassDominance: 0.26,
  },
};

export function deriveTrackMotionProfile(featureTimeline, track = null) {
  const frames = featureTimeline?.frames ?? [];
  const duration = Number(featureTimeline?.duration) || frames.at(-1)?.t || 1;
  if (!frames.length) return DEFAULT_MOTION_PROFILE;

  const drumOnsets = series(frames, "drums", "onset");
  const bassOnsets = series(frames, "bass", "onset");
  const combinedOnsets = frames.map((frame) =>
    Math.max(...STEMS.map((stem) => frame?.[stem]?.onset ?? 0))
  );

  const strongDrumHits = countStrongEvents(drumOnsets);
  const strongCombinedHits = countStrongEvents(combinedOnsets);
  const densityPerSecond =
    (strongDrumHits * 0.72 + strongCombinedHits * 0.28) / Math.max(1, duration);

  const onsetSharpness = normalizedSpread(drumOnsets) * 0.68 + normalizedSpread(bassOnsets) * 0.32;
  const onsetDensity = clamp01((densityPerSecond - 1.4) / 10.5);
  const staccato = clamp01(onsetDensity * 0.66 + onsetSharpness * 0.34);

  const energies = Object.fromEntries(
    STEMS.map((stem) => [stem, mean(series(frames, stem, "rms"))])
  );
  const transientEnergy = mean(drumOnsets) + mean(bassOnsets) * 0.42;
  const percussiveEnergy = energies.drums * 1.2 + transientEnergy * 0.75 + energies.bass * 0.42;
  const harmonicEnergy = energies.harmonic * 1.15 + energies.melody * 0.95;
  const totalMusicalEnergy = percussiveEnergy + harmonicEnergy + 1e-6;

  const percussiveRatio = clamp01(percussiveEnergy / totalMusicalEnergy);
  const harmonicRatio = clamp01(harmonicEnergy / totalMusicalEnergy);
  const bassDominance = clamp01(energies.bass / (energies.bass + energies.drums + energies.melody + energies.harmonic + 1e-6));
  const tempoStability = deriveTempoStability(frames);
  const prior = MOTION_PRIORS[track?.visualProfile] ?? null;
  const priorWeight = prior ? 0.62 : 0;
  const tunedOnsetDensity = mix(onsetDensity, prior?.onsetDensity, priorWeight);
  const tunedStaccato = mix(staccato, prior?.staccato, priorWeight);
  const tunedPercussive = mix(percussiveRatio, prior?.percussiveRatio, priorWeight);
  const tunedHarmonic = mix(harmonicRatio, prior?.harmonicRatio, priorWeight);
  const tunedTempoStability = mix(tempoStability, prior?.tempoStability, priorWeight);
  const tunedBassDominance = mix(bassDominance, prior?.bassDominance, priorWeight);

  return {
    onsetDensity: tunedOnsetDensity,
    staccato: tunedStaccato,
    percussiveRatio: tunedPercussive,
    harmonicRatio: tunedHarmonic,
    tempoStability: tunedTempoStability,
    organicJitter: clamp01(1 - tunedTempoStability),
    bassDominance: tunedBassDominance,
    dynamicRange: Object.fromEntries(
      STEMS.map((stem) => [stem, normalizedSpread(series(frames, stem, "rms"))])
    ),
    debug: {
      densityPerSecond: round(densityPerSecond),
      onsetSharpness: round(onsetSharpness),
      percussiveRatio: round(tunedPercussive),
      harmonicRatio: round(tunedHarmonic),
      tempoStability: round(tunedTempoStability),
      bassDominance: round(tunedBassDominance),
      visualPrior: track?.visualProfile ?? "none",
    },
  };
}

function deriveTempoStability(frames) {
  const beatTimes = frames
    .filter((frame) => frame?.drums?.beat_phase === 1.0 || frame?.bass?.beat_phase === 1.0)
    .map((frame) => frame.t);
  const intervals = [];

  for (let i = 1; i < beatTimes.length; i++) {
    const interval = beatTimes[i] - beatTimes[i - 1];
    if (interval > 0.18 && interval < 2.4) intervals.push(interval);
  }

  if (intervals.length < 3) return 0.35;
  const intervalMean = mean(intervals);
  const cv = standardDeviation(intervals) / Math.max(0.001, intervalMean);
  return clamp01(1 - cv / 0.38);
}

function countStrongEvents(values) {
  const threshold = quantile(values, 0.72) + normalizedSpread(values) * 0.18;
  let count = 0;
  let wasHigh = false;

  for (const value of values) {
    const high = value > threshold;
    if (high && !wasHigh) count += 1;
    wasHigh = high;
  }

  return count;
}

function series(frames, stem, key) {
  return frames.map((frame) => Number(frame?.[stem]?.[key]) || 0);
}

function normalizedSpread(values) {
  const low = quantile(values, 0.12);
  const mid = quantile(values, 0.5);
  const high = quantile(values, 0.92);
  return clamp01((high - low) / Math.max(0.08, high + mid + 1e-6));
}

function quantile(values, q) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * q)));
  return sorted[index];
}

function mean(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardDeviation(values) {
  if (values.length < 2) return 0;
  const valueMean = mean(values);
  const variance = mean(values.map((value) => (value - valueMean) ** 2));
  return Math.sqrt(variance);
}

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function mix(value, priorValue, weight) {
  if (priorValue === undefined || priorValue === null) return clamp01(value);
  return clamp01(value * (1 - weight) + priorValue * weight);
}

function round(value) {
  return Math.round(value * 1000) / 1000;
}
