export class AudioSyncManager {
  constructor(onFrameCallback) {
    this.onFrameCallback = onFrameCallback;

    // Python sunucusuna bağlan (ws_server.py)
    this.ws = new WebSocket("ws://localhost:8765");

    this.ws.onopen = () => {
      console.log("WebSocket bağlantısı başarılı!");
    };

    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);

      if (msg.type === "ready") {
        console.log("Sunucu hazır. Şarkı bilgileri:", msg);
        // Şimdilik tıklar tıklamaz başlatmak yerine konsola hazır yazdırıyoruz.
        // İleride buraya müziği başlatma (play) kodunu ekleyeceğiz.
      } else if (msg.type === "frame") {
        // Python'dan gelen her frame verisini ana programa yolla
        this.onFrameCallback(msg);
      }
    };

    this.ws.onerror = (error) => {
      console.error("WebSocket Hatası (Python açık mı?):", error);
    };
  }

  // Müziği başlat komutu
  play() {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ cmd: "play" }));
    }
  }
}
