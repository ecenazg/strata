export class AudioSyncManager {
  constructor(onFrameCallback, audioUrl = "/audio/test_music.mp3", onEndedCallback = () => {}) {
    this.onFrameCallback = onFrameCallback;
    this.onEndedCallback = onEndedCallback;
    this.isPlaying = false;
    this.audio = new Audio(audioUrl);
    this.audio.preload = "auto";
    this.audio.volume = 0.85;
    this.duration = 0;

    this.audio.addEventListener("ended", () => this.finishPlayback());

    // Python sunucusuna bağlan (ws_server.py)
    this.ws = new WebSocket("ws://localhost:8765");

    this.ws.onopen = () => {
      console.log("WebSocket bağlantısı başarılı!");
    };

    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);

      if (msg.type === "ready") {
        this.duration = msg.duration ?? 0;
        console.log("Sunucu hazır. Şarkı bilgileri:", msg);
      } else if (msg.type === "frame") {
        // Python'dan gelen her frame verisini ana programa yolla
        this.onFrameCallback(msg);
      } else if (msg.type === "ended") {
        this.finishPlayback();
      }
    };

    this.ws.onerror = (error) => {
      console.error("WebSocket Hatası (Python açık mı?):", error);
    };
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
