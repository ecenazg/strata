import * as THREE from "three";
import { DEFAULT_VISUAL_PROFILE } from "../visualProfiles.js";

export class MelodyRibbon {
  constructor(scene) {
    this.scene = scene;
    this.maxPoints = 260;
    this.points = [];
    this.echoPoints = [];
    this.energy = 0;
    this.mix = 1;
    this.motion = DEFAULT_VISUAL_PROFILE.motion;

    for (let i = 0; i < this.maxPoints; i++) {
      const x = (i - this.maxPoints / 2) * 0.035;
      this.points.push(new THREE.Vector3(x, 0, 0));
      this.echoPoints.push(new THREE.Vector3(x, -0.08, 0.08));
    }

    this.geometry = new THREE.BufferGeometry().setFromPoints(this.points);
    this.echoGeometry = new THREE.BufferGeometry().setFromPoints(this.echoPoints);

    this.material = new THREE.LineBasicMaterial({
      color: 0x6dff8f,
      transparent: true,
      opacity: 0.78,
      blending: THREE.AdditiveBlending,
    });

    this.echoMaterial = new THREE.LineBasicMaterial({
      color: 0xd8ff7a,
      transparent: true,
      opacity: 0.28,
      blending: THREE.AdditiveBlending,
    });

    this.line = new THREE.Group();
    this.primaryLine = new THREE.Line(this.geometry, this.material);
    this.echoLine = new THREE.Line(this.echoGeometry, this.echoMaterial);
    this.line.add(this.echoLine);
    this.line.add(this.primaryLine);

    this.scene.add(this.line);
  }

  applyVisualProfile(profile) {
    this.motion = profile.motion;
    this.material.color.setHex(profile.colors.melody.primary);
    this.echoMaterial.color.setHex(profile.colors.melody.echo);
  }

  update(melodyData) {
    let targetY = 0;

    if (melodyData.rms > 0.01 && melodyData.pitch_hz > 0) {
      const pitch = melodyData.pitch_hz;
      targetY =
        pitch < 128 ? ((pitch - 64) / 24) * 1.3 : Math.log2(pitch / 440) * 1.25;
      targetY = Math.max(-1.65, Math.min(1.65, targetY));
    }

    this.energy += (melodyData.rms - this.energy) * 0.12;

    const time = Date.now() * 0.002;
    for (let i = 0; i < this.maxPoints - 1; i++) {
      this.points[i].y = THREE.MathUtils.lerp(
        this.points[i].y,
        this.points[i + 1].y,
        0.4
      );
      this.points[i].z =
        Math.sin(i * 0.12 + time) * (0.34 + this.energy * 0.42);

      const helixOffset = Math.sin(i * 0.18 + time * 1.4) * (0.08 + this.energy * 0.18);
      this.echoPoints[i].y = THREE.MathUtils.lerp(
        this.echoPoints[i].y,
        this.points[i].y - 0.14 + helixOffset,
        0.34
      );
      this.echoPoints[i].z = this.points[i].z * -0.65 + helixOffset;
    }
    this.points[this.maxPoints - 1].y = targetY;
    this.points[this.maxPoints - 1].z = Math.sin(time) * 0.12;
    this.echoPoints[this.maxPoints - 1].y = targetY - 0.16;
    this.echoPoints[this.maxPoints - 1].z = -this.points[this.maxPoints - 1].z;

    this.material.opacity =
      Math.min(0.94, 0.45 + melodyData.rms * 1.6 * this.motion.melodyGlow) *
      this.mix;
    this.echoMaterial.opacity =
      Math.min(0.5, 0.18 + melodyData.rms * 0.9 * this.motion.melodyGlow) *
      this.mix;
    this.geometry.setFromPoints(this.points);
    this.echoGeometry.setFromPoints(this.echoPoints);
  }

  setMix(mix) {
    this.mix += (mix - this.mix) * 0.08;
    this.line.visible = this.mix > 0.03;
  }
}
