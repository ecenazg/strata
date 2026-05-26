import * as THREE from "three";

export class BassShockwave {
  constructor(scene) {
    this.scene = scene;

    // Daha şık, içi dolu bir disk geometrisi
    const geometry = new THREE.TorusGeometry(3.5, 0.15, 16, 100);

    this.material = new THREE.MeshBasicMaterial({
      color: 0x733b73,
      transparent: true,
      opacity: 0.0,
      blending: THREE.NormalBlending, // AdditiveBlending yerine normal blending light bglarda daha hoş durur
    });

    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.rotation.x = -Math.PI / 2;
    // YENİ: Yerde hafif yatay bir derinlik hissi için X ve Y'de esnetelim
    this.mesh.scale.set(1, 1, 0.5);
    this.scene.add(this.mesh);
  }

  update(bassData) {
    // Bass enerjisine (RMS) göre halkanın boyutunu büyüt
    const targetScale = 1 + bassData.rms * 5;
    this.mesh.scale.set(targetScale, targetScale, targetScale);

    // Bass vurdukça halkanın parlaklığını/görünürlüğünü artır
    this.material.opacity = bassData.rms * 2.5;
  }
}
