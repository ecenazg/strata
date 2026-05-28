import * as THREE from "three";

export class DrumParticles {
  constructor(scene) {
    this.scene = scene;
    this.particleCount = 500; // Sahnedeki davul tozu sayısı

    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(this.particleCount * 3);

    // 1. Parçacıkları başlangıçta merkezde rastgele bir küre şeklinde diziyoruz
    for (let i = 0; i < this.particleCount; i++) {
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);
      const r = 0.5 + Math.random() * 0.5; // Başlangıç yarıçapı

      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta); // X
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta); // Y
      positions[i * 3 + 2] = r * Math.cos(phi); // Z
    }

    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

    // 2. Materyal (Davul için enerjik bir renk: Altın Sarısı / Beyaz)
    this.material = new THREE.PointsMaterial({
      color: 0xe788e7, // Soft Limon Sarısı (Pastel Lemon)
      size: 0.1, // Biraz daha minik ve narin
      transparent: true,
      opacity: 0.5,
      blending: THREE.NormalBlending, // Normal Blending
    });

    // 3. Three.js'te özel bir obje olan "Points" (Noktalar) kullanıyoruz
    this.points = new THREE.Points(geometry, this.material);

    // Parçacık küresini havaya, melodi şeridinin tam arkasına koyalım
    this.points.position.y = 2;

    this.scene.add(this.points);
  }

  update(drumData) {
    // drumData.rms (ses enerjisi) davulun vurma şiddetini temsil eder.

    // 4. Davul vurduğunda küreyi şiddetle dışarı doğru şişir (Patlama efekti)
    // Normal boyutu 1, enerji arttıkça 10 katına kadar büyüyebilir
    const burstRadius = 1 + drumData.rms * 10.0;
    this.points.scale.set(burstRadius, burstRadius, burstRadius);

    // Vuruş şiddetine göre parçacıkların parlaklığı da artsın
    this.material.opacity = 0.2 + drumData.rms * 2.0;

    // 5. Parçacıklar havada sabit durmasın, kendi etrafında yavaşça dönsün
    this.points.rotation.y += 0.005;
    this.points.rotation.x += 0.005;
  }
}
