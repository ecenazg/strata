const STEM_ORDER = ["bass", "drums", "melody", "harmony"];

const BASE_PROFILE = {
  id: "cinematic",
  label: "Cinematic",
  description: "Balanced source-separation palette for the default STRATA scene.",
  colors: {
    background: 0x080b14,
    ambient: 0x7d91ff,
    keyLight: 0xd8f3ff,
    warmLight: 0xffcc82,
    coolLight: 0x5ee7ff,
    core: 0xffd68a,
    flashWarm: "255, 207, 122",
    flashCool: "76, 201, 255",
    stars: [0x8bdcff, 0xffd28a, 0xc7a7ff],
    stage: [0x5ee7ff, 0xffc874],
    incoming: 0xffd68a,
    stems: {
      bass: 0x4cc9ff,
      drums: 0xffcf7a,
      melody: 0x6dff8f,
      harmony: 0xba7cff,
    },
    bass: {
      floor: 0x0b56ff,
      rings: [0x0b7cff, 0x4cc9ff, 0x0b7cff],
    },
    drums: {
      particles: 0xffcf7a,
    },
    melody: {
      primary: 0x6dff8f,
      echo: 0xd8ff7a,
    },
    harmony: {
      rings: [0x7c4dff, 0xba7cff, 0x7c4dff],
      cloud: [0x7c4dff, 0xba7cff, 0xff9cff],
    },
  },
  motion: {
    beatFlash: 1,
    bloomBase: 0.68,
    bloomBeat: 0.62,
    cameraPunch: 1,
    bassScale: 1,
    bassIntensity: 1,
    drumSize: 1,
    melodyGlow: 1,
    harmonyMist: 1,
  },
  minimumMix: {
    bass: 0,
    drums: 0,
    melody: 0,
    harmonic: 0,
  },
};

