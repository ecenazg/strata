export class AudioSyncManager {
  constructor(onFrameCallback, audioUrl = "/audio/test_music.mp3") {
    this.onFrameCallback = onFrameCallback;
    this.isPlaying = false;
    this.audio = new Audio(audioUrl);
    this.audio.preload = "auto";
    this.audio.volume = 0.85;
    this.duration = 0;

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
        this.audio.pause();
        this.isPlaying = false;
      }
    };

    this.ws.onerror = (error) => {
      console.error("WebSocket Hatası (Python açık mı?):", error);
    };
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

  togglePlayback() {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }

    return this.isPlaying;
  }
}
