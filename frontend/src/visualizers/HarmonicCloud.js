import * as THREE from "three";
import { DEFAULT_VISUAL_PROFILE } from "../visualProfiles.js";

export class HarmonicCloud {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.cloudCount = 520;
    this.cloudPositions = new Float32Array(this.cloudCount * 3);
    this.basePositions = new Float32Array(this.cloudCount * 3);
    this.cloudColors = new Float32Array(this.cloudCount * 3);
    this.energy = 0;
    this.mix = 1;
    this.profile = DEFAULT_VISUAL_PROFILE;

    const geometries = [
      new THREE.TorusGeometry(1.65, 0.01, 8, 180),
      new THREE.TorusGeometry(2.15, 0.012, 8, 180),
      new THREE.TorusGeometry(2.65, 0.01, 8, 180),
    ];

    this.meshes = geometries.map((geo, index) => {
      const material = new THREE.MeshBasicMaterial({
        color: index === 1 ? 0xba7cff : 0x7c4dff,
        transparent: true,
        opacity: 0.16,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(geo, material);
      mesh.rotation.x = Math.PI / 2 + index * 0.55;
      mesh.rotation.y = index * 0.7;
      this.group.add(mesh);
      return mesh;
    });

    this._createAuroraCloud();

    this.group.position.set(0, 1.35, -3.25);
    this.scene.add(this.group);
  }

  applyVisualProfile(profile) {
    this.profile = profile;
    this.meshes.forEach((mesh, index) => {
      const color = profile.colors.harmony.rings[index] ?? profile.colors.stems.harmony;
      mesh.material.color.setHex(color);
    });
    this._applyCloudColors(profile.colors.harmony.cloud);
  }

  update(harmonicData) {
    this.energy += (harmonicData.rms - this.energy) * 0.09;
    const brightness = Math.min(1, harmonicData.spectral_centroid / 6500);
    const targetScale = 0.78 + this.energy * 0.85 + brightness * 0.12;
    this.group.scale.lerp(
      new THREE.Vector3(targetScale, targetScale, targetScale),
      0.1
    );

    this.meshes[0].rotation.x += 0.003;
    this.meshes[0].rotation.y += 0.002;

    this.meshes[1].rotation.y -= 0.0028;
    this.meshes[1].rotation.z += 0.002;

    this.meshes[2].rotation.x -= 0.0018;
    this.meshes[2].rotation.z -= 0.0012;

    this.meshes.forEach((mesh, index) => {
      mesh.material.opacity =
        Math.min(
        0.5,
        0.08 +
          this.energy * 0.26 * this.profile.motion.harmonyMist +
          brightness * 0.08 -
          index * 0.015
      ) * this.mix;
    });

    this._updateAuroraCloud(brightness);
  }

  _createAuroraCloud() {
    for (let i = 0; i < this.cloudCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const radius = 0.65 + Math.random() * 2.35;
      const band = (Math.random() - 0.5) * 0.78;
      const y = band + Math.sin(theta * 2) * 0.26;

      this.basePositions[i * 3] = Math.cos(theta) * radius;
      this.basePositions[i * 3 + 1] = y;
      this.basePositions[i * 3 + 2] = Math.sin(theta) * radius * 0.62;

      this.cloudPositions[i * 3] = this.basePositions[i * 3];
      this.cloudPositions[i * 3 + 1] = this.basePositions[i * 3 + 1];
      this.cloudPositions[i * 3 + 2] = this.basePositions[i * 3 + 2];

      this._setCloudColorAt(i, this.profile.colors.harmony.cloud);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(this.cloudPositions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(this.cloudColors, 3));
    this.cloudPositionAttribute = geometry.getAttribute("position");

    this.cloudMaterial = new THREE.PointsMaterial({
      size: 0.035,
      vertexColors: true,
      transparent: true,
      opacity: 0.18,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.cloud = new THREE.Points(geometry, this.cloudMaterial);
    this.group.add(this.cloud);
  }

  _applyCloudColors(colors) {
    for (let i = 0; i < this.cloudCount; i++) {
      this._setCloudColorAt(i, colors);
    }
    this.cloud.geometry.getAttribute("color").needsUpdate = true;
  }

  _setCloudColorAt(index, colors) {
    const colorIndex = index % 7 === 0 ? 2 : index % 2 === 0 ? 0 : 1;
    const color = new THREE.Color(colors[colorIndex] ?? colors[0]);
    this.cloudColors[index * 3] = color.r;
    this.cloudColors[index * 3 + 1] = color.g;
    this.cloudColors[index * 3 + 2] = color.b;
  }

  _updateAuroraCloud(brightness) {
    const time = Date.now() * 0.00055;

    for (let i = 0; i < this.cloudCount; i++) {
      const x = this.basePositions[i * 3];
      const y = this.basePositions[i * 3 + 1];
      const z = this.basePositions[i * 3 + 2];
      const wave = Math.sin(time * 3 + i * 0.07 + x * 0.8) * (0.16 + this.energy * 0.28);

      this.cloudPositions[i * 3] = x + Math.sin(time + z) * 0.08;
      this.cloudPositions[i * 3 + 1] = y + wave;
      this.cloudPositions[i * 3 + 2] = z + Math.cos(time * 1.7 + x) * 0.08;
    }

    this.cloudPositionAttribute.needsUpdate = true;
    this.cloud.rotation.y += 0.0016;
    this.cloudMaterial.opacity =
      Math.min(
        0.56,
        0.12 + this.energy * 0.42 * this.profile.motion.harmonyMist + brightness * 0.1
      ) * this.mix;
    this.cloudMaterial.size =
      0.028 + this.energy * 0.04 * this.profile.motion.harmonyMist + brightness * 0.018;
  }

  setMix(mix) {
    this.mix += (mix - this.mix) * 0.08;
    this.group.visible = this.mix > 0.03;
  }
}
