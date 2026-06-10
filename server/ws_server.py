"""
server/ws_server.py — asyncio WebSocket server that streams feature frames.

Protocol
--------
On connect:
  Server → Client:  { "type": "ready", "duration": 45.2, "sr": 44100,
                       "hop_length": 512, "fps": 60.0,
                       "stems": ["melody","bass","drums","harmonic"] }

Client → Server commands:
  { "cmd": "play" }
  { "cmd": "pause" }
  { "cmd": "seek",   "t": 12.5 }
  { "cmd": "speed",  "factor": 1.5 }
  { "cmd": "mute",   "stem": "bass",   "muted": true }
  { "cmd": "solo",   "stem": "melody" }
  { "cmd": "unsolo" }

Server → Client frame (every ~1/60 s during playback):
  {
    "type": "frame", "t": 1.234,
    "melody":   { "rms": 0.04, "onset": 0.8, "spectral_centroid": 3200.5,
                  "chroma": [...12...], "pitch_hz": 440.0, "beat_phase": 0.34 },
    "bass":     { ... },
    "drums":    { ... },
    "harmonic": { ... }
  }

Server → Client when done:
  { "type": "ended" }

Multi-client
------------
All connected clients receive the SAME frame stream from a single shared
Player instance.  Control commands from ANY client affect all clients
(intended for a presenter + audience setup).  If you want per-client
state, start multiple server instances on different ports.
"""

from __future__ import annotations
import asyncio
import json
import logging
from typing import Any, Dict, Set, Optional

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))
import config
from analysis.features import FeatureTimeline, FrameFeatures
from server.player import Player

log = logging.getLogger("strata.ws")


# ---------------------------------------------------------------------------
# Mute / solo state (shared across all clients)
# ---------------------------------------------------------------------------

class StemState:
    """Tracks which stems are muted or soloed."""

    def __init__(self, stem_names: list[str]) -> None:
        self._muted: Set[str] = set()
        self._solo:  Optional[str] = None
        self._names  = stem_names

    def set_mute(self, stem: str, muted: bool) -> None:
        if stem not in self._names:
            return
        if muted:
            self._muted.add(stem)
        else:
            self._muted.discard(stem)

    def set_solo(self, stem: Optional[str]) -> None:
        if stem is not None and stem not in self._names:
            return
        self._solo = stem

    def active_stems(self) -> Set[str]:
        """Return the set of stems that should be included in the frame."""
        if self._solo:
            return {self._solo}
        return set(self._names) - self._muted

    def to_dict(self) -> dict:
        return {"muted": list(self._muted), "solo": self._solo}


# ---------------------------------------------------------------------------
# Server
# ---------------------------------------------------------------------------

