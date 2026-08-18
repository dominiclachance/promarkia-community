"""Deterministic, safe-zone-aware captions for Higgsfield Explainer videos.

Higgsfield MCP currently accepts only a caption font name.  It does not expose
font size, wrapping, phrase length, or safe-zone controls.  This module burns
captions after caption-free assembly so Promarkia can prove every phrase fits
before accepting the finished MP4.
"""

from __future__ import annotations

import json
import math
import os
import re
import subprocess
import tempfile
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Sequence

from PIL import Image, ImageDraw, ImageFont


@dataclass(frozen=True)
class CaptionCue:
    start: float
    end: float
    text: str
    lines: tuple[str, ...]
    font_size: int
    measured_width: int
    measured_height: int


def _run(command: list[str], *, timeout: int = 300) -> subprocess.CompletedProcess[str]:
    completed = subprocess.run(
        command,
        capture_output=True,
        text=True,
        timeout=timeout,
        check=False,
    )
    if completed.returncode:
        message = completed.stderr.strip().splitlines()
        raise RuntimeError(message[-1] if message else "Media command failed")
    return completed


def probe_media(path_or_url: str) -> dict[str, Any]:
    raw = _run(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration:stream=codec_type,width,height",
            "-of",
            "json",
            path_or_url,
        ],
        timeout=90,
    ).stdout
    payload = json.loads(raw)
    video = next(
        (
            stream
            for stream in payload.get("streams") or []
            if stream.get("codec_type") == "video"
        ),
        None,
    )
    if not video:
        raise RuntimeError("Caption source contains no video stream")
    return {
        "duration": float((payload.get("format") or {}).get("duration") or 0),
        "width": int(video.get("width") or 0),
        "height": int(video.get("height") or 0),
    }


def probe_duration(path_or_url: str) -> float:
    raw = _run(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            path_or_url,
        ],
        timeout=90,
    ).stdout.strip()
    return float(raw)


def _font_candidates(font_key: str) -> list[Path]:
    configured = os.getenv("PROMARKIA_CAPTION_FONT_FILE")
    candidates = [Path(configured)] if configured else []
    bundled = Path(__file__).resolve().parent / "assets" / "fonts"
    if font_key == "anton":
        candidates.append(bundled / "Anton-Regular.ttf")
    if os.name == "nt":
        windows = Path(os.getenv("WINDIR", r"C:\Windows")) / "Fonts"
        names = {
            "anton": ["ARIALNB.TTF", "impact.ttf", "arialbd.ttf"],
            "marker": ["ARIALNB.TTF", "arialbd.ttf"],
            "patrick": ["segoeprb.ttf", "arialbd.ttf"],
            "caveat": ["segoepr.ttf", "arial.ttf"],
        }
        candidates.extend(windows / name for name in names.get(font_key, names["anton"]))
    else:
        candidates.extend(
            [
                Path("/usr/share/fonts/truetype/dejavu/DejaVuSansCondensed-Bold.ttf"),
                Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"),
                Path("/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf"),
            ]
        )
    return candidates


def resolve_font(font_key: str = "anton") -> tuple[Path, str]:
    for candidate in _font_candidates(font_key):
        if candidate and candidate.is_file():
            family = (
                "Anton"
                if candidate.name == "Anton-Regular.ttf"
                else
                "Arial Narrow"
                if candidate.name.upper().startswith("ARIALN")
                else "DejaVu Sans Condensed"
                if "Condensed" in candidate.name
                else candidate.stem
            )
            return candidate, family
    raise RuntimeError(
        "No supported caption font was found. Set PROMARKIA_CAPTION_FONT_FILE."
    )


def split_caption_phrases(
    text: str,
    *,
    max_words: int = 4,
    max_characters: int = 24,
) -> list[str]:
    """Split narration into short speech-like phrases before fitting."""

    words = re.findall(r"\S+", " ".join(str(text).split()))
    if not words:
        return []
    phrases: list[str] = []
    current: list[str] = []
    for word in words:
        candidate = " ".join([*current, word])
        boundary = bool(re.search(r"[,;:!?]$", word))
        if current and (
            len(current) >= max_words
            or len(candidate) > max_characters
            or (boundary and len(current) >= 2)
        ):
            phrases.append(" ".join(current))
            current = [word]
        else:
            current.append(word)
        if boundary and len(current) >= 3:
            phrases.append(" ".join(current))
            current = []
    if current:
        phrases.append(" ".join(current))
    return phrases


