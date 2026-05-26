import * as THREE from "three";
// --- YENİ EKLENEN FİLTRE KÜTÜPHANELERİ ---
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";

export class SceneManager {
  constructor() {
    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );

    const pastelBg = 0x39445b; // Soft şeftali krem
    this.scene.background = new THREE.Color(pastelBg);
    this.scene.fog = new THREE.FogExp2(pastelBg, 0.05);
    // Standart Çizici
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);

    // Tuvali ekrana sabitleme
    this.renderer.domElement.style.position = "absolute";
    this.renderer.domElement.style.top = "0";
    this.renderer.domElement.style.left = "0";
    this.renderer.domElement.style.width = "100vw";
    this.renderer.domElement.style.height = "100vh";
    this.renderer.domElement.style.zIndex = "1";
    document.body.appendChild(this.renderer.domElement);

    // --- SİNEMATİK BLOOM (PARLAMA) EFEKTİ KURULUMU ---

    // 1. Efekt Birleştiriciyi (Composer) oluşturuyoruz
    this.composer = new EffectComposer(this.renderer);

    // 2. Normal sahne çizimini bir katman olarak ekliyoruz
    const renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(renderPass);

    // 3. Işık Patlaması (Bloom) katmanını oluşturuyoruz
    // Parametreler: (Ekran Boyutu, Parlama Gücü, Parlama Yarıçapı, Eşik Değeri)
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.2, // Güç: 1.5'ten 0.2'ye düştü (Sadece hafif bir ışıltı)
      0.1, // Yarıçap: 0.4'ten 0.1'e düştü (Sızma çok az)
      0.9 // Eşik: 0.1'den 0.9'a çıktı (Sadece en parlak noktalar hafifçe parlasın)
    );
    this.composer.addPass(bloomPass);

    // ------------------------------------------------

    window.addEventListener("resize", () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.composer.setSize(window.innerWidth, window.innerHeight); // Efektleri de yeniden boyutlandır
    });
  }

  render() {
    // ARTIK renderer YERİNE efektli olan composer'ı ÇALIŞTIRIYORUZ
    this.composer.render();
  }
}