export const VISUAL_PROFILES = {
  cinematic: BASE_PROFILE,
  party: mergeProfile(BASE_PROFILE, {
    id: "party",
    label: "Party / beat-heavy",
    description: "High contrast neon palette for tracks driven by rhythm and dance energy.",
    colors: {
      background: 0x050712,
      ambient: 0x5a4dff,
      keyLight: 0xffffff,
      warmLight: 0xff2ec4,
      coolLight: 0x00f5ff,
      core: 0xfff06a,
      flashWarm: "255, 46, 196",
      flashCool: "0, 245, 255",
      stars: [0x00f5ff, 0xff2ec4, 0xfff06a],
      stage: [0x00b7ff, 0xff2ec4],
      incoming: 0xfff06a,
      stems: {
        bass: 0x00b7ff,
        drums: 0xfff06a,
        melody: 0x00ff9c,
        harmony: 0xff4dff,
      },
      bass: {
        floor: 0x003dff,
        rings: [0x008cff, 0x00f5ff, 0x0055ff],
      },
      drums: {
        particles: 0xfff06a,
      },
      melody: {
        primary: 0x00ff9c,
        echo: 0xf9ff6a,
      },
      harmony: {
        rings: [0x8138ff, 0xff4dff, 0x00f5ff],
        cloud: [0x8138ff, 0xff4dff, 0xfff06a],
      },
    },
    motion: {
      beatFlash: 1.35,
      bloomBase: 0.82,
      bloomBeat: 0.95,
      cameraPunch: 1.28,
      bassScale: 1.18,
      bassIntensity: 1.18,
      drumSize: 1.22,
      melodyGlow: 1.08,
      harmonyMist: 0.92,
    },
    minimumMix: {
      bass: 0.28,
      drums: 0.42,
    },
  }),
  melodic: mergeProfile(BASE_PROFILE, {
    id: "melodic",
    label: "Melodic / harmonic",
    description: "Soft romantic palette for smoother melodic or harmonic material.",
    colors: {
      background: 0x090a18,
      ambient: 0x9b87ff,
      keyLight: 0xffedf5,
      warmLight: 0xff9ab8,
      coolLight: 0x8fd7ff,
      core: 0xffc6a8,
      flashWarm: "255, 154, 184",
      flashCool: "143, 215, 255",
      stars: [0x8fd7ff, 0xffb8d2, 0xc7a7ff],
      stage: [0x8fd7ff, 0xffb8d2],
      incoming: 0xffc6a8,
      stems: {
        bass: 0x79bfff,
        drums: 0xffc27a,
        melody: 0xb8ffce,
        harmony: 0xd6a2ff,
      },
      bass: {
        floor: 0x3155c7,
        rings: [0x6bb7ff, 0x9fd8ff, 0x6687ff],
      },
      drums: {
        particles: 0xffc27a,
      },
      melody: {
        primary: 0xb8ffce,
        echo: 0xffd2df,
      },
      harmony: {
        rings: [0xa47cff, 0xd6a2ff, 0xffb8d2],
        cloud: [0xa47cff, 0xd6a2ff, 0xffb8d2],
      },
    },
    motion: {
      beatFlash: 0.72,
      bloomBase: 0.62,
      bloomBeat: 0.42,
      cameraPunch: 0.72,
      bassScale: 0.82,
      bassIntensity: 0.82,
      drumSize: 0.76,
      melodyGlow: 1.28,
      harmonyMist: 1.3,
    },
    minimumMix: {
      melody: 0.42,
      harmonic: 0.48,
    },
  }),
  "bass-heavy": mergeProfile(BASE_PROFILE, {
    id: "bass-heavy",
    label: "Bass-heavy club",
    description: "Deep low-frequency palette for dark club tracks with dominant bass.",
    colors: {
      background: 0x030711,
      ambient: 0x274dff,
      keyLight: 0xaedfff,
      warmLight: 0xff365e,
      coolLight: 0x1c7cff,
      core: 0xff365e,
      flashWarm: "255, 54, 94",
      flashCool: "28, 124, 255",
      stars: [0x1c7cff, 0xff365e, 0x7d4dff],
      stage: [0x005dff, 0xff365e],
      incoming: 0xff365e,
      stems: {
        bass: 0x1c7cff,
        drums: 0xffb000,
        melody: 0x4dffc4,
        harmony: 0x9a6cff,
      },
      bass: {
        floor: 0x001eff,
        rings: [0x005dff, 0x1c7cff, 0x0038b8],
      },
      drums: {
        particles: 0xffb000,
      },
      melody: {
        primary: 0x4dffc4,
        echo: 0x8dffea,
      },
      harmony: {
        rings: [0x512cff, 0x9a6cff, 0xff365e],
        cloud: [0x512cff, 0x9a6cff, 0xff365e],
      },
    },
    motion: {
      beatFlash: 1.12,
      bloomBase: 0.74,
      bloomBeat: 0.74,
      cameraPunch: 1.38,
      bassScale: 1.72,
      bassIntensity: 1.85,
      drumSize: 0.94,
      melodyGlow: 0.88,
      harmonyMist: 0.86,
    },
    minimumMix: {
      bass: 0.62,
    },
  }),
};

export const DEFAULT_VISUAL_PROFILE = VISUAL_PROFILES.cinematic;

export function resolveVisualProfile(track) {
  const profileId = track?.visualProfile ?? track?.mood ?? "cinematic";
  return VISUAL_PROFILES[profileId] ?? VISUAL_PROFILES.cinematic;
}

export function stemColorCss(profile, stem) {
  return `#${profile.colors.stems[stem].toString(16).padStart(6, "0")}`;
}

export function orderedStemColors(profile) {
  return Object.fromEntries(STEM_ORDER.map((stem) => [stem, stemColorCss(profile, stem)]));
}

function mergeProfile(base, override) {
  return {
    ...base,
    ...override,
    colors: {
      ...base.colors,
      ...override.colors,
      stems: {
        ...base.colors.stems,
        ...override.colors?.stems,
      },
      bass: {
        ...base.colors.bass,
        ...override.colors?.bass,
      },
      drums: {
        ...base.colors.drums,
        ...override.colors?.drums,
      },
      melody: {
        ...base.colors.melody,
        ...override.colors?.melody,
      },
      harmony: {
        ...base.colors.harmony,
        ...override.colors?.harmony,
      },
    },
    motion: {
      ...base.motion,
      ...override.motion,
    },
    minimumMix: {
      ...base.minimumMix,
      ...override.minimumMix,
    },
  };
}
