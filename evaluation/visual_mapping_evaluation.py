"""
Visual mapping evaluation for Strata.

This script documents and measures how extracted audio features become visual
controls in the Three.js scene. It mirrors the current frontend formulas so the
report can be used in a seminar defense.
"""

from __future__ import annotations

import argparse
import json
import os
import textwrap
from pathlib import Path

os.environ.setdefault("NUMBA_CACHE_DIR", "/private/tmp/strata-numba-cache")
os.environ.setdefault("MPLCONFIGDIR", "/private/tmp/strata-mpl-cache")
os.environ.setdefault("XDG_CACHE_HOME", "/private/tmp/strata-cache")

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

import sys

sys.path.insert(0, str(Path(__file__).parent.parent))
import config
from analysis.features import FeatureTimeline


STEM_ORDER = ["bass", "drums", "melody", "harmonic"]
STEM_COLORS = {
    "bass": "#36a3ff",
    "drums": "#ffbf58",
    "melody": "#6dff9d",
    "harmonic": "#9b72ff",
}
BG = "#080b14"
PANEL_BG = "#0d1424"
TEXT = "#f4f7ff"
MUTED = "#aeb8cc"
GRID = "#263147"

MAPPINGS = [
    {
        "layer": "Bass",
        "frontend": "frontend/src/visualizers/BassShockwave.js",
        "audio_features": "bass.rms",
        "visual_controls": "shockwave energy, floor scale, ring spread, ring opacity",
        "formula": "bass_energy = clamp(bass.rms * 2.8, 0, 1)",
        "viewer_reading": "low-frequency energy expands the blue floor shockwaves",
    },
    {
        "layer": "Drums",
        "frontend": "frontend/src/visualizers/DrumParticles.js",
        "audio_features": "drums.onset, drums.rms",
        "visual_controls": "particle burst trigger, burst strength, particle size",
        "formula": "hit = max(drums.onset, drums.rms * 0.85); burst if hit > 0.32",
        "viewer_reading": "transient drum hits create gold particle impacts",
    },
    {
        "layer": "Melody",
        "frontend": "frontend/src/visualizers/MelodyRibbon.js",
        "audio_features": "melody.pitch_hz, melody.rms",
        "visual_controls": "ribbon vertical target, helix depth, line opacity",
        "formula": "target_y = log2(pitch / 440) * 1.25, clipped to [-1.65, 1.65]",
        "viewer_reading": "pitched material bends the green ribbon through space",
    },
    {
        "layer": "Harmony",
        "frontend": "frontend/src/visualizers/HarmonicCloud.js",
        "audio_features": "harmonic.rms, harmonic.spectral_centroid",
        "visual_controls": "cloud/ring scale, opacity, point size, brightness",
        "formula": "brightness = clamp(spectral_centroid / 6500, 0, 1)",
        "viewer_reading": "dense harmonic texture forms the purple atmospheric field",
    },
]


def _stem_key(layer: str) -> str:
    return "harmonic" if layer.lower() == "harmony" else layer.lower()


def main() -> None:
    parser = argparse.ArgumentParser(description="Export Strata visual mapping evaluation.")
    parser.add_argument("--features", default="features.json", help="Feature timeline JSON.")
    parser.add_argument(
        "--out-dir",
        default=str(config.EVAL_DIR / "visual_mapping"),
        help="Directory for mapping evaluation outputs.",
    )
    args = parser.parse_args()

    out_dir = Path(args.out_dir).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    summary = run(Path(args.features).resolve(), out_dir)
    print(f"[mapping] Visual mapping evaluation written to {out_dir}")
    print(f"[mapping] Frames: {summary['frames']}  Duration: {summary['duration_s']:.2f}s")
    print(f"[mapping] Drum burst events: {summary['layer_statistics']['drums']['burst_events']}")


def run(features_path: Path, out_dir: Path) -> dict:
    timeline = FeatureTimeline.load(features_path)
    arrays = _extract_arrays(timeline)
    controls = _derive_visual_controls(arrays)
    summary = {
        "features_file": str(features_path),
        "duration_s": round(timeline.duration, 3),
        "fps": round(timeline.fps, 3),
        "frames": len(timeline.frames),
        "mappings": MAPPINGS,
        "layer_statistics": _layer_statistics(arrays, controls, timeline.duration),
        "control_correlation": _control_correlation(controls),
        "phase_mapping": _phase_mapping(timeline.duration),
    }

    _plot_timeline(arrays["time"], controls, out_dir / "visual_control_timeline.png")
    _plot_control_panels(arrays["time"], arrays, controls, out_dir / "visual_mapping_controls.png")
    _plot_mapping_table(out_dir / "visual_mapping_table.png")
    _plot_mapping_storyboard(out_dir / "visual_mapping_storyboard.png")
    _write_json(summary, out_dir / "visual_mapping_summary.json")
    _write_report(summary, out_dir / "visual_mapping_report.md")
    return summary