class StrataServer:
    """
    Manages the Player and all WebSocket connections.

    Call run() to start serving.
    """

    def __init__(
        self,
        timeline: FeatureTimeline,
        tracks: Optional[Dict[str, dict[str, Any]]] = None,
        default_track_id: Optional[str] = None,
    ) -> None:
        self._tracks = tracks or {}
        if self._tracks:
            self._current_track_id = default_track_id or next(iter(self._tracks))
            if self._current_track_id not in self._tracks:
                self._current_track_id = next(iter(self._tracks))
            timeline = self._tracks[self._current_track_id]["timeline"]
        else:
            self._current_track_id = None

        self._tl = timeline
        self._player = Player(timeline)
        self._stems = StemState(timeline.stems)
        self._clients: Set = set()

    # ------------------------------------------------------------------ #
    # Public entry point
    # ------------------------------------------------------------------ #

    async def run(self, host: str = config.WS_HOST, port: int = config.WS_PORT) -> None:
        """Start WebSocket server and the frame broadcast loop."""
        try:
            import websockets
        except ImportError:
            raise ImportError("websockets not installed: pip install websockets")

        broadcast_task = asyncio.create_task(self._broadcast_loop())

        print(f"[server] Listening on ws://{host}:{port}")
        print("[server] Waiting for browser to connect …")

        async with websockets.serve(self._handle_client, host, port):
            await broadcast_task  # runs until cancelled

    # ------------------------------------------------------------------ #
    # Per-client handler
    # ------------------------------------------------------------------ #

    async def _handle_client(self, ws) -> None:
        self._clients.add(ws)
        client_addr = ws.remote_address
        log.info("Client connected: %s (total: %d)", client_addr, len(self._clients))

        # Send initial ready message.
        await ws.send(json.dumps(self._ready_payload("ready")))

        try:
            async for raw in ws:
                await self._handle_command(raw)
        except Exception:
            pass
        finally:
            self._clients.discard(ws)
            log.info("Client disconnected: %s (total: %d)", client_addr, len(self._clients))

    # ------------------------------------------------------------------ #
    # Command dispatcher
    # ------------------------------------------------------------------ #

    async def _handle_command(self, raw: str) -> None:
        try:
            msg = json.loads(raw)
        except json.JSONDecodeError:
            log.warning("Received non-JSON message: %s", raw[:80])
            return

        cmd = msg.get("cmd")

        if cmd == "play":
            await self._player.play()
            log.info("CMD play")

        elif cmd == "pause":
            await self._player.pause()
            log.info("CMD pause")

        elif cmd == "seek":
            t = float(msg.get("t", 0.0))
            await self._player.seek(t)
            await self._broadcast({
                "type": "seeked",
                "t": t,
                "track_id": self._current_track_id,
            })
            log.info("CMD seek t=%.2f", t)

        elif cmd == "track":
            track_id = msg.get("track_id") or msg.get("trackId")
            await self._select_track(track_id)

        elif cmd == "speed":
            factor = float(msg.get("factor", 1.0))
            await self._player.set_speed(factor)
            log.info("CMD speed factor=%.2f", factor)

        elif cmd == "mute":
            stem  = msg.get("stem", "")
            muted = bool(msg.get("muted", True))
            self._stems.set_mute(stem, muted)
            await self._broadcast({"type": "stem_state", **self._stems.to_dict()})
            log.info("CMD mute stem=%s muted=%s", stem, muted)

        elif cmd == "solo":
            stem = msg.get("stem")
            self._stems.set_solo(stem)
            await self._broadcast({"type": "stem_state", **self._stems.to_dict()})
            log.info("CMD solo stem=%s", stem)

        elif cmd == "unsolo":
            self._stems.set_solo(None)
            await self._broadcast({"type": "stem_state", **self._stems.to_dict()})
            log.info("CMD unsolo")

        else:
            log.warning("Unknown command: %s", cmd)

    # ------------------------------------------------------------------ #
    # Broadcast loop
    # ------------------------------------------------------------------ #

    async def _broadcast_loop(self) -> None:
        """Continuously pull frames from the Player and broadcast to all clients."""
        while True:
            player = self._player
            try:
                frame, t = await asyncio.wait_for(
                    player.__anext__(),
                    timeout=max(config.WS_FRAME_INTERVAL * 4, 0.05),
                )
            except asyncio.TimeoutError:
                continue

            if player is not self._player:
                continue
            if not self._clients:
                continue

            if frame is None:
                await self._broadcast({
                    "type": "ended",
                    "track_id": self._current_track_id,
                })
                log.info("Playback ended.")
                continue

            msg = self._frame_to_msg(frame, t)
            await self._broadcast(msg)

    async def _broadcast(self, msg: dict) -> None:
        if not self._clients:
            return
        payload = json.dumps(msg, separators=(",", ":"))
        # Send to all connected clients; remove any that have disconnected
        dead = set()
        for ws in list(self._clients):
            try:
                await ws.send(payload)
            except Exception:
                dead.add(ws)
        self._clients -= dead

    # ------------------------------------------------------------------ #
    # Frame serialisation
    # ------------------------------------------------------------------ #

    async def _select_track(self, track_id: Optional[str]) -> None:
        if not self._tracks:
            await self._broadcast({
                "type": "track_error",
                "message": "Track switching requires a track manifest on the backend.",
            })
            log.warning("CMD track ignored: no track manifest loaded")
            return

        if not track_id or track_id not in self._tracks:
            await self._broadcast({
                "type": "track_error",
                "message": f"Unknown track: {track_id}",
            })
            log.warning("CMD track unknown id=%s", track_id)
            return

        await self._player.pause()
        self._current_track_id = track_id
        self._tl = self._tracks[track_id]["timeline"]
        self._player = Player(self._tl)
        self._stems = StemState(self._tl.stems)
        await self._broadcast(self._ready_payload("track_ready"))
        log.info("CMD track id=%s", track_id)

    def _ready_payload(self, msg_type: str) -> dict:
        return {
            "type": msg_type,
            "track_id": self._current_track_id,
            "duration": self._tl.duration,
            "sr": self._tl.sr,
            "hop_length": self._tl.hop_length,
            "fps": self._tl.fps,
            "stems": self._tl.stems,
            "stem_state": self._stems.to_dict(),
            "tracks": self._track_metadata(),
        }

    def _track_metadata(self) -> list[dict]:
        if not self._tracks:
            return []
        metadata = []
        for track_id, item in self._tracks.items():
            timeline = item["timeline"]
            meta = dict(item.get("meta", {}))
            meta.update({
                "id": track_id,
                "duration": timeline.duration,
                "fps": timeline.fps,
                "stems": timeline.stems,
            })
            metadata.append(meta)
        return metadata

    def _frame_to_msg(self, frame: FrameFeatures, t: float) -> dict:
        active = self._stems.active_stems()
        stem_names = ["melody", "bass", "drums", "harmonic"]

        def stem_dict(sf):
            return {
                "rms":               round(sf.rms, 4),
                "onset":             round(sf.onset, 4),
                "spectral_centroid": round(sf.spectral_centroid, 1),
                "chroma":            [round(c, 3) for c in sf.chroma],
                "pitch_hz":          round(sf.pitch_hz, 2),
                "beat_phase":        round(sf.beat_phase, 4),
            }

        msg: dict = {
            "type": "frame",
            "track_id": self._current_track_id,
            "t": round(t, 4),
        }
        for name in stem_names:
            sf = getattr(frame, name)
            if name in active:
                msg[name] = stem_dict(sf)
            else:
                # Muted stem — send zeroed values so the browser can fade out
                msg[name] = {
                    "rms": 0.0, "onset": 0.0, "spectral_centroid": 0.0,
                    "chroma": [0.0] * 12, "pitch_hz": 0.0, "beat_phase": sf.beat_phase,
                }
        return msg


# ---------------------------------------------------------------------------
# Convenience runner
# ---------------------------------------------------------------------------

async def serve(
    timeline: FeatureTimeline,
    host: str = config.WS_HOST,
    port: int = config.WS_PORT,
    tracks: Optional[Dict[str, dict[str, Any]]] = None,
    default_track_id: Optional[str] = None,
):
    """Start the server.  Blocks until cancelled."""
    server = StrataServer(
        timeline,
        tracks=tracks,
        default_track_id=default_track_id,
    )
    await server.run(host, port)
