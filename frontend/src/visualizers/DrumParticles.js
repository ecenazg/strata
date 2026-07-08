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
    this.motionProfile = {
      onsetDensity: 0.45,
      staccato: 0.45,
      percussiveRatio: 0.35,
      tempoStability: 0.45,
      organicJitter: 0.55,
      dynamicRange: { drums: 0.45 },
    };

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

  applyMotionProfile(profile) {
    this.motionProfile = profile;
  }

  update(drumData) {
    const hit = Math.max(drumData.onset, drumData.rms * 0.85);
    const staccato = this.motionProfile.staccato ?? 0.45;
    const percussive = this.motionProfile.percussiveRatio ?? 0.35;
    const stable = this.motionProfile.tempoStability ?? 0.45;
    const organic = this.motionProfile.organicJitter ?? 0.55;
    const drumRange = this.motionProfile.dynamicRange?.drums ?? 0.45;
    const hitThreshold = THREE.MathUtils.lerp(0.54, 0.14, staccato);
    const hitDelta = THREE.MathUtils.lerp(0.11, 0.025, staccato);

    if (this.cooldown > 0) this.cooldown -= 1;
    if (hit > hitThreshold && hit > this.previousHit + hitDelta && this.cooldown === 0) {
      this.burstProgress = 0;
      this.burstStrength = Math.min(1, hit * (1.1 + percussive * 0.65 + drumRange * 0.3));
      this.cooldown = Math.round(THREE.MathUtils.lerp(18, 1, staccato));
    }
    this.previousHit = hit;

    this.burstProgress = Math.min(
      1,
      this.burstProgress +
        THREE.MathUtils.lerp(0.011, 0.095, staccato) +
        this.burstStrength * THREE.MathUtils.lerp(0.006, 0.038, staccato)
    );

    const decayCurve = THREE.MathUtils.lerp(0.82, 2.35, staccato);
    const envelope = Math.pow(1 - this.burstProgress, decayCurve);
    const spread =
      0.14 +
      this.burstProgress *
        THREE.MathUtils.lerp(4.15 + this.burstStrength * 2.2, 1.08 + this.burstStrength * 0.72, staccato);
    const swirl = envelope * THREE.MathUtils.lerp(0.32, 0.08, stable);
    const gridLock = stable * staccato;

    for (let i = 0; i < this.particleCount; i++) {
      const speed = this.speeds[i];
      const r = spread * speed;
      const rhythmicStep = Math.round(this.burstProgress * 12) / 12;
      const progressForMotion = THREE.MathUtils.lerp(this.burstProgress, rhythmicStep, gridLock * 0.42);
      const spin =
        Math.sin(this.jitter[i] + progressForMotion * (8 + staccato * 7)) *
        swirl *
        (0.65 + organic * 0.55);
      const facetedLift = Math.sign(this.directions[i * 3]) * envelope * percussive * 0.05;

      this.positions[i * 3] = this.directions[i * 3] * r + spin + facetedLift;
      this.positions[i * 3 + 1] =
        this.directions[i * 3 + 1] * r +
        envelope * this.burstStrength * THREE.MathUtils.lerp(0.55, 0.25, staccato);
      this.positions[i * 3 + 2] =
        this.directions[i * 3 + 2] * r - spin * (0.35 + percussive * 0.38);
    }

    this.positionAttribute.needsUpdate = true;
    this.material.opacity =
      Math.min(
      0.92,
      0.06 + hit * (0.22 + percussive * 0.18) + envelope * (0.5 + this.burstStrength * 0.42)
    ) * this.mix;
    this.material.size =
      (THREE.MathUtils.lerp(0.058, 0.034, staccato) +
        hit * THREE.MathUtils.lerp(0.025, 0.062, percussive) +
        envelope * THREE.MathUtils.lerp(0.09, 0.022, staccato)) *
      this.motion.drumSize;

    this.points.rotation.y +=
      0.004 +
      stable * 0.004 +
      this.burstStrength * envelope * THREE.MathUtils.lerp(0.012, 0.035, gridLock);
    this.points.rotation.x += 0.0015 + organic * 0.0025;
  }

  setMix(mix) {
    this.mix += (mix - this.mix) * 0.08;
    this.points.visible = this.mix > 0.03;
  }
}
