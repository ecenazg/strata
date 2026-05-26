import * as THREE from "three";

export class MelodyRibbon {
  constructor(scene) {
    this.scene = scene;
    this.maxPoints = 200; // Şeridimizin çözünürlüğü (uzunluğu)
    this.points = [];

    // 1. Başlangıçta ekranı baştan başa geçen düz bir çizgi (noktalar dizisi) oluşturuyoruz
    for (let i = 0; i < this.maxPoints; i++) {
      // X ekseninde soldan sağa diziyoruz, Y ve Z sıfır.
      this.points.push(new THREE.Vector3((i - this.maxPoints / 2) * 0.1, 0, 0));
    }

    this.geometry = new THREE.BufferGeometry().setFromPoints(this.points);

    // 2. Materyal (Turkuaz renk, bas dalgasıyla güzel bir kontrast yaratacak)
    this.material = new THREE.LineBasicMaterial({
      color: 0xb6a8d0, // Pastel Nane Yeşil / Soft Turkuaz (Mint Green)
      transparent: true,
      opacity: 0.6,
      blending: THREE.NormalBlending, // Normal blending
    });

    this.line = new THREE.Line(this.geometry, this.material);

    // Şeridi bas şok dalgasının biraz daha üzerine (havaya) kaldıralım
    this.line.position.y = 2;
    this.line.position.z = -2;

    this.scene.add(this.line);
  }

  update(melodyData) {
    let targetY = 0;

    if (melodyData.rms > 0.01 && melodyData.pitch_hz > 0) {
      targetY = Math.log2(melodyData.pitch_hz / 220) * 1.5;
      targetY = Math.max(-2.5, Math.min(2.5, targetY));
    }

    // Noktaları sola kaydırırken aynı zamanda sarmal (dalga) efekti veriyoruz
    const time = Date.now() * 0.002;
    for (let i = 0; i < this.maxPoints - 1; i++) {
      this.points[i].y = THREE.MathUtils.lerp(
        this.points[i].y,
        this.points[i + 1].y,
        0.4
      );
      // YENİ: Şeride Z ekseninde (derinlikte) dalgalanma (sinüs) vererek 3D hacim kazandır
      this.points[i].z = Math.sin(i * 0.1 + time) * 0.5;
    }
    this.points[this.maxPoints - 1].y = targetY;
    this.points[this.maxPoints - 1].z = 0;

    this.material.opacity = 0.4 + melodyData.rms * 2.0;
    this.geometry.setFromPoints(this.points);
  }
}
