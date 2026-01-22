#!/usr/bin/env python3
"""Split alphabet-is-spelled audio into standalone clips using ffmpeg."""

import argparse
import pathlib
import re
import subprocess
from typing import Iterable, List, Sequence, Tuple

SILENCE_RE = re.compile(r"silence_(start|end):\s+([0-9.]+)")


def run(cmd: Sequence[str]) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, check=True, capture_output=True, text=True)


def detect_silences(audio: pathlib.Path, noise: str, min_silence: float) -> List[Tuple[float, float]]:
    cmd = [
        "ffmpeg",
        "-i",
        str(audio),
        "-af",
        f"silencedetect=noise={noise}:d={min_silence}",
        "-f",
        "null",
        "-",
    ]
    proc = run(cmd)
    silences: List[Tuple[float, float]] = []
    last_start: float | None = None
    for match in SILENCE_RE.finditer(proc.stderr):
        kind, value = match.groups()
        timestamp = float(value)
        if kind == "start":
            last_start = timestamp
        elif last_start is not None:
            silences.append((last_start, timestamp))
            last_start = None
    return silences


def get_duration(audio: pathlib.Path) -> float:
    cmd = [
        "ffprobe",
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        str(audio),
    ]
    proc = run(cmd)
    return float(proc.stdout.strip())


def build_segments(
    silences: Iterable[Tuple[float, float]],
    duration: float,
    min_clip: float,
    min_gap: float,
    pad_before: float,
    pad_after: float,
) -> List[Tuple[float, float]]:
    qualifying_silences = [s for s in silences if (s[1] - s[0]) >= min_gap]
    cursor = 0.0
    clips: List[Tuple[float, float]] = []
    if qualifying_silences and qualifying_silences[0][0] <= 1e-3:
        cursor = qualifying_silences[0][1]
        qualifying_silences = qualifying_silences[1:]
    for silence_start, silence_end in qualifying_silences:
        start = cursor
        end = silence_start
        if end - start >= min_clip:
            clips.append((start, end))
        cursor = silence_end
    if duration - cursor >= min_clip:
        clips.append((cursor, duration))

    padded: List[Tuple[float, float]] = []
    for start, end in clips:
        padded_start = max(0.0, start - pad_before)
        padded_end = min(duration, end + pad_after)
        padded.append((padded_start, padded_end))
    return padded


def slugify(text: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return slug or "clip"


def load_labels(label_file: pathlib.Path | None) -> List[str]:
    if not label_file or not label_file.exists():
        return []
    labels: List[str] = []
    for line in label_file.read_text().splitlines():
        cleaned = line.strip().strip(".")
        if cleaned:
            labels.append(cleaned)
    return labels


def split_audio(
    audio: pathlib.Path,
    output_dir: pathlib.Path,
    labels: Sequence[str],
    segments: Sequence[Tuple[float, float]],
):
    output_dir.mkdir(parents=True, exist_ok=True)
    manifest_lines: List[str] = []
    for idx, (start, end) in enumerate(segments):
        label_text = labels[idx] if idx < len(labels) else f"Clip {idx + 1}"
        slug = slugify(label_text)
        output_file = output_dir / f"alphabet-is-spelled_{idx+1:02d}-{slug}.mp3"
        duration = max(0.01, end - start)
        cmd = [
            "ffmpeg",
            "-y",
            "-ss",
            f"{start:.3f}",
            "-i",
            str(audio),
            "-t",
            f"{duration:.3f}",
            "-ar",
            "44100",
            "-ac",
            "1",
            "-c:a",
            "libmp3lame",
            "-b:a",
            "160k",
            str(output_file),
        ]
        print(f"Creating {output_file.name} ({start:.3f}s -> {end:.3f}s)...")
        subprocess.run(cmd, check=True)
        manifest_lines.append(f"{output_file.name} | {start:.3f}s -> {end:.3f}s | {label_text}")
    manifest_path = output_dir / "manifest.txt"
    manifest_path.write_text("\n".join(manifest_lines) + "\n")
    print(f"Wrote manifest to {manifest_path}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--audio",
        default="static/audio/alphabet-is-spelled.mp3",
        type=pathlib.Path,
        help="Source audio file to split.",
    )
    parser.add_argument(
        "--labels",
        default="static/audio/alphabet-is-spelled-tts.txt",
        type=pathlib.Path,
        help="Text file whose non-empty lines are used as labels.",
    )
    parser.add_argument(
        "--output-dir",
        default="static/audio/alphabet-is-spelled-clips",
        type=pathlib.Path,
        help="Where to store the generated clips.",
    )
    parser.add_argument(
        "--noise",
        default="-35dB",
        help="Noise threshold passed to silencedetect.",
    )
    parser.add_argument(
        "--min-silence",
        default=0.05,
        type=float,
        help="Minimum silence duration fed to silencedetect (seconds).",
    )
    parser.add_argument(
        "--min-clip",
        default=0.1,
        type=float,
        help="Ignore segments shorter than this many seconds.",
    )
    parser.add_argument(
        "--min-gap",
        default=0.05,
        type=float,
        help="Require silences to be at least this long to count as separators.",
    )
    parser.add_argument(
        "--pad-before",
        default=0.08,
        type=float,
        help="Add this much audio before each detected segment (seconds).",
    )
    parser.add_argument(
        "--pad-after",
        default=0.15,
        type=float,
        help="Add this much audio after each detected segment (seconds).",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    audio = args.audio
    silences = detect_silences(audio, args.noise, args.min_silence)
    duration = get_duration(audio)
    segments = build_segments(
        silences,
        duration,
        args.min_clip,
        args.min_gap,
        args.pad_before,
        args.pad_after,
    )
    labels = load_labels(args.labels)
    if labels and len(labels) != len(segments):
        print(
            f"Warning: {len(labels)} labels for {len(segments)} segments; extra names will be auto-generated."
        )
    split_audio(audio, args.output_dir, labels, segments)
    print(f"Generated {len(segments)} clips in {args.output_dir}")


if __name__ == "__main__":
    main()
