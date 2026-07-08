import * as THREE from "three";
import { DEFAULT_VISUAL_PROFILE } from "../visualProfiles.js";

export class HarmonicCloud {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.cloudCount = 720;
    this.cloudPositions = new Float32Array(this.cloudCount * 3);
    this.basePositions = new Float32Array(this.cloudCount * 3);
    this.cloudColors = new Float32Array(this.cloudCount * 3);
    this.energy = 0;
    this.mix = 1;
    this.profile = DEFAULT_VISUAL_PROFILE;
    this.motionProfile = {
      harmonicRatio: 0.65,
      percussiveRatio: 0.35,
      organicJitter: 0.55,
      dynamicRange: { harmonic: 0.45 },
    };

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
    this._createTonalField();

    this.group.position.set(0, 1.72, -3.85);
    this.scene.add(this.group);
  }

  applyVisualProfile(profile) {
    this.profile = profile;
    this.meshes.forEach((mesh, index) => {
      const color = profile.colors.harmony.rings[index] ?? profile.colors.stems.harmony;
      mesh.material.color.setHex(color);
    });
    this.fieldShells?.forEach((shell, index) => {
      const color = profile.colors.harmony.cloud[index % profile.colors.harmony.cloud.length];
      shell.material.color.setHex(color);
    });
    this._applyCloudColors(profile.colors.harmony.cloud);
  }

  applyMotionProfile(profile) {
    this.motionProfile = profile;
  }

  update(harmonicData) {
    const harmonicFlow = this.motionProfile.harmonicRatio ?? 0.65;
    const percussive = this.motionProfile.percussiveRatio ?? 0.35;
    const harmonicRange = this.motionProfile.dynamicRange?.harmonic ?? 0.45;
    this.energy +=
      (harmonicData.rms * (0.88 + harmonicRange * 0.34) - this.energy) *
      THREE.MathUtils.lerp(0.065, 0.12, percussive);
    const brightness = Math.min(1, harmonicData.spectral_centroid / 6500);
    const targetScale =
      0.64 + harmonicFlow * 0.3 + this.energy * (0.55 + harmonicFlow * 0.72) + brightness * 0.1;
    this.group.scale.lerp(
      new THREE.Vector3(targetScale, targetScale, targetScale),
      THREE.MathUtils.lerp(0.055, 0.13, percussive)
    );

    this.meshes[0].rotation.x += 0.002 + harmonicFlow * 0.0015;
    this.meshes[0].rotation.y += 0.0014 + this.motionProfile.organicJitter * 0.0016;

    this.meshes[1].rotation.y -= 0.0018 + harmonicFlow * 0.0012;
    this.meshes[1].rotation.z += 0.0012 + this.motionProfile.organicJitter * 0.0012;

    this.meshes[2].rotation.x -= 0.0012 + harmonicFlow * 0.001;
    this.meshes[2].rotation.z -= 0.0008 + this.motionProfile.organicJitter * 0.001;

    this.meshes.forEach((mesh, index) => {
      mesh.material.opacity =
        Math.min(
        0.5,
        0.08 +
          this.energy * (0.19 + harmonicFlow * 0.18) * this.profile.motion.harmonyMist +
          brightness * 0.08 -
          index * 0.015
      ) * this.mix;
    });

    this._updateAuroraCloud(brightness);
    this._updateTonalField(brightness);
  }

  _createAuroraCloud() {
    for (let i = 0; i < this.cloudCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const radius = 1.0 + Math.random() * 3.3;
      const band = (Math.random() - 0.5) * 1.35;
      const y = band + Math.sin(theta * 2) * 0.38;

      this.basePositions[i * 3] = Math.cos(theta) * radius;
      this.basePositions[i * 3 + 1] = y;
      this.basePositions[i * 3 + 2] = Math.sin(theta) * radius * 0.82;

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

  _createTonalField() {
    this.fieldShells = [0, 1, 2].map((index) => {
      const geometry = new THREE.IcosahedronGeometry(1.35 + index * 0.5, 2);
      const material = new THREE.MeshBasicMaterial({
        color: this.profile.colors.harmony.cloud[index % this.profile.colors.harmony.cloud.length],
        transparent: true,
        opacity: 0.035,
        wireframe: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const shell = new THREE.Mesh(geometry, material);
      shell.rotation.set(index * 0.45, index * 0.25, index * 0.62);
      this.group.add(shell);
      return shell;
    });
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
    const harmonicFlow = this.motionProfile.harmonicRatio ?? 0.65;
    const organic = this.motionProfile.organicJitter ?? 0.55;
    const percussive = this.motionProfile.percussiveRatio ?? 0.35;

    for (let i = 0; i < this.cloudCount; i++) {
      const x = this.basePositions[i * 3];
      const y = this.basePositions[i * 3 + 1];
      const z = this.basePositions[i * 3 + 2];
      const wave =
        Math.sin(time * (2.1 + harmonicFlow * 1.2) + i * 0.07 + x * 0.8) *
        (0.08 + harmonicFlow * 0.24 + this.energy * (0.16 + harmonicFlow * 0.44));
      const fragment =
        Math.sin(time * 11 + i * 1.73) * percussive * (1 - harmonicFlow) * 0.035;

      this.cloudPositions[i * 3] = x + Math.sin(time + z) * (0.035 + organic * 0.13) + fragment;
      this.cloudPositions[i * 3 + 1] = y + wave;
      this.cloudPositions[i * 3 + 2] = z + Math.cos(time * 1.7 + x) * (0.035 + organic * 0.13) - fragment;
    }

    this.cloudPositionAttribute.needsUpdate = true;
    this.cloud.rotation.y += 0.0009 + harmonicFlow * 0.0016 + organic * 0.0008;
    this.cloudMaterial.opacity =
      Math.min(
        0.56,
        0.06 +
          harmonicFlow * 0.16 +
          this.energy * (0.18 + harmonicFlow * 0.52) * this.profile.motion.harmonyMist +
          brightness * 0.1
      ) * this.mix;
    this.cloudMaterial.size =
      THREE.MathUtils.lerp(0.022, 0.06, harmonicFlow) +
      this.energy * (0.018 + harmonicFlow * 0.06) * this.profile.motion.harmonyMist +
      brightness * 0.014;
  }

  _updateTonalField(brightness) {
    const harmonicFlow = this.motionProfile.harmonicRatio ?? 0.65;
    const organic = this.motionProfile.organicJitter ?? 0.55;
    const time = Date.now() * 0.00028;

    this.fieldShells.forEach((shell, index) => {
      const breath = 1 + Math.sin(time * (1.2 + index * 0.22) + index) * (0.035 + harmonicFlow * 0.035);
      const scale = breath * (0.86 + harmonicFlow * 0.22 + this.energy * (0.16 + harmonicFlow * 0.18));
      shell.scale.set(scale, scale * (0.86 + harmonicFlow * 0.2), scale);
      shell.rotation.y += 0.00055 + harmonicFlow * 0.001 + organic * 0.00055;
      shell.rotation.x += 0.00025 + index * 0.00012;
      shell.material.opacity =
        Math.min(0.14, 0.018 + harmonicFlow * 0.045 + this.energy * 0.055 + brightness * 0.018) *
        this.mix;
    });
  }

  setMix(mix) {
    this.mix += (mix - this.mix) * 0.08;
    this.group.visible = this.mix > 0.03;
  }
}
