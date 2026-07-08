"""
analysis/feature_extractor.py — librosa feature pipeline (lazy import).
"""
from __future__ import annotations
import json, logging, time
import os
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Callable
import numpy as np

log = logging.getLogger(__name__)

PROJECT_ROOT = Path(__file__).resolve().parent.parent
CACHE_ROOT = PROJECT_ROOT / ".cache"
os.environ.setdefault("NUMBA_CACHE_DIR", str(CACHE_ROOT / "numba"))
os.environ.setdefault("LIBROSA_CACHE_DIR", str(CACHE_ROOT / "librosa"))
CACHE_ROOT.mkdir(parents=True, exist_ok=True)


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

def extract(audio_path, stem_paths):
    """
    pipeline.py ve features.py arasındaki bağlantıyı kuran köprü fonksiyon.
    Verileri 60 FPS'ye indirger ve Three.js formatına çevirir.
    """
    import sys
    from pathlib import Path
    sys.path.insert(0, str(Path(__file__).parent.parent))
    import config
    from analysis.features import FeatureTimeline, FrameFeatures
    from analysis.features import StemFeatures as OutStemFeatures
    
    log.info("Özellikler çıkarılıyor ve birleştiriliyor...")
    
    feature_cache_key = Path(next(iter(stem_paths.values()))).parent.name
    feature_cache_dir = config.PROJECT_ROOT / "features" / "_stem_cache" / feature_cache_key

    raw_data = extract_all(
        stem_paths, 
        features_dir=feature_cache_dir,
        sample_rate=config.TARGET_SR, 
        hop_length=config.HOP_LENGTH
    )
    
    melody_raw = raw_data["melody"]
    n_frames = melody_raw.n_frames
    
    raw_fps = config.TARGET_SR / config.HOP_LENGTH
    step = max(1, int(round(raw_fps / config.TARGET_FPS)))
    
    out_frames = []
    
    for i in range(0, n_frames, step):
        def map_stem(stem_name):
            if stem_name not in raw_data or i >= len(raw_data[stem_name].frames):
                return OutStemFeatures()
            f = raw_data[stem_name].frames[i]
            return OutStemFeatures(
                rms=f.rms,
                onset=f.onset,
                spectral_centroid=f.centroid * 22050, # Gerçek frekans değerine çevir
                chroma=f.chroma,
                pitch_hz=float(f.pitch), 
                beat_phase=1.0 if f.beat else 0.0
            )
        
        frame = FrameFeatures(
            t=melody_raw.frames[i].t,
            frame_idx=i,
            melody=map_stem("melody"),
            bass=map_stem("bass"),
            drums=map_stem("drums"),
            harmonic=map_stem("harmonic")
        )
        out_frames.append(frame)

    timeline = FeatureTimeline(
        audio_path=str(audio_path),
        duration=melody_raw.duration,
        sr=config.TARGET_SR,
        hop_length=config.HOP_LENGTH * step,
        fps=raw_fps / step,
        stems=config.STEM_NAMES,
        frames=out_frames
    )
    return timeline
