"""
server/player.py — Playback clock that drives the WebSocket frame stream.

Responsibilities
----------------
* Keep a virtual playback position (seconds) that advances in real time.
* Yield the correct FrameFeatures at the right wall-clock moment.
* Support play / pause / seek / speed-change without drift.
* Be decoupled from WebSocket concerns — the server calls next_frame().

Clock design
------------
We use asyncio.sleep() with a short look-ahead so frames arrive slightly
early rather than late (the browser prefers early delivery).  A correction
term accumulates any sleep overshoot and applies it to the next sleep.

The player does NOT stream audio — audio playback is handled entirely in
the browser (Web Audio API).  The server only streams feature data.
"""

from __future__ import annotations
import asyncio
import time
from typing import AsyncIterator, Optional

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))
import config
from analysis.features import FeatureTimeline, FrameFeatures


class Player:
    """
    Async iterator that yields (FrameFeatures, t) tuples at real time.

    Usage
    -----
        player = Player(timeline)
        player.play()
        async for frame, t in player:
            await ws.send(frame_to_json(frame, t))
    """

    def __init__(self, timeline: FeatureTimeline) -> None:
        self._tl        = timeline
        self._idx       = 0           # current frame index into timeline.frames
        self._playing   = False
        self._speed     = 1.0
        self._seek_to: Optional[float] = None  # pending seek target (seconds)
        self._wall_ref  = 0.0         # wall-clock time when current segment started
        self._play_ref  = 0.0         # playback time at _wall_ref
        self._lock      = asyncio.Lock()

    # ------------------------------------------------------------------ #
    # Control methods (call from WebSocket handler coroutine)
    # ------------------------------------------------------------------ #

    async def play(self) -> None:
        async with self._lock:
            if not self._playing:
                self._wall_ref = time.monotonic()
                self._play_ref = self._current_t()
                self._playing  = True

    async def pause(self) -> None:
        async with self._lock:
            if self._playing:
                self._play_ref = self._virtual_t()
                self._playing  = False

    async def seek(self, t: float) -> None:
        async with self._lock:
            t = max(0.0, min(t, self._tl.duration))
            self._seek_to  = t
            self._play_ref = t
            self._wall_ref = time.monotonic()
            # Snap index to nearest frame
            self._idx = self._frame_index_at(t)

    async def set_speed(self, factor: float) -> None:
        async with self._lock:
            factor = max(0.1, min(factor, 5.0))
            # Preserve current virtual position before changing speed
            self._play_ref = self._virtual_t()
            self._wall_ref = time.monotonic()
            self._speed    = factor

    # ------------------------------------------------------------------ #
    # Async iterator
    # ------------------------------------------------------------------ #

    def __aiter__(self) -> "Player":
        return self

    async def __anext__(self) -> tuple[FrameFeatures, float]:
        """
        Block until the next frame is due, then return it.

        Raises StopAsyncIteration when playback reaches the end.
        """
        correction = 0.0  # accumulated sleep overshoot

        while True:
            async with self._lock:
                # Apply pending seek
                if self._seek_to is not None:
                    self._idx     = self._frame_index_at(self._seek_to)
                    self._seek_to = None

                # End of timeline
                if self._idx >= len(self._tl.frames):
                    raise StopAsyncIteration

                frame = self._tl.frames[self._idx]
                target_t = frame.t  # when this frame should be delivered

                if not self._playing:
                    # Paused — just yield current position without advancing
                    await asyncio.sleep(config.WS_FRAME_INTERVAL)
                    continue

                virtual_now = self._virtual_t()

            # How long until this frame is due?
            delay = (target_t - virtual_now) / self._speed - correction
            if delay > 0.001:
                before = time.monotonic()
                await asyncio.sleep(delay)
                correction = (time.monotonic() - before) - delay
            else:
                correction = 0.0

            async with self._lock:
                self._idx += 1

            return frame, frame.t

    # ------------------------------------------------------------------ #
    # Internal
    # ------------------------------------------------------------------ #

    def _virtual_t(self) -> float:
        """Current virtual playback position in seconds."""
        if not self._playing:
            return self._play_ref
        elapsed = (time.monotonic() - self._wall_ref) * self._speed
        return min(self._play_ref + elapsed, self._tl.duration)

    def _current_t(self) -> float:
        """Playback position at the current frame index."""
        if self._idx < len(self._tl.frames):
            return self._tl.frames[self._idx].t
        return self._tl.duration

    def _frame_index_at(self, t: float) -> int:
        """Binary search for the frame index closest to time t."""
        lo, hi = 0, len(self._tl.frames) - 1
        while lo < hi:
            mid = (lo + hi) // 2
            if self._tl.frames[mid].t < t:
                lo = mid + 1
            else:
                hi = mid
        return lo

    @property
    def position(self) -> float:
        return self._virtual_t()

    @property
    def playing(self) -> bool:
        return self._playing

    @property
    def duration(self) -> float:
        return self._tl.duration
