import * as THREE from "three";
import { DEFAULT_VISUAL_PROFILE } from "../visualProfiles.js";

export class BassShockwave {
  constructor(scene) {
    this.scene = scene;
    this.energy = 0;
    this.phase = 0;
    this.mix = 1;
    this.motion = DEFAULT_VISUAL_PROFILE.motion;
    this.motionProfile = {
      percussiveRatio: 0.35,
      tempoStability: 0.45,
      organicJitter: 0.55,
      bassDominance: 0.35,
      dynamicRange: { bass: 0.45 },
    };

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

    this.ringRadii = [1.35, 1.9, 2.45];
    this.rings = this.ringRadii.map((radius, index) => {
      const geometry = new THREE.TorusGeometry(radius, 0.026, 12, 180);
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

  applyMotionProfile(profile) {
    this.motionProfile = profile;
    const tubularSegments = Math.round(THREE.MathUtils.lerp(192, 54, profile.percussiveRatio));
    const tubeSegments = Math.round(THREE.MathUtils.lerp(14, 7, profile.percussiveRatio));

    this.rings.forEach((ring, index) => {
      ring.geometry.dispose();
      ring.geometry = new THREE.TorusGeometry(
        this.ringRadii[index],
        0.024 + profile.bassDominance * 0.018,
        tubeSegments,
        tubularSegments
      );
    });
  }

  update(bassData) {
    const bassRange = this.motionProfile.dynamicRange?.bass ?? 0.45;
    const dominance = this.motionProfile.bassDominance ?? 0.35;
    const targetEnergy = Math.min(1, bassData.rms * (2.15 + bassRange * 1.15 + dominance * 2.65));
    this.energy += (targetEnergy - this.energy) * (0.13 + this.motionProfile.tempoStability * 0.08);
    this.phase +=
      0.026 +
      this.energy * (0.065 + dominance * 0.055) +
      this.motionProfile.tempoStability * 0.012;

    const organicBreath =
      Math.sin(this.phase * 10.0) * 0.045 * (this.motionProfile.organicJitter ?? 0.55);
    this.floor.scale.setScalar(
      1 + organicBreath + this.energy * (0.28 + dominance * 0.62) * this.motion.bassScale
    );
    this.floorMaterial.opacity =
      Math.min(0.62, (0.03 + this.energy * (0.1 + dominance * 0.16)) * this.motion.bassIntensity) *
      this.mix;

    this.rings.forEach((ring, index) => {
      const offset = (this.phase + index * 0.32) % 1;
      const snappedOffset = Math.round(offset * 8) / 8;
      const beatLockedOffset = THREE.MathUtils.lerp(offset, snappedOffset, this.motionProfile.tempoStability * 0.34);
      const angularWobble =
        Math.sin(this.phase * 18 + index * 1.4) * 0.035 * (this.motionProfile.organicJitter ?? 0.55);
      const spread =
        1 +
        beatLockedOffset * (0.62 + dominance * 0.58) +
        angularWobble +
        this.energy * (0.38 + dominance * 0.72) * this.motion.bassScale;
      ring.scale.set(spread, spread, spread);
      ring.material.opacity =
        Math.min(
          0.95,
          Math.max(0.04, (1 - offset) * (0.12 + this.energy * (0.32 + dominance * 0.46))) *
            this.motion.bassIntensity
        ) * this.mix;
      ring.rotation.z +=
        0.0012 +
        index * 0.0008 +
        this.motionProfile.percussiveRatio * 0.002 +
        this.motionProfile.organicJitter * Math.sin(this.phase + index) * 0.0009;
    });
  }

  setMix(mix) {
    this.mix += (mix - this.mix) * 0.08;
    this.mesh.visible = this.mix > 0.03;
  }
}