def _wrap_text(
    draw: ImageDraw.ImageDraw,
    text: str,
    font: ImageFont.FreeTypeFont,
    max_width: int,
) -> tuple[str, ...]:
    words = text.split()
    lines: list[str] = []
    current: list[str] = []
    for word in words:
        candidate = " ".join([*current, word])
        width = draw.textbbox((0, 0), candidate, font=font)[2]
        if current and width > max_width:
            lines.append(" ".join(current))
            current = [word]
        else:
            current.append(word)
    if current:
        lines.append(" ".join(current))
    return tuple(lines)


def fit_caption(
    text: str,
    *,
    font_path: Path,
    max_width: int,
    max_height: int,
    max_lines: int = 2,
    minimum_font_size: int = 24,
    maximum_font_size: int = 54,
) -> tuple[tuple[str, ...], int, int, int]:
    """Return the largest measured layout that fits the caption box."""

    canvas = Image.new("L", (max_width, max_height), 0)
    draw = ImageDraw.Draw(canvas)
    for size in range(maximum_font_size, minimum_font_size - 1, -1):
        font = ImageFont.truetype(str(font_path), size)
        lines = _wrap_text(draw, text, font, max_width)
        if len(lines) > max_lines:
            continue
        joined = "\n".join(lines)
        box = draw.multiline_textbbox(
            (0, 0), joined, font=font, spacing=max(3, size // 8), align="center"
        )
        width = int(math.ceil(box[2] - box[0]))
        height = int(math.ceil(box[3] - box[1]))
        if width <= max_width and height <= max_height:
            return lines, size, width, height
    raise ValueError(
        f"Caption cannot fit safely at {minimum_font_size}px: {text!r}"
    )


def build_caption_cues(
    blocks: Sequence[dict[str, Any]],
    *,
    width: int,
    height: int,
    audio_durations: Sequence[float] | None = None,
    font_key: str = "anton",
    block_seconds: float = 10.0,
    safe_width_ratio: float = 0.68,
    safe_height_ratio: float = 0.09,
    max_lines: int = 1,
) -> tuple[list[CaptionCue], dict[str, Any]]:
    font_path, font_family = resolve_font(font_key)
    max_width = int(width * safe_width_ratio)
    max_height = int(height * safe_height_ratio)
    maximum_font_size = max(30, int(width * 0.075))
    minimum_font_size = max(20, int(width * 0.033))
    durations = list(audio_durations or [])
    cues: list[CaptionCue] = []

    for block_offset, block in enumerate(blocks):
        narration = str(block.get("narration") or "").strip()
        phrases = split_caption_phrases(narration)
        if not phrases:
            continue
        audio_duration = (
            float(durations[block_offset])
            if block_offset < len(durations)
            else block_seconds * 0.88
        )
        speech_duration = min(block_seconds, max(0.5, audio_duration))
        speech_start = block_offset * block_seconds + max(
            0.0, (block_seconds - speech_duration) / 2
        )
        weights = [max(1, len(re.sub(r"\W", "", phrase))) for phrase in phrases]
        total_weight = float(sum(weights))
        cursor = speech_start
        speech_end = speech_start + speech_duration

        for phrase_index, (phrase, weight) in enumerate(zip(phrases, weights)):
            remaining = speech_end - cursor
            if phrase_index == len(phrases) - 1:
                cue_end = speech_end
            else:
                cue_end = cursor + max(0.45, speech_duration * weight / total_weight)
                cue_end = min(cue_end, speech_end - 0.05)
            lines, size, measured_width, measured_height = fit_caption(
                phrase,
                font_path=font_path,
                max_width=max_width,
                max_height=max_height,
                max_lines=max_lines,
                minimum_font_size=minimum_font_size,
                maximum_font_size=maximum_font_size,
            )
            cues.append(
                CaptionCue(
                    start=round(cursor, 3),
                    end=round(max(cursor + 0.25, cue_end), 3),
                    text=phrase,
                    lines=lines,
                    font_size=size,
                    measured_width=measured_width,
                    measured_height=measured_height,
                )
            )
            cursor = cue_end

    return cues, {
        "font_file": str(font_path),
        "font_family": font_family,
        "safe_box": {
            "width": max_width,
            "height": max_height,
            "width_ratio": safe_width_ratio,
            "height_ratio": safe_height_ratio,
            "max_lines": max_lines,
        },
        "all_cues_fit": all(
            cue.measured_width <= max_width
            and cue.measured_height <= max_height
            and len(cue.lines) <= max_lines
            for cue in cues
        ),
    }


def _ass_time(seconds: float) -> str:
    centiseconds = max(0, int(round(seconds * 100)))
    hours, remainder = divmod(centiseconds, 360000)
    minutes, remainder = divmod(remainder, 6000)
    secs, cents = divmod(remainder, 100)
    return f"{hours}:{minutes:02d}:{secs:02d}.{cents:02d}"


def _ass_escape(text: str) -> str:
    return (
        text.replace("\\", r"\\")
        .replace("{", r"\{")
        .replace("}", r"\}")
        .replace("\n", r"\N")
    )


def write_ass(
    path: Path,
    cues: Sequence[CaptionCue],
    *,
    width: int,
    height: int,
    font_family: str,
) -> None:
    anchor_y = int(height * 0.78)
    events = []
    for cue in cues:
        text = r"\N".join(_ass_escape(line) for line in cue.lines)
        override = (
            rf"{{\an2\pos({width // 2},{anchor_y})\fs{cue.font_size}\q2}}"
        )
        events.append(
            "Dialogue: 0,"
            f"{_ass_time(cue.start)},{_ass_time(cue.end)},Caption,,0,0,0,,"
            f"{override}{text}"
        )
    body = "\n".join(events)
    path.write_text(
        f"""[Script Info]
ScriptType: v4.00+
PlayResX: {width}
PlayResY: {height}
ScaledBorderAndShadow: yes
WrapStyle: 2

[V4+ Styles]
Format: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding
Style: Caption,{font_family},42,&H00131313,&H00131313,&H00E3EEF2,&H00E3EEF2,-1,0,0,0,100,100,0,0,3,10,3,2,0,0,0,1

[Events]
Format: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text
{body}
""",
        encoding="utf-8-sig",
    )


def _ffmpeg_subtitle_path(path: Path) -> str:
    value = str(path.resolve()).replace("\\", "/")
    value = value.replace(":", r"\:").replace("'", r"\'")
    return value


def render_adaptive_captions(
    source_video: str,
    output_video: str,
    blocks: Sequence[dict[str, Any]],
    *,
    audio_durations: Sequence[float] | None = None,
    font_key: str = "anton",
) -> dict[str, Any]:
    media = probe_media(source_video)
    if media["width"] <= 0 or media["height"] <= 0:
        raise RuntimeError("Could not determine caption source dimensions")
    cues, layout = build_caption_cues(
        blocks,
        width=media["width"],
        height=media["height"],
        audio_durations=audio_durations,
        font_key=font_key,
    )
    if not cues or not layout["all_cues_fit"]:
        raise RuntimeError("Adaptive caption layout validation failed")

    destination = Path(output_video)
    destination.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="promarkia-captions-") as temporary:
        ass_path = Path(temporary) / "captions.ass"
        write_ass(
            ass_path,
            cues,
            width=media["width"],
            height=media["height"],
            font_family=layout["font_family"],
        )
        _run(
            [
                "ffmpeg",
                "-y",
                "-i",
                source_video,
                "-vf",
                (
                    f"subtitles=filename='{_ffmpeg_subtitle_path(ass_path)}':"
                    f"fontsdir='{_ffmpeg_subtitle_path(Path(layout['font_file']).parent)}'"
                ),
                "-map",
                "0:v:0",
                "-map",
                "0:a?",
                "-c:v",
                "libx264",
                "-preset",
                "medium",
                "-crf",
                "19",
                "-pix_fmt",
                "yuv420p",
                "-c:a",
                "copy",
                "-movflags",
                "+faststart",
                str(destination),
            ],
            timeout=900,
        )

    output_media = probe_media(str(destination))
    return {
        "ok": True,
        "output_video": str(destination),
        "source": media,
        "output": output_media,
        "cue_count": len(cues),
        "layout": layout,
        "cues": [asdict(cue) for cue in cues],
    }
