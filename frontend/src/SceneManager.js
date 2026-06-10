import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { DEFAULT_VISUAL_PROFILE } from "./visualProfiles.js";

const LOOK_AT = new THREE.Vector3(0, 0.75, -2.2);
const MIN_CAMERA_DISTANCE = 4.2;
const MAX_CAMERA_DISTANCE = 13.5;

export class SceneManager {
  constructor() {
    this.scene = new THREE.Scene();
    this.phase = "opening";
    this.profile = DEFAULT_VISUAL_PROFILE;
    this.separationReveal = 0;
    this.transitionPulse = 0;
    this.beatPulse = 0;
    this.cameraControls = {
      azimuth: 0,
      elevation: 0.24,
      distance: 8.6,
      dragging: false,
      lastX: 0,
      lastY: 0,
    };

    this.camera = new THREE.PerspectiveCamera(
      48,
      window.innerWidth / window.innerHeight,
      0.1,
      120
    );
    this._updateCameraPosition();

    const bg = this.profile.colors.background;
    this.scene.background = new THREE.Color(bg);
    this.scene.fog = new THREE.FogExp2(bg, 0.055);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.domElement.className = "strata-canvas";
    document.body.appendChild(this.renderer.domElement);

    this.ambientLight = new THREE.AmbientLight(this.profile.colors.ambient, 0.45);
    this.scene.add(this.ambientLight);

    this.keyLight = new THREE.DirectionalLight(this.profile.colors.keyLight, 1.25);
    this.keyLight.position.set(3, 5, 4);
    this.scene.add(this.keyLight);

    this.warmLight = new THREE.PointLight(this.profile.colors.warmLight, 2.4, 16);
    this.warmLight.position.set(-2.8, 0.6, 1.2);
    this.scene.add(this.warmLight);

    this.cyanLight = new THREE.PointLight(this.profile.colors.coolLight, 2.2, 16);
    this.cyanLight.position.set(2.2, 1.4, -2.5);
    this.scene.add(this.cyanLight);

    this.backdrop = new THREE.Group();
    this.scene.add(this.backdrop);
    this._createStarField();
    this._createEnergyStage();
    this._createSeparationStreams();

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));

    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.72,
      0.42,
      0.18
    );
    this.composer.addPass(this.bloomPass);

    this._setupCameraControls();
    window.addEventListener("resize", () => this._onResize());
  }

  setPhase(phase) {
    if (phase !== this.phase) {
      this.transitionPulse = 1;
    }
    this.phase = phase;
  }

  applyVisualProfile(profile) {
    this.profile = profile;

    this.scene.background.setHex(profile.colors.background);
    this.scene.fog.color.setHex(profile.colors.background);
    this.ambientLight.color.setHex(profile.colors.ambient);
    this.keyLight.color.setHex(profile.colors.keyLight);
    this.warmLight.color.setHex(profile.colors.warmLight);
    this.cyanLight.color.setHex(profile.colors.coolLight);
    this.core.material.color.setHex(profile.colors.core);
    this.incomingStream.material.color.setHex(profile.colors.incoming);
    this.incomingStream.userData.head.material.color.setHex(profile.colors.incoming);

    this.energyRings.forEach((ring, index) => {
      ring.material.color.setHex(profile.colors.stage[index % profile.colors.stage.length]);
    });

    const streamColors = [
      profile.colors.stems.bass,
      profile.colors.stems.drums,
      profile.colors.stems.melody,
      profile.colors.stems.harmony,
    ];
    this.separationStreams.forEach((line, index) => {
      line.material.color.setHex(streamColors[index]);
      line.userData.head.material.color.setHex(streamColors[index]);
    });

    this._applyStarFieldColors(profile.colors.stars);
    document.body.style.setProperty("--profile-flash-warm", profile.colors.flashWarm);
    document.body.style.setProperty("--profile-flash-cool", profile.colors.flashCool);
  }

  update(elapsed, frame) {
    const bass = frame?.bass?.rms ?? 0;
    const drums = frame?.drums?.onset ?? 0;
    const harmonic = frame?.harmonic?.rms ?? 0;
    const beatTarget = Math.min(1, bass * 1.8 + drums * 1.25);
    this.beatPulse += (beatTarget - this.beatPulse) * 0.28;

    this.starField.rotation.y = elapsed * 0.012;
    this.starField.rotation.x = Math.sin(elapsed * 0.08) * 0.025;

    this.core.rotation.y = elapsed * 0.45;
    this.transitionPulse *= 0.92;
    this.core.scale.setScalar(
      1 + harmonic * 0.35 + drums * 0.12 + this.transitionPulse * 0.62
    );
    this.core.material.opacity = Math.min(
      1,
      0.72 + this.transitionPulse * 0.28 + this.beatPulse * 0.12
    );

    this.energyRings.forEach((ring, index) => {
      const pulse = 1 + bass * (0.45 + index * 0.18);
      ring.scale.setScalar(pulse);
      ring.rotation.z += 0.0018 + index * 0.0007;
      ring.material.opacity =
        0.14 + bass * 0.28 - index * 0.02 + this.transitionPulse * 0.1;
    });

    if (!this.cameraControls.dragging) {
      this.cameraControls.azimuth += 0.0006;
    }
    this._updateCameraPosition();

    const motion = this.profile.motion;
    this.warmLight.intensity = 2.0 + bass * 1.8 + this.transitionPulse * 2.5;
    this.cyanLight.intensity =
      1.8 + harmonic * 1.4 + drums * 0.6 + this.transitionPulse * 2.0 + this.beatPulse * 1.8;
    this.bloomPass.strength =
      motion.bloomBase + this.beatPulse * motion.bloomBeat + this.transitionPulse * 0.2;
    document.body.style.setProperty(
      "--beat-flash",
      (this.beatPulse * motion.beatFlash).toFixed(3)
    );
    this._updateSeparationStreams(elapsed, frame);
  }

  render() {
    this.composer.render();
  }

  _createStarField() {
    const count = 900;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const colorA = new THREE.Color(this.profile.colors.stars[0]);
    const colorB = new THREE.Color(this.profile.colors.stars[1]);
    const colorC = new THREE.Color(this.profile.colors.stars[2]);

    for (let i = 0; i < count; i++) {
      const radius = 6 + Math.random() * 18;
      const theta = Math.random() * Math.PI * 2;
      const y = -3 + Math.random() * 10;

      positions[i * 3] = Math.cos(theta) * radius;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = -8 - Math.random() * 28;

      const color = i % 5 === 0 ? colorB : i % 3 === 0 ? colorC : colorA;
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    this.starField = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({
        size: 0.022,
        vertexColors: true,
        transparent: true,
        opacity: 0.72,
        depthWrite: false,
      })
    );
    this.backdrop.add(this.starField);
  }

  _applyStarFieldColors(colors) {
    const colorAttribute = this.starField.geometry.getAttribute("color");
    const colorA = new THREE.Color(colors[0]);
    const colorB = new THREE.Color(colors[1]);
    const colorC = new THREE.Color(colors[2]);

    for (let i = 0; i < colorAttribute.count; i++) {
      const color = i % 5 === 0 ? colorB : i % 3 === 0 ? colorC : colorA;
      colorAttribute.setXYZ(i, color.r, color.g, color.b);
    }
    colorAttribute.needsUpdate = true;
  }

  _createEnergyStage() {
    this.energyRings = [];

    for (let i = 0; i < 4; i++) {
      const geometry = new THREE.TorusGeometry(1.8 + i * 0.62, 0.01, 8, 180);
      const material = new THREE.MeshBasicMaterial({
        color: this.profile.colors.stage[i % this.profile.colors.stage.length],
        transparent: true,
        opacity: 0.12,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const ring = new THREE.Mesh(geometry, material);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(0, -1.45, -1.3);
      this.energyRings.push(ring);
      this.scene.add(ring);
    }

    const coreGeometry = new THREE.IcosahedronGeometry(0.42, 2);
    const coreMaterial = new THREE.MeshBasicMaterial({
      color: this.profile.colors.core,
      transparent: true,
      opacity: 0.9,
      wireframe: true,
      blending: THREE.AdditiveBlending,
    });
    this.core = new THREE.Mesh(coreGeometry, coreMaterial);
    this.core.position.set(0, 0.85, -1.9);
    this.scene.add(this.core);
  }

  _createSeparationStreams() {
    this.separationGroup = new THREE.Group();
    this.scene.add(this.separationGroup);

    const origin = new THREE.Vector3(0, 0.85, -1.9);
    this.incomingStream = this._createStream(
      [
        new THREE.Vector3(-3.8, 0.78, -1.15),
        new THREE.Vector3(-2.1, 1.08, -1.55),
        origin,
      ],
      this.profile.colors.incoming,
      0.5
    );

    this.separationStreams = [
      this._createStream(
        [
          origin,
          new THREE.Vector3(0.9, 0.1, -1.4),
          new THREE.Vector3(2.9, -1.25, -1.25),
        ],
        this.profile.colors.stems.bass,
        0.56
      ),
      this._createStream(
        [
          origin,
          new THREE.Vector3(1.3, 1.25, -2.2),
          new THREE.Vector3(2.35, 1.1, -2.65),
        ],
        this.profile.colors.stems.drums,
        0.62
      ),
      this._createStream(
        [
          origin,
          new THREE.Vector3(-1.1, 1.15, -1.75),
          new THREE.Vector3(-2.9, 0.52, -1.7),
        ],
        this.profile.colors.stems.melody,
        0.58
      ),
      this._createStream(
        [
          origin,
          new THREE.Vector3(-0.35, 2.2, -2.7),
          new THREE.Vector3(0.15, 2.75, -3.65),
        ],
        this.profile.colors.stems.harmony,
        0.5
      ),
    ];
  }

  _createStream(controlPoints, color, baseOpacity) {
    const curve = new THREE.CatmullRomCurve3(controlPoints);
    const points = curve.getPoints(84);
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    geometry.setDrawRange(0, 0);

    const material = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const line = new THREE.Line(geometry, material);
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.055, 16, 16),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );

    line.userData = {
      baseOpacity,
      head,
      pointCount: points.length,
      points,
    };

    this.separationGroup.add(line);
    this.separationGroup.add(head);
    return line;
  }

  _updateSeparationStreams(elapsed, frame) {
    const targetReveal =
      this.phase === "separation" ? 1 : this.phase === "combined" ? 0.32 : 0.12;
    this.separationReveal += (targetReveal - this.separationReveal) * 0.08;

    const allStreams = [this.incomingStream, ...this.separationStreams];
    const pulse =
      0.9 +
      Math.sin(elapsed * 5.0) * 0.08 +
      ((frame?.bass?.rms ?? 0) + (frame?.drums?.onset ?? 0)) * 0.18;

    allStreams.forEach((line, index) => {
      const reveal = Math.max(0.02, this.separationReveal - index * 0.035);
      const drawCount = Math.max(2, Math.ceil(line.userData.pointCount * reveal));
      const pointIndex = Math.min(line.userData.pointCount - 1, drawCount - 1);
      const head = line.userData.head;

      line.geometry.setDrawRange(0, drawCount);
      line.material.opacity = line.userData.baseOpacity * reveal * pulse;
      head.position.copy(line.userData.points[pointIndex]);
      head.material.opacity = Math.min(0.88, line.material.opacity * 1.45);
      head.scale.setScalar(0.8 + reveal * 1.15);
    });
  }

  _onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.composer.setSize(window.innerWidth, window.innerHeight);
  }

  _setupCameraControls() {
    const canvas = this.renderer.domElement;

    canvas.addEventListener("pointerdown", (event) => {
      this.cameraControls.dragging = true;
      this.cameraControls.lastX = event.clientX;
      this.cameraControls.lastY = event.clientY;
      canvas.setPointerCapture(event.pointerId);
    });

    canvas.addEventListener("pointermove", (event) => {
      if (!this.cameraControls.dragging) return;
      const dx = event.clientX - this.cameraControls.lastX;
      const dy = event.clientY - this.cameraControls.lastY;
      this.cameraControls.lastX = event.clientX;
      this.cameraControls.lastY = event.clientY;

      this.cameraControls.azimuth -= dx * 0.006;
      this.cameraControls.elevation = THREE.MathUtils.clamp(
        this.cameraControls.elevation + dy * 0.004,
        -0.42,
        0.88
      );
    });

    canvas.addEventListener("pointerup", (event) => {
      this.cameraControls.dragging = false;
      canvas.releasePointerCapture(event.pointerId);
    });

    canvas.addEventListener("pointerleave", () => {
      this.cameraControls.dragging = false;
    });

    canvas.addEventListener(
      "wheel",
      (event) => {
        event.preventDefault();
        this.cameraControls.distance = THREE.MathUtils.clamp(
          this.cameraControls.distance + event.deltaY * 0.006,
          MIN_CAMERA_DISTANCE,
          MAX_CAMERA_DISTANCE
        );
      },
      { passive: false }
    );
  }

  _updateCameraPosition() {
    const { azimuth, elevation, distance } = this.cameraControls;
    const punchedDistance =
      distance -
      this.beatPulse * 0.42 * this.profile.motion.cameraPunch -
      this.transitionPulse * 0.18;
    const horizontalDistance = Math.cos(elevation) * punchedDistance;

    this.camera.position.set(
      LOOK_AT.x + Math.sin(azimuth) * horizontalDistance,
      LOOK_AT.y + Math.sin(elevation) * punchedDistance,
      LOOK_AT.z + Math.cos(azimuth) * horizontalDistance
    );
    this.camera.lookAt(LOOK_AT);
  }
}
