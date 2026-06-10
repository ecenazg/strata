import { SceneManager } from "./SceneManager.js";
import { AudioSyncManager } from "./AudioSyncManager.js";
import { BassShockwave } from "./visualizers/BassShockwave.js";
import { MelodyRibbon } from "./visualizers/MelodyRibbon.js";
import { DrumParticles } from "./visualizers/DrumParticles.js";
import { HarmonicCloud } from "./visualizers/HarmonicCloud.js";
import { orderedStemColors, resolveVisualProfile } from "./visualProfiles.js";
import GUI from "lil-gui";
import "./style.css";

/**
 * Resolves a path against Vite's BASE_URL so assets work on GitHub Pages
 * sub-paths (e.g. /strata/) as well as the local dev server (/).
 */
function resolveAssetUrl(path) {
  const base = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
  return base + (path.startsWith("/") ? path : "/" + path);
}

const sceneManager = new SceneManager();
const overlay = createCinematicOverlay();
let activeVisualProfile = resolveVisualProfile(null);

const bassVisualizer = new BassShockwave(sceneManager.scene);
bassVisualizer.mesh.position.set(0, -1.45, -1.3);

const melodyVisualizer = new MelodyRibbon(sceneManager.scene);
melodyVisualizer.line.position.set(0, 0.45, -1.65);

const drumVisualizer = new DrumParticles(sceneManager.scene);
drumVisualizer.points.position.set(0, 0.95, -2.15);

const harmonicVisualizer = new HarmonicCloud(sceneManager.scene);
harmonicVisualizer.group.position.set(0, 1.35, -3.25);
harmonicVisualizer.group.scale.setScalar(0.62);
applyVisualProfile(activeVisualProfile);

const gui = new GUI({ title: "Strata Kontrol Merkezi" });
gui.domElement.classList.add("debug-panel");
gui.domElement.style.display = "none";

const layers = {
  bass: true,
  melody: true,
  drums: true,
  harmonic: true,
};

// Katman Kontrolleri Klasörü
const fLayers = gui.addFolder("Enstrüman Katmanları");
fLayers
  .add(layers, "bass")
  .name("Bass (Şok Dalgası)")
  .onChange((v) => (bassVisualizer.mesh.visible = v));
fLayers
  .add(layers, "melody")
  .name("Melody (Şerit)")
  .onChange((v) => (melodyVisualizer.line.visible = v));
fLayers
  .add(layers, "drums")
  .name("Drums (Parçacık)")
  .onChange((v) => (drumVisualizer.points.visible = v));
fLayers
  .add(layers, "harmonic")
  .name("Harmonic (Bulut)")
  .onChange((v) => (harmonicVisualizer.group.visible = v));

// --- VİDEO DIŞA AKTARIM (EXPORT) SİSTEMİ ---
const fExport = gui.addFolder("Video Kayıt Sistemi");
let mediaRecorder;
let recordedChunks = [];
let isRecording = false;

