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
    this.motionProfile = {
      harmonicRatio: 0.65,
      tempoStability: 0.45,
      organicJitter: 0.55,
      dynamicRange: { melody: 0.45 },
    };

    for (let i = 0; i < this.maxPoints; i++) {
      const x = (i - this.maxPoints / 2) * 0.035;
      this.points.push(new THREE.Vector3(x, 0, 0));
      this.echoPoints.push(new THREE.Vector3(x, -0.08, 0.08));
    }

    this.geometry = new THREE.BufferGeometry().setFromPoints(this.points);
    this.echoGeometry = new THREE.BufferGeometry().setFromPoints(this.echoPoints);
    this.glowPoints = this.points.map((point) => point.clone());
    this.glowGeometry = new THREE.BufferGeometry().setFromPoints(this.glowPoints);

    this.material = new THREE.LineBasicMaterial({
      color: 0x6dff8f,
      transparent: true,
      opacity: 0.92,
      blending: THREE.AdditiveBlending,
    });

    this.echoMaterial = new THREE.LineBasicMaterial({
      color: 0xd8ff7a,
      transparent: true,
      opacity: 0.28,
      blending: THREE.AdditiveBlending,
    });

    this.glowMaterial = new THREE.LineBasicMaterial({
      color: 0x6dff8f,
      transparent: true,
      opacity: 0.18,
      blending: THREE.AdditiveBlending,
    });

    this.leadMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.82,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.line = new THREE.Group();
    this.glowLine = new THREE.Line(this.glowGeometry, this.glowMaterial);
    this.primaryLine = new THREE.Line(this.geometry, this.material);
    this.echoLine = new THREE.Line(this.echoGeometry, this.echoMaterial);
    this.line.add(this.echoLine);
    this.line.add(this.glowLine);
    this.line.add(this.primaryLine);

    this.leadOrb = new THREE.Mesh(new THREE.SphereGeometry(0.055, 18, 18), this.leadMaterial);
    this.line.add(this.leadOrb);

    this.scene.add(this.line);
  }

  applyVisualProfile(profile) {
    this.motion = profile.motion;
    this.material.color.setHex(profile.colors.melody.primary);
    this.glowMaterial.color.setHex(profile.colors.melody.primary);
    this.echoMaterial.color.setHex(profile.colors.melody.echo);
    this.leadMaterial.color.setHex(profile.colors.melody.primary);
  }

  applyMotionProfile(profile) {
    this.motionProfile = profile;
  }

  update(melodyData) {
    let targetY = 0;

    if (melodyData.rms > 0.01 && melodyData.pitch_hz > 0) {
      const pitch = melodyData.pitch_hz;
      targetY =
        pitch < 128 ? ((pitch - 64) / 24) * 1.65 : Math.log2(pitch / 440) * 1.62;
      targetY = Math.max(-2.05, Math.min(2.05, targetY));
    }

    const harmonicFlow = this.motionProfile.harmonicRatio ?? 0.65;
    const stable = this.motionProfile.tempoStability ?? 0.45;
    const organic = this.motionProfile.organicJitter ?? 0.55;
    const melodyRange = this.motionProfile.dynamicRange?.melody ?? 0.45;

    if (stable > 0.62) {
      targetY = Math.round(targetY * 5) / 5;
    }

    this.energy +=
      (melodyData.rms * (0.82 + melodyRange * 0.36) - this.energy) *
      THREE.MathUtils.lerp(0.085, 0.145, stable);

    const time = Date.now() * 0.002;
    const flowAmplitude = 0.16 + harmonicFlow * 0.58 + organic * 0.24;
    const trailLerp = THREE.MathUtils.lerp(0.54, 0.22, harmonicFlow);
    for (let i = 0; i < this.maxPoints - 1; i++) {
      this.points[i].y = THREE.MathUtils.lerp(
        this.points[i].y,
        this.points[i + 1].y,
        trailLerp
      );
      this.points[i].z =
        Math.sin(i * (0.1 + stable * 0.05) + time * (0.8 + organic * 0.55)) *
        (flowAmplitude + this.energy * (0.2 + harmonicFlow * 0.52));

      const helixOffset =
        Math.sin(i * 0.18 + time * (1.0 + organic * 0.8)) *
        (0.04 + harmonicFlow * 0.14 + this.energy * (0.08 + harmonicFlow * 0.2));
      this.echoPoints[i].y = THREE.MathUtils.lerp(
        this.echoPoints[i].y,
        this.points[i].y - 0.14 + helixOffset,
        THREE.MathUtils.lerp(0.42, 0.25, harmonicFlow)
      );
      this.echoPoints[i].z = this.points[i].z * -0.65 + helixOffset;
      this.glowPoints[i].x = this.points[i].x;
      this.glowPoints[i].y = this.points[i].y + Math.sin(i * 0.2 + time) * 0.035;
      this.glowPoints[i].z = this.points[i].z + Math.cos(i * 0.16 + time) * 0.12;
    }
    this.points[this.maxPoints - 1].y = targetY;
    this.points[this.maxPoints - 1].z = Math.sin(time) * 0.12;
    this.echoPoints[this.maxPoints - 1].y = targetY - 0.16;
    this.echoPoints[this.maxPoints - 1].z = -this.points[this.maxPoints - 1].z;
    this.glowPoints[this.maxPoints - 1].copy(this.points[this.maxPoints - 1]);

    this.leadOrb.position.copy(this.points[this.maxPoints - 1]);
    this.leadOrb.scale.setScalar(0.85 + melodyData.rms * 2.2 + harmonicFlow * 0.55);
    this.leadMaterial.opacity = Math.min(0.95, 0.42 + melodyData.rms * 1.75) * this.mix;

    this.material.opacity =
      Math.min(1, 0.44 + harmonicFlow * 0.26 + melodyData.rms * 1.55 * this.motion.melodyGlow) *
      this.mix;
    this.echoMaterial.opacity =
      Math.min(0.52, 0.08 + harmonicFlow * 0.16 + melodyData.rms * 0.62 * this.motion.melodyGlow) *
      this.mix;
    this.glowMaterial.opacity =
      Math.min(0.42, 0.12 + harmonicFlow * 0.18 + melodyData.rms * 0.9 * this.motion.melodyGlow) *
      this.mix;
    this.geometry.setFromPoints(this.points);
    this.echoGeometry.setFromPoints(this.echoPoints);
    this.glowGeometry.setFromPoints(this.glowPoints);
  }

  setMix(mix) {
    this.mix += (mix - this.mix) * 0.08;
    this.line.visible = this.mix > 0.03;
  }
}
