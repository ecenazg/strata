import { SceneManager } from "./SceneManager.js";
import { AudioSyncManager } from "./AudioSyncManager.js";
import { BassShockwave } from "./visualizers/BassShockwave.js";
import { MelodyRibbon } from "./visualizers/MelodyRibbon.js";
import { DrumParticles } from "./visualizers/DrumParticles.js";
import { HarmonicCloud } from "./visualizers/HarmonicCloud.js";
import GUI from "lil-gui";

// 1. Sahneyi Başlat
const sceneManager = new SceneManager();

// 2. Görselleştiricileri Oluştur ve Konumlandır
const bassVisualizer = new BassShockwave(sceneManager.scene);
bassVisualizer.mesh.position.set(0, 0, 2);

const melodyVisualizer = new MelodyRibbon(sceneManager.scene);
melodyVisualizer.line.position.set(0, 1.5, 0);

const drumVisualizer = new DrumParticles(sceneManager.scene);
drumVisualizer.points.position.set(0, 3, -3);

const harmonicVisualizer = new HarmonicCloud(sceneManager.scene);
harmonicVisualizer.group.position.set(0, 5, -6);

// 3. GUI (Kontrol Paneli) Kurulumu
const gui = new GUI({ title: "Strata Kontrol Merkezi" });

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
      // Kaydı Başlat
      recordedChunks = [];
      // Three.js Canvas'ından 60 FPS'lik bir video akışı alıyoruz
      const stream = sceneManager.renderer.domElement.captureStream(60);

      // En yüksek kalitede video kaydı ayarları
      mediaRecorder = new MediaRecorder(stream, {
        mimeType: "video/webm;codecs=vp9",
        videoBitsPerSecond: 5000000, // 5 Mbps - Cam gibi net görüntü için
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

        // Jürinin her playerda açabilmesi için uzantıyı .mp4 yapabilirsiniz
        alert("Video başarıyla kaydedildi ve indirildi!");
      };

      mediaRecorder.start();
      isRecording = true;
      btnRecord.name("🔴 Kaydı Durdur ve İndir");
      console.log("Video kaydı başladı...");
    } else {
      // Kaydı Durdur
      mediaRecorder.stop();
      isRecording = false;
      btnRecord.name("🎬 Video Kaydını Başlat");
      console.log("Video kaydı durduruldu, dosya hazırlanıyor...");
    }
  },
};

const btnRecord = fExport
  .add(recorderControls, "recordToggle")
  .name("🎬 Video Kaydını Başlat");
// --------------------------------------------

// 4. Veri Güncelleme
const onFrameReceived = (frameData) => {
  if (layers.bass) bassVisualizer.update(frameData.bass);
  if (layers.melody) melodyVisualizer.update(frameData.melody);
  if (layers.drums) drumVisualizer.update(frameData.drums);
  if (layers.harmonic) harmonicVisualizer.update(frameData.harmonic);
};

// 5. Ses ve Animasyon Döngüsü
const audioManager = new AudioSyncManager(onFrameReceived);

window.addEventListener("click", (e) => {
  // GUI paneline tıklanma durumunda müziğin yanlışlıkla tetiklenmesini engelliyoruz
  if (e.target.closest(".lil-gui")) return;

  if (!audioManager.isPlaying) {
    console.log("Tıklandı, müzik başlatılıyor...");
    audioManager.play();
    audioManager.isPlaying = true;
  }
});

function animate() {
  requestAnimationFrame(animate);
  sceneManager.render();
}
animate();
