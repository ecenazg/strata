import * as THREE from "three";
import { DEFAULT_VISUAL_PROFILE } from "../visualProfiles.js";

export class DrumParticles {
  constructor(scene) {
    this.scene = scene;
    this.particleCount = 720;
    this.burstProgress = 1;
    this.burstStrength = 0;
    this.cooldown = 0;
    this.previousHit = 0;
    this.mix = 1;
    this.motion = DEFAULT_VISUAL_PROFILE.motion;

    const geometry = new THREE.BufferGeometry();
    this.positions = new Float32Array(this.particleCount * 3);
    this.directions = new Float32Array(this.particleCount * 3);
    this.speeds = new Float32Array(this.particleCount);
    this.jitter = new Float32Array(this.particleCount);

    for (let i = 0; i < this.particleCount; i++) {
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);

      this.directions[i * 3] = Math.sin(phi) * Math.cos(theta);
      this.directions[i * 3 + 1] = Math.sin(phi) * Math.sin(theta) * 0.68;
      this.directions[i * 3 + 2] = Math.cos(phi);
      this.speeds[i] = 0.65 + Math.random() * 1.25;
      this.jitter[i] = Math.random() * Math.PI * 2;

      this.positions[i * 3] = this.directions[i * 3] * 0.12;
      this.positions[i * 3 + 1] = this.directions[i * 3 + 1] * 0.12;
      this.positions[i * 3 + 2] = this.directions[i * 3 + 2] * 0.12;
    }

    geometry.setAttribute("position", new THREE.BufferAttribute(this.positions, 3));
    this.positionAttribute = geometry.getAttribute("position");

    this.material = new THREE.PointsMaterial({
      color: 0xffcf7a,
      size: 0.046,
      transparent: true,
      opacity: 0.12,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.points = new THREE.Points(geometry, this.material);

    this.scene.add(this.points);
  }

  applyVisualProfile(profile) {
    this.motion = profile.motion;
    this.material.color.setHex(profile.colors.drums.particles);
  }

  update(drumData) {
    const hit = Math.max(drumData.onset, drumData.rms * 0.85);

    if (this.cooldown > 0) this.cooldown -= 1;
    if (hit > 0.32 && hit > this.previousHit + 0.06 && this.cooldown === 0) {
      this.burstProgress = 0;
      this.burstStrength = Math.min(1, hit * 1.35);
      this.cooldown = 5;
    }
    this.previousHit = hit;

    this.burstProgress = Math.min(
      1,
      this.burstProgress + 0.036 + this.burstStrength * 0.018
    );

    const envelope = Math.pow(1 - this.burstProgress, 1.55);
    const spread = 0.16 + this.burstProgress * (1.45 + this.burstStrength * 1.4);
    const swirl = envelope * 0.18;

    for (let i = 0; i < this.particleCount; i++) {
      const speed = this.speeds[i];
      const r = spread * speed;
      const spin = Math.sin(this.jitter[i] + this.burstProgress * 9) * swirl;

      this.positions[i * 3] = this.directions[i * 3] * r + spin;
      this.positions[i * 3 + 1] =
        this.directions[i * 3 + 1] * r + envelope * this.burstStrength * 0.34;
      this.positions[i * 3 + 2] = this.directions[i * 3 + 2] * r - spin * 0.6;
    }

    this.positionAttribute.needsUpdate = true;
    this.material.opacity =
      Math.min(
      0.92,
      0.08 + hit * 0.28 + envelope * (0.52 + this.burstStrength * 0.35)
    ) * this.mix;
    this.material.size =
      (0.044 + hit * 0.036 + envelope * 0.045) * this.motion.drumSize;

    this.points.rotation.y += 0.007 + this.burstStrength * envelope * 0.02;
    this.points.rotation.x += 0.0025;
  }

  setMix(mix) {
    this.mix += (mix - this.mix) * 0.08;
    this.points.visible = this.mix > 0.03;
  }
}
