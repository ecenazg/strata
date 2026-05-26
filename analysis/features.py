"""
analysis/features.py — Dataclasses that describe extracted audio features.

Every frame of analysis is represented as a StemFeatures object.
A full timeline is a list of FrameFeatures (one per output frame).

These classes are the contract between the analysis layer and the
WebSocket server — both sides import from here.
"""

from __future__ import annotations
from dataclasses import dataclass, field, asdict
from typing import List, Optional
import json


@dataclass
class StemFeatures:
    """
    Perceptual features for a single stem at a single point in time.

    All values are normalised to [0, 1] EXCEPT:
    - chroma        : list of 12 floats in [0, 1] (per-semitone energy)
    - pitch_hz      : Hz (can be 0.0 if no clear pitch detected)
    - spectral_centroid : Hz (raw, not normalised — browser can scale)
    - beat_phase    : [0, 1) fraction through the current beat period
    """
    rms: float               = 0.0   # Root-mean-square energy, normalised
    onset: float             = 0.0   # Onset strength (novelty), normalised
    spectral_centroid: float = 0.0   # Hz — brightness indicator
    chroma: List[float]      = field(default_factory=lambda: [0.0] * 12)
    pitch_hz: float          = 0.0   # Dominant pitch (via librosa.yin), Hz
    beat_phase: float        = 0.0   # [0,1) phase within current beat cycle

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class FrameFeatures:
    """
    All four stems at one output timestamp.

    t         : seconds from start of audio
    frame_idx : raw librosa frame index (before FPS down-sampling)
    """
    t: float
    frame_idx: int
    melody:   StemFeatures = field(default_factory=StemFeatures)
    bass:     StemFeatures = field(default_factory=StemFeatures)
    drums:    StemFeatures = field(default_factory=StemFeatures)
    harmonic: StemFeatures = field(default_factory=StemFeatures)

    def to_dict(self) -> dict:
        return {
            "t":         self.t,
            "frame_idx": self.frame_idx,
            "melody":    self.melody.to_dict(),
            "bass":      self.bass.to_dict(),
            "drums":     self.drums.to_dict(),
            "harmonic":  self.harmonic.to_dict(),
        }


@dataclass
class FeatureTimeline:
    """
    The complete analysis result for one audio file.

    Stored as features.json and loaded by the WebSocket server.
    """
    audio_path: str
    duration:   float           # seconds
    sr:         int             # sample rate
    hop_length: int             # librosa hop
    fps:        float           # output frames per second
    stems:      List[str]       # ["melody","bass","drums","harmonic"]
    frames:     List[FrameFeatures] = field(default_factory=list)

    # ------------------------------------------------------------------ #
    # Serialisation
    # ------------------------------------------------------------------ #

    def to_dict(self) -> dict:
        return {
            "audio_path": self.audio_path,
            "duration":   self.duration,
            "sr":         self.sr,
            "hop_length": self.hop_length,
            "fps":        self.fps,
            "stems":      self.stems,
            "frames":     [f.to_dict() for f in self.frames],
        }

    def save(self, path) -> None:
        with open(path, "w") as fh:
            json.dump(self.to_dict(), fh, separators=(",", ":"))
        print(f"[features] Saved {len(self.frames)} frames → {path}")

    @classmethod
    def load(cls, path) -> "FeatureTimeline":
        with open(path) as fh:
            d = json.load(fh)
        frames = [
            FrameFeatures(
                t=f["t"],
                frame_idx=f["frame_idx"],
                melody=   StemFeatures(**f["melody"]),
                bass=     StemFeatures(**f["bass"]),
                drums=    StemFeatures(**f["drums"]),
                harmonic= StemFeatures(**f["harmonic"]),
            )
            for f in d["frames"]
        ]
        return cls(
            audio_path=d["audio_path"],
            duration=  d["duration"],
            sr=        d["sr"],
            hop_length=d["hop_length"],
            fps=       d["fps"],
            stems=     d["stems"],
            frames=    frames,
        )
