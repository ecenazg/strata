/**
 * AudioSyncManager — drives audio playback and streams per-frame feature
 * data to the visualizer from a pre-baked features JSON file.
 *
 * No WebSocket required — all feature data is loaded as a static asset,
 * so the visualizer works on GitHub Pages or any static host.
 *
 * Typical usage:
 *   const mgr = new AudioSyncManager(onFrame, onEnded);
 *   await mgr.setTrack({ audioUrl: "/audio/foo.mp3", featuresFile: "features/foo.json" });
 *   mgr.play();
 */
export class AudioSyncManager {
  constructor(onFrameCallback, onEndedCallback = () => {}) {
    this.onFrameCallback = onFrameCallback;
    this.onEndedCallback = onEndedCallback;

    this.isPlaying   = false;
    this.frames      = [];
    this.frameIndex  = 0;
    this.duration    = 0;
    this.animationFrame = null;

    this.audio = new Audio();
    this.audio.preload = "auto";
    this.audio.volume  = 0.85;
    this.audio.addEventListener("ended", () => this.finishPlayback());
  }

  /**
   * Load a new track.  Fetches its features JSON and queues the audio.
   * Resolves with the raw FeatureTimeline data object.
   */
  async setTrack(track) {
    this.pause();
    this.frameIndex = 0;
    this.frames     = [];
    this.duration   = 0;

    // ── audio ──────────────────────────────────────────────────────────────
    this.audio.src          = track.audioUrl;
    this.audio.currentTime  = 0;
    this.audio.load();

    // ── features ───────────────────────────────────────────────────────────
    const resp = await fetch(track.featuresFile);
    if (!resp.ok) {
      throw new Error(
        `[AudioSyncManager] Could not load features: ${track.featuresFile} (${resp.status})`
      );
    }
    const data    = await resp.json();
    this.frames   = data.frames;
    this.duration = data.duration;
    return data;
  }

  // ── Playback controls ───────────────────────────────────────────────────────

  async play() {
    if (this.isPlaying) return true;
    await this.audio.play();
    this.isPlaying = true;
    this.streamFrames();
    return true;
  }

  pause() {
    this.audio.pause();
    this.isPlaying = false;
    cancelAnimationFrame(this.animationFrame);
  }

  seek(timeSeconds = 0) {
    const duration = this.duration || this.audio.duration || 0;
    const target   = Math.max(0, Math.min(Number(timeSeconds) || 0, duration));
    this.audio.currentTime = target;
    this.frameIndex        = this.findFrameIndex(target);
    if (this.frames[this.frameIndex]) {
      this.onFrameCallback({ type: "frame", ...this.frames[this.frameIndex] });
    }
    return target;
  }

  async togglePlayback() {
    if (this.isPlaying) { this.pause(); return false; }
    return this.play();
  }

  finishPlayback() {
    this.audio.pause();
    this.audio.currentTime = 0;
    this.isPlaying  = false;
    this.frameIndex = 0;
    cancelAnimationFrame(this.animationFrame);
    this.onEndedCallback();
  }

  // ── Internal ────────────────────────────────────────────────────────────────

  /** rAF loop: advances frameIndex to keep pace with audio.currentTime */
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
    if (frame) this.onFrameCallback({ type: "frame", ...frame });

    this.animationFrame = requestAnimationFrame(() => this.streamFrames());
  }

  /** Binary search for the frame index closest to timeSeconds */
  findFrameIndex(timeSeconds) {
    if (!this.frames.length) return 0;
    let low = 0, high = this.frames.length - 1;
    while (low < high) {
      const mid = Math.floor((low + high + 1) / 2);
      if (this.frames[mid].t <= timeSeconds) low = mid;
      else high = mid - 1;
    }
    return low;
  }
}
