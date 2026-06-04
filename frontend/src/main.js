import { SceneManager } from "./SceneManager.js";
import { AudioSyncManager } from "./AudioSyncManager.js";
import { BassShockwave } from "./visualizers/BassShockwave.js";
import { MelodyRibbon } from "./visualizers/MelodyRibbon.js";
import { DrumParticles } from "./visualizers/DrumParticles.js";
import { HarmonicCloud } from "./visualizers/HarmonicCloud.js";
import GUI from "lil-gui";
import "./style.css";

const sceneManager = new SceneManager();
const overlay = createCinematicOverlay();

const bassVisualizer = new BassShockwave(sceneManager.scene);
bassVisualizer.mesh.position.set(0, -1.45, -1.3);

const melodyVisualizer = new MelodyRibbon(sceneManager.scene);
melodyVisualizer.line.position.set(0, 0.45, -1.65);

const drumVisualizer = new DrumParticles(sceneManager.scene);
drumVisualizer.points.position.set(0, 0.95, -2.15);

const harmonicVisualizer = new HarmonicCloud(sceneManager.scene);
harmonicVisualizer.group.position.set(0, 1.35, -3.25);
harmonicVisualizer.group.scale.setScalar(0.62);

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
        a.download = `Strata_Visualizer_Export.webm`; // İndirilen video adı
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

const onFrameReceived = (frameData) => {
  latestFrame = frameData;
  activePhase = getDemoPhase(frameData.t, audioManager.duration);
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
  overlay.progress.style.transform = `scaleX(${getProgress(frameData.t, audioManager.duration)})`;
  overlay.closing.hidden = activePhase !== "closing";

  if (layers.bass) bassVisualizer.update(frameData.bass);
  if (layers.melody) melodyVisualizer.update(frameData.melody);
  if (layers.drums) drumVisualizer.update(frameData.drums);
  if (layers.harmonic) harmonicVisualizer.update(frameData.harmonic);

  applyPhaseMix(activePhase);
};

const audioManager = new AudioSyncManager(onFrameReceived);
window.strataDemo = {
  play: () => audioManager.play(),
  pause: () => audioManager.pause(),
  toggle: () => audioManager.togglePlayback(),
};

window.addEventListener("click", (e) => {
  if (e.target.closest(".lil-gui")) return;

  const isPlaying = audioManager.togglePlayback();

  if (isPlaying) {
    console.log("Tıklandı, müzik başlatılıyor...");
    document.body.classList.add("is-playing");
    overlay.state.textContent = "playback started";
  } else {
    console.log("Tıklandı, müzik duraklatılıyor...");
    overlay.state.textContent = "playback paused";
  }
});

window.addEventListener("keydown", (e) => {
  const key = e.key.toLowerCase();

  if (key === "g") {
    const hidden = gui.domElement.style.display === "none";
    gui.domElement.style.display = hidden ? "block" : "none";
  }

  if (key === "r") {
    recorderControls.recordToggle();
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
    <div class="audio-state" data-state>waiting for feature stream</div>
    <div class="stem-legend" aria-label="Stem colour legend">
      <span class="legend-item bass"><i></i>Bass</span>
      <span class="legend-item drums"><i></i>Drums</span>
      <span class="legend-item melody"><i></i>Melody</span>
      <span class="legend-item harmony"><i></i>Harmony</span>
    </div>
    <div class="progress-track"><span data-progress></span></div>
    <section class="closing-lockup" data-closing hidden>
      <p class="eyebrow">AI source separation</p>
      <h2>Real-time 3D music visualisation</h2>
    </section>
  `;
  document.body.appendChild(root);
  return {
    root,
    phase: root.querySelector("[data-phase]"),
    state: root.querySelector("[data-state]"),
    progress: root.querySelector("[data-progress]"),
    closing: root.querySelector("[data-closing]"),
  };
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
  const mix = mixes[phase] ?? mixes.combined;

  bassVisualizer.setMix(mix.bass);
  drumVisualizer.setMix(mix.drums);
  melodyVisualizer.setMix(mix.melody);
  harmonicVisualizer.setMix(mix.harmonic);
}
