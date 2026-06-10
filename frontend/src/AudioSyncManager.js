export class AudioSyncManager {
  constructor(
    onFrameCallback,
    audioUrl = null,
    onEndedCallback = () => {},
    onReadyCallback = () => {},
  ) {
    this.onFrameCallback = onFrameCallback;
    this.onEndedCallback = onEndedCallback;
    this.onReadyCallback = onReadyCallback;
    this.isPlaying = false;
    this.audio = new Audio();
    this.audio.preload = "auto";
    this.audio.volume = 0.85;
    this.duration = 0;
    this.trackId = null;
    this.pendingTrackId = null;

    if (audioUrl) {
      this.audio.src = audioUrl;
    }

    this.audio.addEventListener("ended", () => this.finishPlayback());

    this.ws = new WebSocket("ws://localhost:8765");

    this.ws.onopen = () => {
      console.log("WebSocket bağlantısı başarılı!");
      if (this.pendingTrackId) {
        this.ws.send(JSON.stringify({ cmd: "track", track_id: this.pendingTrackId }));
        this.pendingTrackId = null;
      }
    };

    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);

      if (msg.type === "ready") {
        this.duration = msg.duration ?? 0;
        this.trackId = msg.track_id ?? this.trackId;
        this.onReadyCallback(msg);
        console.log("Sunucu hazır. Şarkı bilgileri:", msg);
      } else if (msg.type === "track_ready") {
        this.duration = msg.duration ?? 0;
        this.trackId = msg.track_id ?? this.trackId;
        this.onReadyCallback(msg);
        console.log("Track hazır:", msg);
      } else if (msg.type === "frame") {
        if (msg.track_id && this.trackId && msg.track_id !== this.trackId) return;
        this.onFrameCallback(msg);
      } else if (msg.type === "ended") {
        if (msg.track_id && this.trackId && msg.track_id !== this.trackId) return;
        this.finishPlayback();
      } else if (msg.type === "track_error") {
        console.error("Track switch failed:", msg.message);
      }
    };

    this.ws.onerror = (error) => {
      console.error("WebSocket Hatası (Python açık mı?):", error);
    };
  }

  setTrack(track) {
    if (!track?.audioUrl) return;

    this.pause();
    this.trackId = track.id ?? null;
    this.duration = 0;
    this.audio.src = track.audioUrl;
    this.audio.currentTime = 0;
    this.audio.load();

    if (this.ws.readyState === WebSocket.OPEN && this.trackId) {
      this.ws.send(JSON.stringify({ cmd: "track", track_id: this.trackId }));
    } else {
      this.pendingTrackId = this.trackId;
    }
  }

  finishPlayback() {
    this.audio.pause();
    this.audio.currentTime = 0;
    this.isPlaying = false;
    this.onEndedCallback();
  }

  play() {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ cmd: "play" }));
    }

    if (!this.isPlaying) {
      this.audio.play().catch((error) => {
        console.error("Audio playback could not start:", error);
      });
      this.isPlaying = true;
    }

    return this.isPlaying;
  }

  pause() {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ cmd: "pause" }));
    }

    this.audio.pause();
    this.isPlaying = false;
  }

  seek(timeSeconds = 0) {
    const duration = this.duration || this.audio.duration || 0;
    const target = Math.max(0, Math.min(Number(timeSeconds) || 0, duration));

    this.audio.currentTime = target;
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ cmd: "seek", t: target }));
    }

    return target;
  }

  togglePlayback() {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }

    return this.isPlaying;
  }
}
