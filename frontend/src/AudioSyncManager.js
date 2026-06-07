export class AudioSyncManager {
  constructor(onFrameCallback, audioUrl, onEndedCallback = () => {}, featuresUrl) {
    this.onFrameCallback = onFrameCallback;
    this.onEndedCallback = onEndedCallback;
    this.isPlaying = false;
    this.audio = new Audio(audioUrl);
    this.audio.preload = "auto";
    this.audio.volume = 0.85;
    this.duration = 0;
    this.frames = [];
    this.frameIndex = 0;
    this.animationFrame = null;

    this.audio.addEventListener("ended", () => this.finishPlayback());
    this.ready = this.loadFeatures(featuresUrl);
  }

  async loadFeatures(featuresUrl) {
    const response = await fetch(featuresUrl);
    if (!response.ok) {
      throw new Error(`Could not load feature timeline: ${response.status}`);
    }

    const timeline = await response.json();
    this.frames = timeline.frames ?? [];
    this.duration = timeline.duration ?? 0;
    this.frameIndex = 0;
    console.log(`Loaded ${this.frames.length} feature frames.`);
  }

  finishPlayback() {
    this.audio.pause();
    this.audio.currentTime = 0;
    this.isPlaying = false;
    this.frameIndex = 0;
    cancelAnimationFrame(this.animationFrame);
    this.onEndedCallback();
  }

  async play() {
    await this.ready;
    if (this.isPlaying) return;

    await this.audio.play();
    this.isPlaying = true;
    this.streamFrames();
  }

  pause() {
    this.audio.pause();
    this.isPlaying = false;
    cancelAnimationFrame(this.animationFrame);
  }

  seek(timeSeconds = 0) {
    const duration = this.duration || this.audio.duration || 0;
    const target = Math.max(0, Math.min(Number(timeSeconds) || 0, duration));

    this.audio.currentTime = target;
    this.frameIndex = this.findFrameIndex(target);
    if (this.frames[this.frameIndex]) {
      this.onFrameCallback({ type: "frame", ...this.frames[this.frameIndex] });
    }

    return target;
  }

  togglePlayback() {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play().catch((error) => {
        console.error("Audio playback could not start:", error);
      });
    }

    return !this.isPlaying;
  }

  streamFrames() {
    if (!this.isPlaying) return;

    const currentTime = this.audio.currentTime;
    while (
      this.frameIndex + 1 < this.frames.length &&
      this.frames[this.frameIndex + 1].t <= currentTime
    ) {
      this.frameIndex += 1;
    }

    const frame = this.frames[this.frameIndex];
    if (frame) {
      this.onFrameCallback({ type: "frame", ...frame });
    }

    this.animationFrame = requestAnimationFrame(() => this.streamFrames());
  }

  findFrameIndex(timeSeconds) {
    let low = 0;
    let high = Math.max(0, this.frames.length - 1);

    while (low < high) {
      const middle = Math.floor((low + high + 1) / 2);
      if (this.frames[middle].t <= timeSeconds) {
        low = middle;
      } else {
        high = middle - 1;
      }
    }

    return low;
  }
}
