import * as THREE from "three";
import { DEFAULT_VISUAL_PROFILE } from "../visualProfiles.js";

export class BassShockwave {
  constructor(scene) {
    this.scene = scene;
    this.energy = 0;
    this.phase = 0;
    this.mix = 1;
    this.motion = DEFAULT_VISUAL_PROFILE.motion;

    this.mesh = new THREE.Group();
    this.mesh.rotation.x = -Math.PI / 2;

    this.floorMaterial = new THREE.MeshBasicMaterial({
      color: 0x0b56ff,
      transparent: true,
      opacity: 0.08,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.floor = new THREE.Mesh(new THREE.CircleGeometry(2.4, 96), this.floorMaterial);
    this.mesh.add(this.floor);

    this.rings = [0, 1, 2].map((index) => {
      const geometry = new THREE.TorusGeometry(1.35 + index * 0.55, 0.026, 12, 180);
      const material = new THREE.MeshBasicMaterial({
        color: index === 1 ? 0x4cc9ff : 0x0b7cff,
        transparent: true,
        opacity: 0.18,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const ring = new THREE.Mesh(geometry, material);
      this.mesh.add(ring);
      return ring;
    });

    this.scene.add(this.mesh);
  }

  applyVisualProfile(profile) {
    this.motion = profile.motion;
    this.floorMaterial.color.setHex(profile.colors.bass.floor);
    this.rings.forEach((ring, index) => {
      const color = profile.colors.bass.rings[index] ?? profile.colors.stems.bass;
      ring.material.color.setHex(color);
    });
  }

  update(bassData) {
    const targetEnergy = Math.min(1, bassData.rms * 2.8);
    this.energy += (targetEnergy - this.energy) * 0.16;
    this.phase += 0.035 + this.energy * 0.08;

    this.floor.scale.setScalar(1 + this.energy * 0.42 * this.motion.bassScale);
    this.floorMaterial.opacity =
      Math.min(0.42, (0.035 + this.energy * 0.13) * this.motion.bassIntensity) *
      this.mix;

    this.rings.forEach((ring, index) => {
      const offset = (this.phase + index * 0.32) % 1;
      const spread = 1 + offset * 0.85 + this.energy * 0.65 * this.motion.bassScale;
      ring.scale.set(spread, spread, spread);
      ring.material.opacity =
        Math.min(
          0.95,
          Math.max(0.04, (1 - offset) * (0.18 + this.energy * 0.44)) *
            this.motion.bassIntensity
        ) * this.mix;
      ring.rotation.z += 0.002 + index * 0.0008;
    });
  }

  setMix(mix) {
    this.mix += (mix - this.mix) * 0.08;
    this.mesh.visible = this.mix > 0.03;
  }
}