const recorderControls = {
  recordToggle: () => {
    if (!isRecording) {
      recordedChunks = [];
      const stream = sceneManager.renderer.domElement.captureStream(60);
      const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
        ? "video/webm;codecs=vp9"
        : "video/webm";

      mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 7000000,
      });

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunks.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunks, { type: "video/webm" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Strata_Visualizer_Export.webm`;
        a.click();
        URL.revokeObjectURL(url);
        overlay.state.textContent = "recording saved";
      };

      mediaRecorder.start();
      isRecording = true;
      document.body.classList.add("is-recording");
      overlay.state.textContent = "recording";
      btnRecord.name("🔴 Kaydı Durdur ve İndir");
      console.log("Video kaydı başladı...");
    } else {
      mediaRecorder.stop();
      isRecording = false;
      document.body.classList.remove("is-recording");
      overlay.state.textContent = "recording export";
      btnRecord.name("🎬 Video Kaydını Başlat");
      console.log("Video kaydı durduruldu, dosya hazırlanıyor...");
    }
  },
};

const btnRecord = fExport
  .add(recorderControls, "recordToggle")
  .name("🎬 Video Kaydını Başlat");
// --------------------------------------------

let latestFrame = null;
let activePhase = "opening";
let previousPhase = "opening";
let availableTracks = [];
let selectedTrack = null;

const onFrameReceived = (frameData) => {
  latestFrame = frameData;
  activePhase = getDemoPhase(frameData.t, audioManager.duration);
  const progress = getProgress(frameData.t, audioManager.duration);
  sceneManager.setPhase(activePhase);
  if (activePhase !== previousPhase) {
    overlay.root.classList.remove("phase-pulse");
    void overlay.root.offsetWidth;
    overlay.root.classList.add("phase-pulse");
    document.body.dataset.phase = activePhase;
    previousPhase = activePhase;
  }
  overlay.phase.textContent = phaseLabel(activePhase);
  overlay.state.textContent = "feature stream active";
  overlay.progress.style.transform = `scaleX(${progress})`;
  overlay.progressTrack.setAttribute("aria-valuenow", Math.round(progress * 100));
  overlay.closing.hidden = activePhase !== "closing";

  if (layers.bass) bassVisualizer.update(frameData.bass);
  if (layers.melody) melodyVisualizer.update(frameData.melody);
  if (layers.drums) drumVisualizer.update(frameData.drums);
  if (layers.harmonic) harmonicVisualizer.update(frameData.harmonic);

  applyPhaseMix(activePhase);
};

const onPlaybackEnded = () => {
  resetPlaybackVisualState("click to replay", "ready for replay");
};

function resetPlaybackVisualState(stateText = "track ready", phaseText = "opening sequence") {
  activePhase = "opening";
  previousPhase = "opening";
  latestFrame = null;
  sceneManager.setPhase("opening");
  applyPhaseMix("opening");
  document.body.classList.remove("is-playing", "phase-pulse");
  document.body.dataset.phase = "opening";
  overlay.closing.hidden = true;
  overlay.phase.textContent = phaseText;
  overlay.state.textContent = stateText;
  overlay.progress.style.transform = "scaleX(0)";
  overlay.progressTrack.setAttribute("aria-valuenow", "0");
}

const audioManager = new AudioSyncManager(onFrameReceived, onPlaybackEnded);
loadTrackManifest();

window.strataDemo = {
  play: () => audioManager.play(),
  pause: () => audioManager.pause(),
  seek: (timeSeconds) => audioManager.seek(timeSeconds),
  toggle: () => audioManager.togglePlayback(),
  tracks: () => availableTracks,
  selectTrack: (trackId) => selectTrackById(trackId),
};

let isScrubbing = false;

const seekFromPointer = (event) => {
  const rect = overlay.progressTrack.getBoundingClientRect();
  const ratio = (event.clientX - rect.left) / rect.width;
  seekToRatio(ratio);
};

overlay.progressTrack.addEventListener("pointerdown", (event) => {
  event.stopPropagation();
  isScrubbing = true;
  overlay.progressTrack.setPointerCapture(event.pointerId);
  seekFromPointer(event);
});

overlay.progressTrack.addEventListener("pointermove", (event) => {
  if (!isScrubbing) return;
  event.stopPropagation();
  seekFromPointer(event);
});

overlay.progressTrack.addEventListener("pointerup", (event) => {
  event.stopPropagation();
  isScrubbing = false;
  overlay.progressTrack.releasePointerCapture(event.pointerId);
});

window.addEventListener("click", (e) => {
  if (e.target.closest(".lil-gui, .progress-track, .track-picker, .info-panel, .info-toggle, .info-close")) return;

  const isPlaying = audioManager.togglePlayback();

  if (isPlaying) {
    console.log("Tıklandı, müzik başlatılıyor...");
    document.body.classList.add("is-playing");
    overlay.state.textContent = "playback started";
  } else {
    console.log("Tıklandı, müzik duraklatılıyor...");
    document.body.classList.remove("is-playing");
    overlay.state.textContent = "playback paused";
  }
});

overlay.infoToggle.addEventListener("click", toggleInfoPanel);
overlay.infoClose.addEventListener("click", () => { overlay.infoPanel.hidden = true; });

window.addEventListener("keydown", (e) => {
  const key = e.key.toLowerCase();

  if (key === "i") {
    toggleInfoPanel();
    return;
  }

  if (key === "g") {
    const hidden = gui.domElement.style.display === "none";
    gui.domElement.style.display = hidden ? "block" : "none";
  }

  if (key === "r") {
    recorderControls.recordToggle();
  }

  if (key === "arrowright" || key === "arrowleft") {
    e.preventDefault();
    const jump = key === "arrowright" ? 10 : -10;
    seekToTime(audioManager.audio.currentTime + jump);
  }
});

function animate(now = 0) {
  requestAnimationFrame(animate);
  const elapsed = now * 0.001;
  sceneManager.update(elapsed, latestFrame);
  sceneManager.render();
}
animate();

function createCinematicOverlay() {
  const root = document.createElement("div");
  root.className = "cinematic-overlay";
  root.innerHTML = `
    <div class="phase-label">
      <span class="phase-dot"></span>
      <span data-phase>opening sequence</span>
    </div>
    <section class="title-lockup" aria-label="Strata title">
      <p class="eyebrow">AI-driven source separation</p>
      <h1>STRATA</h1>
      <p class="subtitle">Hidden orchestral layers translated into a cinematic real-time 3D music visualisation.</p>
    </section>
    <div class="track-info" data-track-info>
      <p class="track-name" data-track-name></p>
      <p class="track-artist" data-track-artist></p>
    </div>
    <div class="audio-state" data-state>waiting for feature stream</div>
    <div class="stem-legend" aria-label="Stem colour legend">
      <span class="legend-item bass"><i></i>Bass</span>
      <span class="legend-item drums"><i></i>Drums</span>
      <span class="legend-item melody"><i></i>Melody</span>
      <span class="legend-item harmony"><i></i>Harmony</span>
    </div>
    <div class="track-picker" data-track-picker>
      <label for="track-select">Track</label>
      <select id="track-select" data-track-select aria-label="Demo track"></select>
      <span class="visual-profile" data-profile>cinematic</span>
      <span data-track-status>loading tracks</span>
    </div>
    <div
      class="progress-track"
      data-seek-track
      role="slider"
      aria-label="Song position"
      aria-valuemin="0"
      aria-valuemax="100"
      aria-valuenow="0"
      tabindex="0"
    ><span data-progress></span></div>
    <section class="closing-lockup" data-closing hidden>
      <p class="eyebrow">AI source separation</p>
      <h2>Real-time 3D music visualisation</h2>
    </section>

    <!-- Genre transition banner — appears briefly on track switch -->
    <div class="profile-banner" data-profile-banner>
      <p class="profile-banner-name" data-profile-banner-name></p>
      <p class="profile-banner-desc" data-profile-banner-desc></p>
    </div>

    <!-- Info toggle button -->
    <button class="info-toggle" data-info-toggle aria-label="Toggle system info">INFO</button>

    <!-- Info panel -->
    <div class="info-panel" data-info-panel hidden>
      <button class="info-close" data-info-close aria-label="Close info">✕</button>
      <div class="info-scroll">
        <div class="info-header">
          <span class="info-eyebrow">Prototype · Intermediate Status</span>
          <h2 class="info-heading">STRATA</h2>
          <p class="info-sub">AI-driven source separation translated into a cinematic real-time 3D music visualisation</p>
        </div>

        <div class="info-pipeline">
          <div class="pipeline-step step-active"><span class="pip-label">MP3</span><span class="pip-desc">audio input</span></div>
          <span class="pip-arrow">→</span>
          <div class="pipeline-step step-active"><span class="pip-label">HPSS</span><span class="pip-desc">librosa · ~60 s/track · CPU</span></div>
          <span class="pip-arrow">→</span>
          <div class="pipeline-step step-planned"><span class="pip-label">Demucs</span><span class="pip-desc">htdemucs · GPU · planned</span></div>
          <span class="pip-arrow">→</span>
          <div class="pipeline-step step-active"><span class="pip-label">Features</span><span class="pip-desc">RMS · onset · chroma · beat</span></div>
          <span class="pip-arrow">→</span>
          <div class="pipeline-step step-active"><span class="pip-label">Three.js</span><span class="pip-desc">4 live 3D visualisers · 60 fps</span></div>
        </div>

        <div class="info-cols">
          <div class="info-section">
            <h3 class="info-section-title">Currently Working</h3>
            <ul class="info-list">
              <li class="info-item info-done">7 tracks spanning 4 genres — hip-hop, psychedelic rock, cinematic/electronic, solo piano</li>
              <li class="info-item info-done">HPSS source separation: harmonic + percussive split, ~60 fps feature frames</li>
              <li class="info-item info-done">Per-stem features: RMS energy, onset strength, spectral centroid, chroma[12], beat phase</li>
              <li class="info-item info-done">4 independent 3D visualisers each driven by a dedicated stem</li>
              <li class="info-item info-done">5 genre visual profiles — colour palette, motion multipliers, minimum-mix floor</li>
              <li class="info-item info-done">8-phase system — progressive layer introduction across track duration</li>
              <li class="info-item info-done">Beat-flash overlay + chroma-reactive CSS variables across the full UI</li>
              <li class="info-item info-done">Track info + artist overlay fades in during playback</li>
              <li class="info-item info-done">Progress bar scrubbing + ← → keyboard seek</li>
              <li class="info-item info-done">Video export — WebM 60 fps via MediaRecorder API</li>
              <li class="info-item info-done">Static deployment on GitHub Pages — no server or WebSocket required</li>
            </ul>
          </div>
          <div class="info-section">
            <h3 class="info-section-title">Visual Layer Mapping</h3>
            <div class="layer-grid">
              <div class="layer-row layer-bass"><span class="layer-dot"></span><strong>Bass</strong><span>BassShockwave rings — RMS-driven radius &amp; opacity</span></div>
              <div class="layer-row layer-drums"><span class="layer-dot"></span><strong>Drums</strong><span>DrumParticles — burst on onset transients, beat-phase scale</span></div>
              <div class="layer-row layer-melody"><span class="layer-dot"></span><strong>Melody</strong><span>MelodyRibbon polyline — pitch &amp; chroma deformation</span></div>
              <div class="layer-row layer-harmonic"><span class="layer-dot"></span><strong>Harmony</strong><span>HarmonicCloud icosphere — chroma energy rotation</span></div>
            </div>

            <h3 class="info-section-title" style="margin-top:22px">Planned Extensions</h3>
            <ul class="info-list">
              <li class="info-item info-plan">Full Demucs htdemucs — true vocals / bass / drums / other stems via GPU server</li>
              <li class="info-item info-plan">Beat-synchronised camera choreography — orbital path + FOV punch</li>
              <li class="info-item info-plan">Mid-track chroma key shifts — scene colour follows harmonic progression</li>
              <li class="info-item info-plan">Vocal layer extraction + phoneme-level ribbon deformation</li>
              <li class="info-item info-plan">Live audio input mode — microphone / line-in with real-time HPSS</li>
            </ul>
          </div>
        </div>

        <div class="info-shortcuts">
          <span>I — toggle info</span>
          <span>Space / click — play / pause</span>
          <span>← → — seek ±10 s</span>
          <span>R — record video</span>
          <span>G — debug GUI</span>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(root);
  return {
    root,
    phase: root.querySelector("[data-phase]"),
    state: root.querySelector("[data-state]"),
    progress: root.querySelector("[data-progress]"),
    progressTrack: root.querySelector("[data-seek-track]"),
    closing: root.querySelector("[data-closing]"),
    trackPicker: root.querySelector("[data-track-picker]"),
    trackSelect: root.querySelector("[data-track-select]"),
    trackStatus: root.querySelector("[data-track-status]"),
    profile: root.querySelector("[data-profile]"),
    trackInfo: root.querySelector("[data-track-info]"),
    trackName: root.querySelector("[data-track-name]"),
    trackArtist: root.querySelector("[data-track-artist]"),
    infoPanel: root.querySelector("[data-info-panel]"),
    infoToggle: root.querySelector("[data-info-toggle]"),
    infoClose: root.querySelector("[data-info-close]"),
    profileBanner: root.querySelector("[data-profile-banner]"),
    profileBannerName: root.querySelector("[data-profile-banner-name]"),
    profileBannerDesc: root.querySelector("[data-profile-banner-desc]"),
  };
}

async function loadTrackManifest() {
  try {
    const response = await fetch(resolveAssetUrl("/tracks.json"), { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const manifest = await response.json();
    availableTracks = (manifest.tracks ?? []).filter((track) => track.prepared !== false);
    if (!availableTracks.length) {
      updateTrackStatus("no prepared tracks");
      overlay.trackSelect.disabled = true;
      return;
    }

    selectedTrack =
      availableTracks.find((track) => track.id === manifest.defaultTrackId) ??
      availableTracks[0];
    applyTrackVisualProfile(selectedTrack);
    populateTrackSelector();
    updateTrackStatus("loading...");
    try {
      await audioManager.setTrack({
        ...selectedTrack,
        audioUrl: resolveAssetUrl(selectedTrack.audioUrl),
        featuresFile: resolveAssetUrl(selectedTrack.featuresFile),
      });
      updateTrackStatus(`ready · ${formatTime(audioManager.duration)} · click to play`);
    } catch (err) {
      console.warn("[Strata] Features not yet extracted for:", selectedTrack.id, err.message);
      updateTrackStatus("features pending — run prepare_tracks.py");
    }
  } catch (error) {
    console.error("Could not load track manifest:", error);
    updateTrackStatus("track manifest missing");
    overlay.trackSelect.disabled = true;
  }
}

function populateTrackSelector() {
  overlay.trackSelect.innerHTML = "";
  for (const track of availableTracks) {
    const option = document.createElement("option");
    option.value = track.id;
    option.textContent = track.artist ? `${track.title} · ${track.artist}` : track.title;
    overlay.trackSelect.appendChild(option);
  }
  overlay.trackSelect.value = selectedTrack.id;
  overlay.trackSelect.addEventListener("change", () => {
    selectTrackById(overlay.trackSelect.value);
  });
}

async function selectTrackById(trackId) {
  const track = availableTracks.find((item) => item.id === trackId);
  if (!track) return;
  selectedTrack = track;
  applyTrackVisualProfile(track);
  showProfileBanner(activeVisualProfile);
  resetPlaybackVisualState("loading...", "opening sequence");
  try {
    await audioManager.setTrack({
      ...track,
      audioUrl: resolveAssetUrl(track.audioUrl),
      featuresFile: resolveAssetUrl(track.featuresFile),
    });
    updateTrackStatus(`ready · ${formatTime(audioManager.duration)} · click to play`);
  } catch (err) {
    console.warn("[Strata] Features not yet extracted for:", track.id, err.message);
    updateTrackStatus("features pending — run prepare_tracks.py");
  }
}

function updateTrackStatus(text) {
  overlay.trackStatus.textContent = text;
}

function applyTrackVisualProfile(track) {
  activeVisualProfile = resolveVisualProfile(track);
  applyVisualProfile(activeVisualProfile);
  overlay.profile.textContent = activeVisualProfile.label;
  if (overlay.trackName) overlay.trackName.textContent = track.title ?? "";
  if (overlay.trackArtist) overlay.trackArtist.textContent = track.artist ?? "";
}

function applyVisualProfile(profile) {
  sceneManager.applyVisualProfile(profile);
  bassVisualizer.applyVisualProfile(profile);
  drumVisualizer.applyVisualProfile(profile);
  melodyVisualizer.applyVisualProfile(profile);
  harmonicVisualizer.applyVisualProfile(profile);

  // Update stem colour CSS variables — drives legend dots, progress bar, phase-dot
  const stemColors = orderedStemColors(profile);
  for (const [stem, color] of Object.entries(stemColors)) {
    document.body.style.setProperty(`--stem-${stem}`, color);
  }

  // Update beat-flash overlay colours to match the active genre palette
  if (profile.colors.flashWarm) {
    document.body.style.setProperty("--profile-flash-warm", profile.colors.flashWarm);
  }
  if (profile.colors.flashCool) {
    document.body.style.setProperty("--profile-flash-cool", profile.colors.flashCool);
  }
}

function getDemoPhase(t = 0, duration = 0) {
  if (duration && t > duration - 8) return "closing";
  if (t < 4) return "opening";
  if (t < 8) return "separation";
  if (t < 16) return "bass";
  if (t < 24) return "drums";
  if (t < 32) return "melody";
  if (t < 40) return "harmony";
  return "combined";
}

function phaseLabel(phase) {
  const labels = {
    opening: "opening sequence",
    separation: "source separation",
    bass: "bass layer",
    drums: "drum transients",
    melody: "melody ribbon",
    harmony: "harmonic field",
    combined: "combined strata",
    closing: "closing sequence",
  };
  return labels[phase] ?? "strata";
}

function getProgress(t = 0, duration = 0) {
  if (!duration) return 0;
  return Math.max(0, Math.min(1, t / duration));
}

function seekToRatio(ratio) {
  const duration = audioManager.duration || audioManager.audio.duration || 0;
  if (!duration) return;
  seekToTime(duration * Math.max(0, Math.min(1, ratio)));
}

function seekToTime(timeSeconds) {
  const duration = audioManager.duration || audioManager.audio.duration || 0;
  if (!duration) return;

  const target = audioManager.seek(timeSeconds);
  const progress = getProgress(target, duration);
  activePhase = getDemoPhase(target, duration);
  previousPhase = activePhase;
  sceneManager.setPhase(activePhase);
  applyPhaseMix(activePhase);

  overlay.phase.textContent = phaseLabel(activePhase);
  overlay.state.textContent = `seek ${formatTime(target)} / ${formatTime(duration)}`;
  overlay.progress.style.transform = `scaleX(${progress})`;
  overlay.progressTrack.setAttribute("aria-valuenow", Math.round(progress * 100));
  overlay.closing.hidden = activePhase !== "closing";
}

function formatTime(timeSeconds) {
  const minutes = Math.floor(timeSeconds / 60);
  const seconds = Math.floor(timeSeconds % 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function toggleInfoPanel() {
  overlay.infoPanel.hidden = !overlay.infoPanel.hidden;
}

const PROFILE_DESCRIPTIONS = {
  "hip-hop":    "Punchy drums · amber & gold · soulful warmth",
  "cinematic":  "Orchestral sweep · cool blue · slow glide",
  "party":      "High-energy flash · neon cyan · beat-locked",
  "melodic":    "Harmonic depth · warm green · flowing ribbon",
  "bass-heavy": "Sub-bass rings · deep cyan · shockwave pulse",
};

function showProfileBanner(profile) {
  const banner = overlay.profileBanner;
  overlay.profileBannerName.textContent = (profile.label ?? profile.id).toUpperCase();
  overlay.profileBannerDesc.textContent = PROFILE_DESCRIPTIONS[profile.id] ?? "";

  banner.classList.remove("banner-visible");
  void banner.offsetWidth; // force reflow to restart animation
  banner.classList.add("banner-visible");

  clearTimeout(banner._hideTimer);
  banner._hideTimer = setTimeout(() => banner.classList.remove("banner-visible"), 2600);
}

function applyPhaseMix(phase) {
  const mixes = {
    opening: { bass: 0.18, drums: 0.08, melody: 0.18, harmonic: 0.2 },
    separation: { bass: 0.24, drums: 0.18, melody: 0.24, harmonic: 0.24 },
    bass: { bass: 1, drums: 0.12, melody: 0.18, harmonic: 0.18 },
    drums: { bass: 0.34, drums: 1, melody: 0.18, harmonic: 0.18 },
    melody: { bass: 0.24, drums: 0.16, melody: 1, harmonic: 0.28 },
    harmony: { bass: 0.2, drums: 0.12, melody: 0.28, harmonic: 1 },
    combined: { bass: 1, drums: 0.82, melody: 0.92, harmonic: 0.9 },
  };
  const baseMix = mixes[phase] ?? mixes.combined;
  const minimumMix = activeVisualProfile.minimumMix ?? {};
  const mix = {
    bass: Math.max(baseMix.bass, minimumMix.bass ?? 0),
    drums: Math.max(baseMix.drums, minimumMix.drums ?? 0),
    melody: Math.max(baseMix.melody, minimumMix.melody ?? 0),
    harmonic: Math.max(baseMix.harmonic, minimumMix.harmonic ?? 0),
  };

  bassVisualizer.setMix(mix.bass);
  drumVisualizer.setMix(mix.drums);
  melodyVisualizer.setMix(mix.melody);
  harmonicVisualizer.setMix(mix.harmonic);
}