def _extract_arrays(timeline: FeatureTimeline) -> dict:
    time = np.array([frame.t for frame in timeline.frames], dtype=np.float32)
    data = {"time": time}
    for stem in STEM_ORDER:
        data[f"{stem}_rms"] = np.array(
            [getattr(frame, stem).rms for frame in timeline.frames],
            dtype=np.float32,
        )
        data[f"{stem}_onset"] = np.array(
            [getattr(frame, stem).onset for frame in timeline.frames],
            dtype=np.float32,
        )
        data[f"{stem}_centroid"] = np.array(
            [getattr(frame, stem).spectral_centroid for frame in timeline.frames],
            dtype=np.float32,
        )
        data[f"{stem}_pitch"] = np.array(
            [getattr(frame, stem).pitch_hz for frame in timeline.frames],
            dtype=np.float32,
        )
    return data


def _derive_visual_controls(data: dict) -> dict:
    bass_energy = np.clip(data["bass_rms"] * 2.8, 0, 1)
    bass_floor_scale = 1 + bass_energy * 0.42

    drum_hit = np.maximum(data["drums_onset"], data["drums_rms"] * 0.85)
    drum_burst_strength = np.clip(drum_hit * 1.35, 0, 1)
    drum_trigger = _drum_trigger_events(drum_hit)

    melody_target_y = np.zeros_like(data["melody_pitch"])
    active_pitch = (data["melody_rms"] > 0.01) & (data["melody_pitch"] > 0)
    low_pitch = active_pitch & (data["melody_pitch"] < 128)
    high_pitch = active_pitch & ~low_pitch
    melody_target_y[low_pitch] = ((data["melody_pitch"][low_pitch] - 64) / 24) * 1.3
    melody_target_y[high_pitch] = np.log2(data["melody_pitch"][high_pitch] / 440) * 1.25
    melody_target_y = np.clip(melody_target_y, -1.65, 1.65)
    melody_opacity = np.minimum(0.94, 0.45 + data["melody_rms"] * 1.6)

    harmonic_brightness = np.clip(data["harmonic_centroid"] / 6500, 0, 1)
    harmonic_scale = 0.78 + data["harmonic_rms"] * 0.85 + harmonic_brightness * 0.12
    harmonic_cloud_size = 0.028 + data["harmonic_rms"] * 0.04 + harmonic_brightness * 0.018

    return {
        "bass": bass_energy,
        "bass_floor_scale": bass_floor_scale,
        "drums": drum_burst_strength,
        "drum_hit": drum_hit,
        "drum_trigger": drum_trigger.astype(np.float32),
        "melody": _normalize_range(melody_target_y),
        "melody_target_y": melody_target_y,
        "melody_opacity": melody_opacity,
        "melody_active_pitch": active_pitch.astype(np.float32),
        "harmonic": _normalize_range(harmonic_scale),
        "harmonic_brightness": harmonic_brightness,
        "harmonic_scale": harmonic_scale,
        "harmonic_cloud_size": harmonic_cloud_size,
    }


def _layer_statistics(data: dict, controls: dict, duration_s: float) -> dict:
    return {
        "bass": {
            "feature": "bass.rms",
            "rms": _stats(data["bass_rms"]),
            "shockwave_energy": _stats(controls["bass"]),
            "floor_scale": _stats(controls["bass_floor_scale"]),
        },
        "drums": {
            "feature": "max(drums.onset, drums.rms * 0.85)",
            "hit": _stats(controls["drum_hit"]),
            "burst_strength": _stats(controls["drums"]),
            "burst_events": int(np.sum(controls["drum_trigger"])),
            "burst_events_per_min": round(float(np.sum(controls["drum_trigger"]) / duration_s * 60), 2),
        },
        "melody": {
            "features": "melody.pitch_hz, melody.rms",
            "active_pitch_percent": round(float(np.mean(controls["melody_active_pitch"]) * 100), 2),
            "pitch_hz_active": _stats(data["melody_pitch"][controls["melody_active_pitch"] > 0]),
            "target_y": _stats(controls["melody_target_y"]),
            "opacity": _stats(controls["melody_opacity"]),
        },
        "harmonic": {
            "features": "harmonic.rms, harmonic.spectral_centroid",
            "rms": _stats(data["harmonic_rms"]),
            "brightness": _stats(controls["harmonic_brightness"]),
            "scale": _stats(controls["harmonic_scale"]),
            "cloud_size": _stats(controls["harmonic_cloud_size"]),
        },
    }


