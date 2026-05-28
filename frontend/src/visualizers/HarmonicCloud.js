import * as THREE from "three";

export class HarmonicCloud {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group(); // Birden fazla objeyi gruplayacağız

    // İç içe geçecek 3 farklı halka (Jiroskop yapısı)
    const geometries = [
      new THREE.IcosahedronGeometry(4, 1),
      new THREE.IcosahedronGeometry(4.5, 0),
      new THREE.IcosahedronGeometry(5, 1),
    ];

    this.meshes = geometries.map((geo, index) => {
      const material = new THREE.MeshBasicMaterial({
        color: index === 1 ? 0x61212d : 0xfefefe, // Mor ve Derin Mavi karışımı
        wireframe: true,
        transparent: true,
        opacity: 0.1,
        blending: THREE.AdditiveBlending,
      });
      const mesh = new THREE.Mesh(geo, material);
      this.group.add(mesh);
      return mesh;
    });

    this.group.position.set(0, 3, -6);
    this.scene.add(this.group);
  }

  update(harmonicData) {
    const targetScale = 1 + harmonicData.rms * 1.5;
    this.group.scale.lerp(
      new THREE.Vector3(targetScale, targetScale, targetScale),
      0.1
    );

    // Her halka farklı hızlarda ve yönlerde dönsün (Kompleks algısı)
    this.meshes[0].rotation.x += 0.005;
    this.meshes[0].rotation.y += 0.002;

    this.meshes[1].rotation.y -= 0.004;
    this.meshes[1].rotation.z += 0.003;

    this.meshes[2].rotation.x -= 0.002;
    this.meshes[2].rotation.z -= 0.001;

    // Müziğe göre parlaklık artışı
    this.meshes.forEach((mesh) => {
      mesh.material.opacity = 0.05 + harmonicData.rms * 0.4;
    });
  }
}
