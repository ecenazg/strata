"""
analysis/feature_extractor.py — librosa feature pipeline (lazy import).
"""
from __future__ import annotations
import json, logging, time
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Callable
import numpy as np

log = logging.getLogger(__name__)


@dataclass
class StemFrame:
    i: int; t: float; rms: float; onset: float; centroid: float
    chroma: list; pitch: int; beat: bool


@dataclass
class StemFeatures:
    stem: str; duration: float; sample_rate: int; hop_length: int
    hop_ms: float; n_frames: int; rms_global_max: float; frames: list

    def to_json(self):
        return json.dumps(asdict(self), separators=(",",":"))

    @classmethod
    def from_json(cls, text):
        d = json.loads(text)
        frames = [StemFrame(**f) for f in d.pop("frames")]
        return cls(**d, frames=frames)


def extract_all(stem_paths, features_dir, sample_rate=44100, hop_length=512,
                onset_delta=0.07, bpm_prior=None, progress_cb=None, force=False):
    features_dir = Path(features_dir)
    features_dir.mkdir(parents=True, exist_ok=True)
    results = {}
    items = list(stem_paths.items())
    for idx, (name, wav) in enumerate(items):
        out = features_dir / f"{name}_features.json"
        if not force and out.exists():
            log.info("Cached: %s", name)
            results[name] = StemFeatures.from_json(out.read_text())
        else:
            log.info("Extracting: %s", name)
            t0 = time.perf_counter()
            sf = extract_stem(wav, name, sample_rate, hop_length, onset_delta, bpm_prior)
            log.info("  %s — %d frames in %.1fs", name, sf.n_frames, time.perf_counter()-t0)
            out.write_text(sf.to_json())
            results[name] = sf
        if progress_cb:
            progress_cb(name, (idx+1)/len(items))
    return results


def extract_stem(wav_path, stem_name, sample_rate=44100, hop_length=512,
                 onset_delta=0.07, bpm_prior=None):
    try:
        import librosa
    except ImportError as e:
        raise RuntimeError("librosa not installed. Run: pip install librosa") from e
    audio, sr = librosa.load(str(wav_path), sr=sample_rate, mono=True)
    dur = len(audio)/sr
    n_fft = 2048
    rms_f = librosa.feature.rms(y=audio, frame_length=n_fft, hop_length=hop_length)[0]
    onset = librosa.onset.onset_strength(y=audio, sr=sr, hop_length=hop_length, n_mels=128)
    cent  = librosa.feature.spectral_centroid(y=audio, sr=sr, n_fft=n_fft, hop_length=hop_length)[0]
    chroma= librosa.feature.chroma_cqt(y=audio, sr=sr, hop_length=hop_length, bins_per_octave=36)
    _, bf = librosa.beat.beat_track(onset_envelope=onset, sr=sr, hop_length=hop_length,
                                    start_bpm=bpm_prior or 120.0, tightness=100)
    beat_set = set(bf.tolist())
    n = min(len(rms_f), len(onset), len(cent), chroma.shape[1])
    rmax  = float(np.percentile(rms_f[:n], 99)) or 1e-6
    omax  = float(onset[:n].max()) or 1e-6
    nyq   = sr/2.0
    cn    = np.clip(cent[:n]/nyq, 0.0, 1.0)
    frames = []
    for i in range(n):
        cr = chroma[:,i].astype(float)
        cs = cr.sum()
        ch = (cr/cs).tolist() if cs>1e-8 else [0.0]*12
        frames.append(StemFrame(
            i=i, t=round(i*hop_length/sr,4),
            rms=round(float(np.clip(rms_f[i]/rmax,0,1)),4),
            onset=round(float(np.clip(onset[i]/omax,0,1)),4),
            centroid=round(float(cn[i]),4),
            chroma=[round(v,4) for v in ch],
            pitch=60+int(np.argmax(cr)),
            beat=i in beat_set,
        ))
    return StemFeatures(stem=stem_name, duration=round(dur,4), sample_rate=sr,
                        hop_length=hop_length, hop_ms=round(hop_length/sr*1000,3),
                        n_frames=n, rms_global_max=round(rmax,6), frames=frames)


def load_features(features_dir, stem_name):
    p = Path(features_dir)/f"{stem_name}_features.json"
    if not p.exists(): raise FileNotFoundError(p)
    return StemFeatures.from_json(p.read_text())


def load_all_features(features_dir, stem_names):
    return {s: load_features(features_dir, s) for s in stem_names}