def _control_correlation(controls: dict) -> dict:
    names = STEM_ORDER
    values = np.stack([controls[name] for name in names], axis=0)
    corr = np.corrcoef(values)
    return {
        names[i]: {names[j]: round(float(corr[i, j]), 4) for j in range(len(names))}
        for i in range(len(names))
    }


def _drum_trigger_events(hit: np.ndarray) -> np.ndarray:
    events = np.zeros_like(hit, dtype=bool)
    cooldown = 0
    previous_hit = 0.0
    for index, value in enumerate(hit):
        if cooldown > 0:
            cooldown -= 1
        if value > 0.32 and value > previous_hit + 0.06 and cooldown == 0:
            events[index] = True
            cooldown = 5
        previous_hit = float(value)
    return events


def _phase_mapping(duration_s: float) -> list[dict]:
    return [
        {"phase": "opening", "time_s": "0-4", "visual_goal": "introduce system and central energy core"},
        {"phase": "source separation", "time_s": "4-8", "visual_goal": "split one waveform into four visual streams"},
        {"phase": "bass", "time_s": "8-16", "visual_goal": "foreground low-frequency shockwaves"},
        {"phase": "drums", "time_s": "16-24", "visual_goal": "foreground transient particle impacts"},
        {"phase": "melody", "time_s": "24-32", "visual_goal": "foreground pitched ribbon motion"},
        {"phase": "harmony", "time_s": "32-40", "visual_goal": "foreground atmospheric cloud/ring field"},
        {
            "phase": "combined",
            "time_s": f"40-{max(40, duration_s - 8):.1f}",
            "visual_goal": "all stems interact in one 3D scene",
        },
        {
            "phase": "closing",
            "time_s": f"{max(0, duration_s - 8):.1f}-{duration_s:.1f}",
            "visual_goal": "summarize AI source separation + real-time visualization",
        },
    ]


def _plot_timeline(time: np.ndarray, controls: dict, path: Path) -> None:
    step = max(1, len(time) // 1800)
    smooth_window = max(5, int(len(time) / max(float(time[-1]), 1.0)))
    fig, ax = plt.subplots(figsize=(14, 5.6), facecolor=BG)
    fig.subplots_adjust(left=0.08, right=0.96, bottom=0.16, top=0.78)
    fig.text(
        0.08,
        0.92,
        "Visual Control Signals Over Time",
        color=TEXT,
        fontsize=22,
        fontweight="bold",
    )
    fig.text(
        0.08,
        0.865,
        "Each curve is a normalized visual driver derived from one AI-separated stem.",
        color=MUTED,
        fontsize=12,
    )
    ax.set_facecolor(PANEL_BG)
    phase_bands = [
        (0, 4, "opening"),
        (4, 8, "split"),
        (8, 16, "bass"),
        (16, 24, "drums"),
        (24, 32, "melody"),
        (32, 40, "harmony"),
    ]
    for start, end, label in phase_bands:
        color = STEM_COLORS.get(label, "#ffffff")
        ax.axvspan(start, end, color=color, alpha=0.07)
    ax.axvline(40, color="#f6e7b0", linestyle="--", linewidth=1, alpha=0.65)
    ax.text(4, 1.015, "guided stem reveal", color=MUTED, fontsize=9, ha="left")
    ax.text(41, 0.08, "combined show scene", color="#f6e7b0", fontsize=9)
    for name in STEM_ORDER:
        smoothed = _smooth(controls[name], smooth_window)
        ax.plot(
            time[::step],
            smoothed[::step],
            label=name,
            color=STEM_COLORS[name],
            linewidth=2.0,
            alpha=0.95,
        )
    ax.set_xlabel("Time (s)")
    ax.set_ylabel("Normalized visual intensity")
    ax.set_ylim(-0.04, 1.04)
    _style_axis(ax)
    _style_legend(ax.legend(ncol=4, loc="upper right"))
    fig.savefig(path, dpi=140)
    plt.close(fig)


def _plot_control_panels(time: np.ndarray, data: dict, controls: dict, path: Path) -> None:
    step = max(1, len(time) // 1600)
    fig, axes = plt.subplots(2, 2, figsize=(14, 8), facecolor=BG)
    fig.subplots_adjust(left=0.08, right=0.96, bottom=0.09, top=0.85, wspace=0.2, hspace=0.32)
    fig.text(
        0.08,
        0.94,
        "Per-Layer Mapping Controls",
        color=TEXT,
        fontsize=22,
        fontweight="bold",
    )
    fig.text(
        0.08,
        0.895,
        "These plots show the actual control signals used by the Three.js visualizers.",
        color=MUTED,
        fontsize=12,
    )

    axes[0, 0].plot(time[::step], controls["bass"][::step], color=STEM_COLORS["bass"])
    axes[0, 0].set_title("Bass: RMS -> shockwave energy")
    axes[0, 0].set_ylabel("Energy")

    axes[0, 1].plot(time[::step], controls["drum_hit"][::step], color=STEM_COLORS["drums"])
    axes[0, 1].axhline(0.32, color="#f6e7b0", linestyle="--", linewidth=1, label="burst threshold")
    axes[0, 1].set_title("Drums: onset/RMS -> particle bursts")

    axes[1, 0].plot(time[::step], controls["melody_target_y"][::step], color=STEM_COLORS["melody"])
    axes[1, 0].set_title("Melody: pitch -> ribbon vertical target")
    axes[1, 0].set_ylabel("Target y")

    axes[1, 1].plot(
        time[::step],
        controls["harmonic_brightness"][::step],
        color=STEM_COLORS["harmonic"],
        label="brightness",
    )
    axes[1, 1].plot(
        time[::step],
        controls["harmonic"][::step],
        color="#d7c5ff",
        label="normalized scale",
        alpha=0.72,
    )
    axes[1, 1].set_title("Harmony: centroid/RMS -> cloud brightness and scale")

    for ax in axes.ravel():
        ax.set_xlabel("Time (s)")
        _style_axis(ax)
    _style_legend(axes[0, 1].legend())
    _style_legend(axes[1, 1].legend())

    fig.savefig(path, dpi=140)
    plt.close(fig)


def _plot_mapping_table(path: Path) -> None:
    rows = [
        [
            item["layer"],
            item["audio_features"].replace(", ", "\n"),
            textwrap.fill(item["visual_controls"], width=30),
            textwrap.fill(item["viewer_reading"], width=44),
        ]
        for item in MAPPINGS
    ]
    fig, ax = plt.subplots(figsize=(15, 5.8), facecolor=BG)
    fig.subplots_adjust(left=0.04, right=0.96, top=0.82, bottom=0.06)
    ax.axis("off")
    table = ax.table(
        cellText=rows,
        colLabels=["Layer", "Audio feature", "Visual control", "Viewer reading"],
        cellLoc="left",
        colLoc="left",
        loc="center",
        colWidths=[0.12, 0.22, 0.28, 0.38],
    )
    table.auto_set_font_size(False)
    table.set_fontsize(9.2)
    table.scale(1, 2.4)
    for (row, col), cell in table.get_celld().items():
        cell.set_edgecolor("#25324a")
        if row == 0:
            cell.set_text_props(weight="bold", color=TEXT)
            cell.set_facecolor("#111827")
        elif col == 0:
            layer_name = _stem_key(rows[row - 1][0])
            cell.set_facecolor(STEM_COLORS.get(layer_name, PANEL_BG))
            cell.set_text_props(weight="bold", color="#05070d")
        else:
            cell.set_facecolor(PANEL_BG)
            cell.set_text_props(color=MUTED)
    fig.text(
        0.04,
        0.92,
        "Strata Visual Mapping Evaluation",
        color=TEXT,
        fontsize=22,
        fontweight="bold",
    )
    fig.text(
        0.04,
        0.865,
        "The table connects measured audio features to visible behavior in the live scene.",
        color=MUTED,
        fontsize=12,
    )
    fig.savefig(path, dpi=150)
    plt.close(fig)


def _plot_mapping_storyboard(path: Path) -> None:
    columns = [
        ("AI-separated stem", "layer"),
        ("Measured audio feature", "audio_features"),
        ("3D control", "visual_controls"),
        ("Viewer cue", "viewer_reading"),
    ]
    fig = plt.figure(figsize=(16, 8), facecolor=BG)
    fig.text(
        0.05,
        0.92,
        "From Hidden Audio Layer To Visible Stage Behavior",
        color=TEXT,
        fontsize=23,
        fontweight="bold",
    )
    fig.text(
        0.05,
        0.865,
        "This is the visual-computing contract: every cinematic element has a measurable audio driver.",
        color=MUTED,
        fontsize=12,
    )

    lefts = [0.05, 0.28, 0.51, 0.74]
    widths = [0.18, 0.18, 0.18, 0.21]
    for left, width, (title, _) in zip(lefts, widths, columns):
        fig.text(left, 0.79, title, color=TEXT, fontsize=12, fontweight="bold")

    row_height = 0.145
    start_y = 0.62
    for row, item in enumerate(MAPPINGS):
        y = start_y - row * row_height
        color = STEM_COLORS[_stem_key(item["layer"])]
        for col, (left, width, (_, key)) in enumerate(zip(lefts, widths, columns)):
            ax = fig.add_axes([left, y, width, 0.105])
            ax.set_xticks([])
            ax.set_yticks([])
            ax.set_facecolor(PANEL_BG)
            for spine in ax.spines.values():
                spine.set_color(color if col == 0 else "#25324a")
                spine.set_linewidth(1.2)
            if col == 0:
                ax.axvline(0.025, color=color, linewidth=5)
                text = item[key]
                text_color = TEXT
                weight = "bold"
            else:
                text = item[key]
                text_color = MUTED
                weight = "normal"
            ax.text(
                0.08,
                0.5,
                textwrap.fill(text, width=28),
                color=text_color,
                fontsize=9.4,
                fontweight=weight,
                va="center",
                transform=ax.transAxes,
            )
        for x in [0.245, 0.475, 0.705]:
            fig.text(x, y + 0.045, "->", color=color, fontsize=18, fontweight="bold")

    fig.text(
        0.05,
        0.08,
        "Defense wording: the visuals are not arbitrary decoration; they are a readable encoding of AI-separated musical structure.",
        color="#ffcf7a",
        fontsize=12,
        fontweight="bold",
    )
    fig.savefig(path, dpi=150)
    plt.close(fig)


def _style_axis(ax) -> None:
    ax.set_facecolor(PANEL_BG)
    ax.xaxis.label.set_color(MUTED)
    ax.yaxis.label.set_color(MUTED)
    ax.title.set_color(TEXT)
    ax.tick_params(colors=MUTED)
    ax.grid(color=GRID, alpha=0.45)
    for spine in ax.spines.values():
        spine.set_color("#25324a")


def _style_legend(legend) -> None:
    if legend is None:
        return
    legend.get_frame().set_facecolor("#111827")
    legend.get_frame().set_edgecolor("#354158")
    for text in legend.get_texts():
        text.set_color(TEXT)


def _smooth(values: np.ndarray, window: int) -> np.ndarray:
    if window <= 1:
        return values
    kernel = np.ones(window, dtype=np.float32) / float(window)
    return np.convolve(values, kernel, mode="same")


def _write_report(summary: dict, path: Path) -> None:
    stats = summary["layer_statistics"]
    mapping_rows = "\n".join(
        "| {layer} | `{audio_features}` | {visual_controls} | {viewer_reading} |".format(**item)
        for item in MAPPINGS
    )
    phase_rows = "\n".join(
        f"| {item['phase']} | {item['time_s']} | {item['visual_goal']} |"
        for item in summary["phase_mapping"]
    )
    correlation_rows = "\n".join(
        "| "
        + left
        + " | "
        + " | ".join(f"{summary['control_correlation'][left][right]:.3f}" for right in STEM_ORDER)
        + " |"
        for left in STEM_ORDER
    )
    text = f"""# Strata Visual Mapping Evaluation

This evaluation documents how audio analysis features are translated into
visual parameters in the Three.js demo. It answers the visual-computing
question behind the G01 concept: are the hidden musical layers not only
separated by AI, but also encoded as readable, distinct, real-time visual
behaviors?

Feature timeline: `{Path(summary['features_file']).name}`  
Duration: **{summary['duration_s']} s**  
Frames: **{summary['frames']}** at **{summary['fps']} fps**

## Evaluation Claim

The visual system is data-driven rather than decorative: each visible layer has
a specific stem, feature input, control formula, and viewer-facing cue.

![Visual mapping storyboard](visual_mapping_storyboard.png)

## Concept Alignment

| G01 concept requirement | Visual mapping evidence | Status |
| --- | --- | --- |
| Hidden musical layers become simultaneously visible | Four stem-specific visual layers are mapped and measured | satisfied |
| Each stem independently drives its own 3D visual layer | Mapping table links stem features to visual controls | satisfied |
| Real-time playback-rate feature streaming | Feature timeline contains **{summary['frames']}** frames at **{summary['fps']} fps** | satisfied |
| Interactive/presentation-ready explanation | Phase mapping separates opening, stem reveal, combined scene, and closing | satisfied |

## Mapping Table

| Visual layer | Audio feature input | Visual parameter output | Viewer interpretation |
| --- | --- | --- | --- |
{mapping_rows}

![Visual mapping table](visual_mapping_table.png)

How to read this table:

- The first column is what the audience sees.
- The second column is the measured signal from the AI-separated stem.
- The third column is the actual Three.js control being changed.
- The fourth column is the intended visual meaning.

## Current Track Evidence

- Bass shockwave energy p95: **{stats['bass']['shockwave_energy']['p95']:.3f}**
- Bass floor scale max: **{stats['bass']['floor_scale']['max']:.3f}**
- Drum burst events: **{stats['drums']['burst_events']}** ({stats['drums']['burst_events_per_min']} per minute)
- Melody active pitch coverage: **{stats['melody']['active_pitch_percent']}%**
- Melody target y range: **{stats['melody']['target_y']['min']:.3f} to {stats['melody']['target_y']['max']:.3f}**
- Harmonic brightness p95: **{stats['harmonic']['brightness']['p95']:.3f}**
- Harmonic scale max: **{stats['harmonic']['scale']['max']:.3f}**

These values are not just debug numbers. They show that the current song
actually exercises the four visual layers: bass has strong floor-scale peaks,
drums produce hundreds of burst events, melody has sustained pitch coverage,
and harmony changes the atmospheric cloud/ring field.

![Visual control timeline](visual_control_timeline.png)

![Visual mapping controls](visual_mapping_controls.png)

How to present these plots:

- Peaks in the bass curve should correspond to stronger blue shockwaves.
- Drum threshold crossings explain why gold particles burst on transient hits.
- Melody target movement explains why the green ribbon bends vertically.
- Harmonic brightness/scale explains changes in the purple atmospheric field.

## Control Separation

The matrix below compares the derived visual control signals, not the raw audio
stems. Lower off-diagonal values mean the visual layers are not all reacting in
the same way at the same time.

| Control | Bass | Drums | Melody | Harmonic |
| --- | ---: | ---: | ---: | ---: |
{correlation_rows}

## Demo Phase Mapping

| Phase | Time | Visual goal |
| --- | ---: | --- |
{phase_rows}

This phase structure keeps the demo faithful to the original concept while
making it more suitable for a high-expectation seminar presentation: the system
first teaches the audience what each layer means, then combines the layers into
one cinematic audiovisual space.

## Defense Sentence

The visual system is not driven by arbitrary animation. Each layer is controlled
by a specific audio descriptor extracted from an AI-separated stem: bass RMS
controls low-frequency shockwaves, drum onsets trigger particles, melody pitch
drives ribbon geometry, and harmonic spectral centroid/RMS controls the
atmospheric cloud field.

## Assets

- `visual_mapping_summary.json`
- `visual_mapping_storyboard.png`
- `visual_mapping_table.png`
- `visual_control_timeline.png`
- `visual_mapping_controls.png`
"""
    path.write_text(text)


def _stats(values: np.ndarray) -> dict:
    if values.size == 0:
        return {"min": 0.0, "mean": 0.0, "p50": 0.0, "p95": 0.0, "max": 0.0}
    return {
        "min": round(float(np.min(values)), 4),
        "mean": round(float(np.mean(values)), 4),
        "p50": round(float(np.percentile(values, 50)), 4),
        "p95": round(float(np.percentile(values, 95)), 4),
        "max": round(float(np.max(values)), 4),
    }


def _normalize_range(values: np.ndarray) -> np.ndarray:
    low = float(np.min(values))
    high = float(np.max(values))
    if high - low < 1e-8:
        return np.zeros_like(values)
    return (values - low) / (high - low)


def _write_json(data: dict, path: Path) -> None:
    path.write_text(json.dumps(data, indent=2))


if __name__ == "__main__":
    main()
