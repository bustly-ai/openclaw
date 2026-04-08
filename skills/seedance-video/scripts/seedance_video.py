#!/usr/bin/env python3
"""Generate Seedance videos via Bustly Model Gateway (vidio.advanced route)."""

from __future__ import annotations

import argparse
import json
import math
import os
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlencode
from urllib.request import Request, urlopen
from uuid import uuid4

DEFAULT_ROUTE_MODEL = os.environ.get("BUSTLY_MODEL_GATEWAY_VIDEO_ROUTE", "vidio.advanced").strip() or "vidio.advanced"
DEFAULT_USER_AGENT = os.environ.get("BUSTLY_MODEL_GATEWAY_USER_AGENT", "OpenClaw/CLI").strip() or "OpenClaw/CLI"
DEFAULT_STATE_DIR = ".bustly"
FALLBACK_GATEWAY_BASE_URL = "https://gw.bustly.ai"

CREATE_ENDPOINT = "/api/v1/video/generations/tasks"
QUERY_ENDPOINT_PREFIX = "/api/v1/video/generations/tasks"

DONE_STATUSES = {"succeeded", "success", "completed", "done", "finished"}
FAILED_STATUSES = {"failed", "error", "cancelled", "canceled", "rejected", "timeout"}
VIDEO_EXTENSIONS = (".mp4", ".mov", ".webm", ".mkv", ".m4v")

DEFAULT_NEGATIVE_CONSTRAINTS = [
    "no logo",
    "no subtitles",
    "no on-screen text",
    "no jitter",
    "no distorted limbs",
    "no broken anatomy",
]

DEFAULT_SINGLE_MAX_DURATION = int(os.environ.get("SEEDANCE_SINGLE_MAX_DURATION", "10") or "10")

IP_SAFETY_NEGATIVES = [
    "no franchise characters",
    "no brand references",
    "no trademark logos",
    "no copyrighted character likeness",
]

READABLE_TEXT_HINT_PATTERNS = [
    re.compile(pattern, re.IGNORECASE)
    for pattern in [
        r"文字",
        r"文案",
        r"字幕",
        r"标签",
        r"标题",
        r"价格",
        r"名称",
        r"logo",
        r"watermark",
        r"\btext\b",
        r"\bsubtitle\b",
        r"\bcaption\b",
        r"\blabel\b",
        r"\bprice\b",
        r"\bon[- ]?screen\b",
    ]
]

IP_RISK_PATTERNS = [
    re.compile(pattern, re.IGNORECASE)
    for pattern in [
        r"\bdragon\s*ball\b",
        r"\bgoku\b",
        r"\bpokemon\b",
        r"\bpikachu\b",
        r"\bnaruto\b",
        r"\bone\s*piece\b",
        r"\bluffy\b",
        r"\bmarvel\b",
        r"\biron\s*man\b",
        r"\bavengers\b",
        r"\bdisney\b",
        r"\bstar\s*wars\b",
        r"蜡笔小新",
        r"龙珠",
        r"七龙珠",
        r"孙悟空",
        r"宝可梦",
        r"皮卡丘",
        r"火影",
        r"鸣人",
        r"海贼王",
        r"路飞",
        r"漫威",
        r"钢铁侠",
        r"复仇者联盟",
        r"迪士尼",
        r"星球大战",
    ]
]

TIMECODE_RE = re.compile(r"\b\d+\s*[-~]\s*\d+\s*(?:s|sec|seconds|秒)\b", re.IGNORECASE)


def resolve_state_dir() -> Path:
    override = os.environ.get("OPENCLAW_STATE_DIR", "").strip()
    if override:
        return Path(os.path.expanduser(override)).resolve()
    return (Path.home() / DEFAULT_STATE_DIR).resolve()


def load_bustly_oauth_config() -> dict[str, Any]:
    config_path = resolve_state_dir() / "bustlyOauth.json"
    if not config_path.exists():
        raise RuntimeError(
            f"Missing auth config: {config_path}. Please log in from Bustly desktop first."
        )
    try:
        payload = json.loads(config_path.read_text(encoding="utf-8"))
    except Exception as exc:
        raise RuntimeError(f"Failed to parse {config_path}: {exc}") from exc
    if not isinstance(payload, dict):
        raise RuntimeError(f"Invalid auth config format in {config_path}.")
    return payload


def load_openclaw_config() -> dict[str, Any]:
    config_path = resolve_state_dir() / "openclaw.json"
    if not config_path.exists():
        return {}
    try:
        payload = json.loads(config_path.read_text(encoding="utf-8"))
    except Exception:
        return {}
    return payload if isinstance(payload, dict) else {}


def resolve_gateway_base_url() -> str:
    cfg = load_openclaw_config()
    providers = ((cfg.get("models") or {}).get("providers") or {})
    bustly = providers.get("bustly") if isinstance(providers, dict) else {}
    if isinstance(bustly, dict):
        base_url = str(bustly.get("baseUrl") or "").strip()
        if base_url:
            return base_url
    return FALLBACK_GATEWAY_BASE_URL


def resolve_auth(args: argparse.Namespace) -> tuple[str, str]:
    if args.jwt and args.workspace_id:
        return args.jwt.strip(), args.workspace_id.strip()

    oauth = load_bustly_oauth_config()
    user = oauth.get("user")
    if not isinstance(user, dict):
        raise RuntimeError("Invalid bustlyOauth.json: missing user object.")

    jwt = (args.jwt or user.get("userAccessToken") or "").strip()
    workspace_id = (args.workspace_id or user.get("workspaceId") or "").strip()

    if not jwt:
        raise RuntimeError("Missing user.userAccessToken in bustlyOauth.json.")
    if not workspace_id:
        raise RuntimeError("Missing user.workspaceId in bustlyOauth.json.")
    return jwt, workspace_id


def resolve_run_id(args: argparse.Namespace) -> str:
    run_id = (
        (getattr(args, "run_id", "") or "").strip()
        or os.environ.get("OPENCLAW_RUN_ID", "").strip()
        or os.environ.get("BUSTLY_RUN_ID", "").strip()
    )
    return run_id or f"skill-seedance-{uuid4()}"


def resolve_session_id(args: argparse.Namespace) -> str:
    # OPENCLAW_SESSION_ID is injected per skill subprocess (exec tool defaults/env),
    # not as a process-global singleton across concurrent agent runs.
    return (
        (getattr(args, "session_id", "") or "").strip()
        or os.environ.get("OPENCLAW_SESSION_ID", "").strip()
        or os.environ.get("BUSTLY_SESSION_ID", "").strip()
    )


def create_task_url(base_url: str) -> str:
    base = (base_url or "").strip().rstrip("/")
    if not base:
        raise RuntimeError("Gateway base URL is empty.")
    if base.endswith("/api/v1"):
        return f"{base}/video/generations/tasks"
    return f"{base}{CREATE_ENDPOINT}"


def query_task_url(base_url: str, task_id: str, model: str) -> str:
    base = (base_url or "").strip().rstrip("/")
    if not base:
        raise RuntimeError("Gateway base URL is empty.")
    q = urlencode({"model": model})
    if base.endswith("/api/v1"):
        return f"{base}/video/generations/tasks/{quote(task_id, safe='')}?{q}"
    return f"{base}{QUERY_ENDPOINT_PREFIX}/{quote(task_id, safe='')}?{q}"


def _json_error_message(raw_text: str) -> str:
    try:
        payload = json.loads(raw_text)
    except Exception:
        return raw_text
    if not isinstance(payload, dict):
        return raw_text

    error_obj = payload.get("error")
    if isinstance(error_obj, dict):
        return str(error_obj.get("message") or raw_text)
    return str(payload.get("message") or raw_text)


def _is_duration_unsupported_error(error: Exception) -> bool:
    text = str(error).lower()
    return (
        "duration" in text
        and (
            "not valid" in text
            or "not supported" in text
            or "invalid" in text
        )
    )


def _http_json(
    method: str,
    url: str,
    headers: dict[str, str],
    payload: dict[str, Any] | None,
    timeout_seconds: int,
) -> dict[str, Any]:
    body = None
    req_headers = dict(headers)
    if payload is not None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        req_headers.setdefault("Content-Type", "application/json")
    req_headers.setdefault("Accept", "application/json")
    req_headers.setdefault("User-Agent", DEFAULT_USER_AGENT)
    req = Request(url, data=body, method=method, headers=req_headers)
    try:
        with urlopen(req, timeout=timeout_seconds) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
        parsed = json.loads(raw)
        if not isinstance(parsed, dict):
            raise RuntimeError(f"Gateway returned non-object JSON: {raw[:500]}")
        return parsed
    except HTTPError as exc:
        raw = exc.read().decode("utf-8", errors="replace")
        message = _json_error_message(raw)
        raise RuntimeError(f"Gateway request failed ({exc.code}): {message}") from exc
    except URLError as exc:
        raise RuntimeError(f"Gateway request failed: {exc}") from exc
    except Exception as exc:
        raise RuntimeError(f"Gateway request failed: {exc}") from exc


def _append_flag_if_missing(prompt: str, flag: str, value: str | None) -> str:
    if not value:
        return prompt
    token = f"--{flag}"
    if token in prompt:
        return prompt
    return f"{prompt} {token} {value}".strip()


def build_seedance_prompt(
    prompt: str,
    *,
    duration_seconds: int,
    aspect_ratio: str,
    camera_fixed: bool,
    watermark: bool,
) -> str:
    text = (prompt or "").strip()
    if not text:
        raise RuntimeError("Prompt cannot be empty.")

    text = _append_flag_if_missing(text, "duration", str(duration_seconds))
    if aspect_ratio.strip():
        text = _append_flag_if_missing(text, "ratio", aspect_ratio.strip())
    text = _append_flag_if_missing(text, "camerafixed", "true" if camera_fixed else "false")
    text = _append_flag_if_missing(text, "watermark", "true" if watermark else "false")
    return text


def _contains_chinese(text: str) -> bool:
    for ch in text:
        if "\u4e00" <= ch <= "\u9fff":
            return True
    return False


def rewrite_ip_sensitive_prompt(prompt: str, enabled: bool) -> tuple[str, bool]:
    text = (prompt or "").strip()
    if not text or not enabled:
        return text, False

    risky = any(pattern.search(text) for pattern in IP_RISK_PATTERNS)
    if not risky:
        return text, False

    if _contains_chinese(text):
        rewritten = (
            "将下述需求改写为原创角色与原创世界观表达，保留镜头节奏和叙事目标，不使用任何IP角色或品牌名：\n"
            f"{text}"
        )
    else:
        rewritten = (
            "Rewrite the request as original characters and original world-building while keeping pacing and intent. "
            "Do not use franchise names or brand terms.\n"
            f"{text}"
        )
    return rewritten, True


def _has_readable_text_requirements(prompt: str) -> bool:
    text = (prompt or "").strip()
    if not text:
        return False
    return any(pattern.search(text) for pattern in READABLE_TEXT_HINT_PATTERNS)


def rewrite_readable_text_prompt(prompt: str, *, allow_readable_text: bool) -> tuple[str, bool]:
    text = (prompt or "").strip()
    if not text or allow_readable_text:
        return text, False
    if not _has_readable_text_requirements(text):
        return text, False

    if _contains_chinese(text):
        guard = (
            "输出约束：画面中不要出现可读文字、数字、价格、品牌Logo或水印。"
            "请改用图标、色块、构图与物体动作表达信息。"
        )
    else:
        guard = (
            "Output constraints: do not render readable text, digits, prices, brand logos, or watermarks in-frame. "
            "Use icons, color blocks, composition, and object motion to convey information."
        )
    rewritten = f"{text}\n\n{guard}".strip()
    return rewritten, True


def resolve_mode(mode_override: str, image_urls: list[str], video_urls: list[str], audio_urls: list[str]) -> str:
    mode = (mode_override or "auto").strip().lower()
    if mode and mode != "auto":
        return mode
    if video_urls or audio_urls or len(image_urls) >= 2:
        return "all-reference"
    if len(image_urls) == 1:
        return "first-last-frame"
    return "text-only"


def build_assets_mapping(mode: str, image_urls: list[str], video_urls: list[str], audio_urls: list[str]) -> list[str]:
    if mode == "text-only" and not (image_urls or video_urls or audio_urls):
        return ["- none"]

    mapping: list[str] = []
    for idx, _ in enumerate(image_urls, start=1):
        if idx == 1:
            mapping.append("- @image1: first frame / identity anchor")
        elif idx == 2:
            mapping.append("- @image2: last frame or composition anchor")
        else:
            mapping.append(f"- @image{idx}: environment/style reference")

    for idx, _ in enumerate(video_urls, start=1):
        if idx == 1:
            mapping.append("- @video1: camera language + motion rhythm")
        else:
            mapping.append(f"- @video{idx}: secondary motion reference")

    for idx, _ in enumerate(audio_urls, start=1):
        if idx == 1:
            mapping.append("- @audio1: pacing / atmosphere")
        else:
            mapping.append(f"- @audio{idx}: secondary audio reference")

    return mapping or ["- none"]


def _build_timecoded_beats(duration_seconds: int) -> list[str]:
    d = max(4, int(duration_seconds))
    p1 = max(1, round(d * 0.3))
    p2 = max(p1 + 1, round(d * 0.7))
    if p2 >= d:
        p2 = max(p1 + 1, d - 1)
    return [
        f"0-{p1}s: establish scene and subject with clear composition.",
        f"{p1}-{p2}s: one major action with coherent camera movement.",
        f"{p2}-{d}s: resolve action and land on a stable ending frame.",
    ]


def build_negative_constraints(
    *,
    include_defaults: bool,
    custom_negatives: list[str],
    watermark: bool,
    ip_safety_applied: bool,
) -> list[str]:
    values: list[str] = []
    if include_defaults:
        values.extend(DEFAULT_NEGATIVE_CONSTRAINTS)
    if not watermark:
        values.append("no watermark")
    if ip_safety_applied:
        values.extend(IP_SAFETY_NEGATIVES)
    for item in custom_negatives:
        value = str(item or "").strip()
        if value:
            values.append(value)
    # de-dup while preserving order
    seen: set[str] = set()
    result: list[str] = []
    for item in values:
        lowered = item.lower()
        if lowered in seen:
            continue
        seen.add(lowered)
        result.append(item)
    return result


def _segment_instruction(
    *,
    segment_index: int,
    segment_count: int,
    continuation: bool,
    use_video_reference: bool,
) -> str:
    if segment_index <= 1 or not continuation:
        return "Generate this segment as the opening clip and end on a clean handoff frame."
    if use_video_reference:
        return (
            f"Segment {segment_index}/{segment_count}: Extend @video1 seamlessly. "
            "Preserve identity, outfit, lighting, camera direction, and motion rhythm."
        )
    return (
        f"Segment {segment_index}/{segment_count}: Continue narrative continuity without using @video reference. "
        "Preserve identity, outfit, lighting, camera direction, and motion rhythm."
    )


def build_structured_prompt(
    *,
    raw_prompt: str,
    mode_override: str,
    image_urls: list[str],
    video_urls: list[str],
    audio_urls: list[str],
    duration_seconds: int,
    aspect_ratio: str,
    generate_audio: bool,
    watermark: bool,
    include_default_negatives: bool,
    custom_negatives: list[str],
    ip_safe_rewrite: bool,
    allow_readable_text: bool,
    segment_index: int,
    segment_count: int,
    continuation: bool,
    use_video_reference: bool,
) -> dict[str, Any]:
    rewritten_prompt, ip_applied = rewrite_ip_sensitive_prompt(raw_prompt, ip_safe_rewrite)
    rewritten_prompt, text_guard_applied = rewrite_readable_text_prompt(
        rewritten_prompt,
        allow_readable_text=allow_readable_text,
    )
    mode = resolve_mode(mode_override, image_urls, video_urls, audio_urls)
    mapping = build_assets_mapping(mode, image_urls, video_urls, audio_urls)
    negatives = build_negative_constraints(
        include_defaults=include_default_negatives,
        custom_negatives=custom_negatives,
        watermark=watermark,
        ip_safety_applied=ip_applied,
    )

    body_lines = [rewritten_prompt.strip()]
    if not TIMECODE_RE.search(rewritten_prompt):
        body_lines.append("")
        body_lines.append("Timeline beats:")
        body_lines.extend(_build_timecoded_beats(duration_seconds))
    body_lines.append("")
    body_lines.append(
        _segment_instruction(
            segment_index=segment_index,
            segment_count=segment_count,
            continuation=continuation,
            use_video_reference=use_video_reference,
        )
    )
    body_lines.append("Use physically plausible motion and coherent lighting.")
    final_prompt = "\n".join(line for line in body_lines if line is not None).strip()

    settings = [
        f"Duration: {duration_seconds}s",
        f"Aspect Ratio: {aspect_ratio}",
        f"Audio: {'on' if generate_audio else 'off'}",
        f"Watermark: {'true' if watermark else 'false'}",
    ]

    prompt_text = (
        f"Mode: {mode}\n"
        "Assets Mapping:\n"
        + "\n".join(mapping)
        + "\n\nFinal Prompt:\n"
        + final_prompt
        + "\n\nNegative Constraints:\n"
        + ("\n".join(f"- {item}" for item in negatives) if negatives else "- none")
        + "\n\nGeneration Settings:\n"
        + "\n".join(settings)
    ).strip()

    return {
        "mode": mode,
        "assets_mapping": mapping,
        "final_prompt": final_prompt,
        "negative_constraints": negatives,
        "generation_settings": settings,
        "ip_safe_rewrite_applied": ip_applied,
        "readable_text_guard_applied": text_guard_applied,
        "prompt_text": prompt_text,
    }


def _content_ref(kind: str, url: str) -> dict[str, Any]:
    item: dict[str, Any] = {"type": kind, kind: {"url": url}}
    if kind == "video_url":
        item["role"] = "reference_video"
    elif kind == "image_url":
        item["role"] = "reference_image"
    elif kind == "audio_url":
        item["role"] = "reference_audio"
    return item


def build_content_items(
    text_prompt: str,
    *,
    image_urls: list[str],
    video_urls: list[str],
    audio_urls: list[str],
) -> list[dict[str, Any]]:
    content: list[dict[str, Any]] = [{"type": "text", "text": text_prompt}]
    for raw in image_urls:
        url = str(raw or "").strip()
        if url:
            content.append(_content_ref("image_url", url))
    for raw in video_urls:
        url = str(raw or "").strip()
        if url:
            content.append(_content_ref("video_url", url))
    for raw in audio_urls:
        url = str(raw or "").strip()
        if url:
            content.append(_content_ref("audio_url", url))
    return content


def build_create_payload(
    *,
    model: str,
    text_prompt: str,
    image_urls: list[str],
    video_urls: list[str],
    audio_urls: list[str],
    generate_audio: bool,
    watermark: bool,
) -> dict[str, Any]:
    return {
        "model": model,
        "content": build_content_items(
            text_prompt,
            image_urls=image_urls,
            video_urls=video_urls,
            audio_urls=audio_urls,
        ),
        "generate_audio": generate_audio,
        "watermark": watermark,
    }


def extract_task_id(payload: dict[str, Any]) -> str:
    candidates = [
        payload.get("id"),
        (payload.get("data") or {}).get("id") if isinstance(payload.get("data"), dict) else None,
        (payload.get("task") or {}).get("id") if isinstance(payload.get("task"), dict) else None,
    ]
    for item in candidates:
        if isinstance(item, str) and item.strip():
            return item.strip()
    raise RuntimeError(f"Could not find task id from response: {json.dumps(payload, ensure_ascii=False)[:800]}")


def extract_status(payload: dict[str, Any]) -> str:
    candidates = [
        payload.get("status"),
        (payload.get("data") or {}).get("status") if isinstance(payload.get("data"), dict) else None,
        (payload.get("task") or {}).get("status") if isinstance(payload.get("task"), dict) else None,
    ]
    for item in candidates:
        if isinstance(item, str) and item.strip():
            return item.strip().lower()
    return ""


def _walk_urls(node: Any, path: str, out: list[tuple[str, str]]) -> None:
    if isinstance(node, dict):
        for key, value in node.items():
            key_path = f"{path}.{key}" if path else key
            _walk_urls(value, key_path, out)
        return
    if isinstance(node, list):
        for idx, value in enumerate(node):
            idx_path = f"{path}[{idx}]"
            _walk_urls(value, idx_path, out)
        return
    if isinstance(node, str):
        text = node.strip()
        if text.startswith("http://") or text.startswith("https://"):
            out.append((path, text))


def extract_urls(payload: dict[str, Any]) -> list[tuple[str, str]]:
    items: list[tuple[str, str]] = []
    _walk_urls(payload, "", items)
    dedup: dict[str, tuple[str, str]] = {}
    for path, url in items:
        dedup[url] = (path, url)
    return list(dedup.values())


def pick_primary_video_url(payload: dict[str, Any]) -> str | None:
    candidates = extract_urls(payload)
    if not candidates:
        return None

    def score(item: tuple[str, str]) -> tuple[int, int]:
        path, url = item
        lowered_path = path.lower()
        lowered_url = url.lower()
        s1 = 0
        if "video" in lowered_path:
            s1 += 4
        if "output" in lowered_path or "result" in lowered_path:
            s1 += 2
        if lowered_url.endswith(VIDEO_EXTENSIONS):
            s1 += 3
        if ".mp4" in lowered_url:
            s1 += 1
        s2 = -len(path)
        return (s1, s2)

    best = sorted(candidates, key=score, reverse=True)[0]
    return best[1]


def extract_usage(payload: dict[str, Any]) -> dict[str, Any] | None:
    usage = payload.get("usage")
    if isinstance(usage, dict):
        return usage
    data = payload.get("data")
    if isinstance(data, dict):
        nested = data.get("usage")
        if isinstance(nested, dict):
            return nested
    task = payload.get("task")
    if isinstance(task, dict):
        nested = task.get("usage")
        if isinstance(nested, dict):
            return nested
    return None


def build_headers(jwt: str, workspace_id: str, run_id: str, session_id: str) -> dict[str, str]:
    headers = {
        "Authorization": f"Bearer {jwt}",
        "X-Workspace-Id": workspace_id,
        "X-Run-Id": run_id,
    }
    if session_id:
        headers["X-Session-Id"] = session_id
    return headers


def create_video_task(
    gateway_base_url: str,
    headers: dict[str, str],
    payload: dict[str, Any],
    timeout_seconds: int,
) -> dict[str, Any]:
    return _http_json(
        "POST",
        create_task_url(gateway_base_url),
        headers,
        payload,
        timeout_seconds,
    )


def get_video_task(
    gateway_base_url: str,
    headers: dict[str, str],
    task_id: str,
    model: str,
    timeout_seconds: int,
) -> dict[str, Any]:
    return _http_json(
        "GET",
        query_task_url(gateway_base_url, task_id, model),
        headers,
        None,
        timeout_seconds,
    )


def poll_task_until_done(
    gateway_base_url: str,
    headers: dict[str, str],
    task_id: str,
    model: str,
    *,
    poll_interval_seconds: float,
    max_wait_seconds: int,
    timeout_seconds: int,
) -> dict[str, Any]:
    started = time.monotonic()
    last_payload: dict[str, Any] | None = None
    while True:
        payload = get_video_task(gateway_base_url, headers, task_id, model, timeout_seconds)
        last_payload = payload
        status = extract_status(payload)
        elapsed = int(time.monotonic() - started)
        print(f"[poll] task={task_id} status={status or 'unknown'} elapsed={elapsed}s")

        if status in DONE_STATUSES:
            return payload
        if status in FAILED_STATUSES:
            raise RuntimeError(
                f"Video task failed: task={task_id}, status={status}, payload={json.dumps(payload, ensure_ascii=False)[:1200]}"
            )
        if elapsed >= max_wait_seconds:
            raise RuntimeError(
                f"Video task timeout after {max_wait_seconds}s: task={task_id}, last={json.dumps(last_payload, ensure_ascii=False)[:1200]}"
            )
        time.sleep(max(0.2, poll_interval_seconds))


def download_file(url: str, out_path: Path, timeout_seconds: int) -> Path:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    req = Request(url, method="GET", headers={"User-Agent": DEFAULT_USER_AGENT})
    with urlopen(req, timeout=timeout_seconds) as resp:
        data = resp.read()
    out_path.write_bytes(data)
    return out_path


def _ffmpeg_concat_copy(inputs: list[Path], output_path: Path) -> tuple[bool, str]:
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        return False, "ffmpeg not found in PATH"

    concat_file = output_path.parent / "seedance_concat_list.txt"
    lines = []
    for item in inputs:
        escaped = str(item.resolve()).replace("'", "'\\''")
        lines.append(f"file '{escaped}'")
    concat_file.write_text("\n".join(lines) + "\n", encoding="utf-8")

    copy_cmd = [
        ffmpeg,
        "-y",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        str(concat_file),
        "-c",
        "copy",
        str(output_path),
    ]
    proc = subprocess.run(copy_cmd, capture_output=True, text=True)
    if proc.returncode == 0:
        return True, "concat copy succeeded"

    reencode_cmd = [
        ffmpeg,
        "-y",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        str(concat_file),
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        str(output_path),
    ]
    proc2 = subprocess.run(reencode_cmd, capture_output=True, text=True)
    if proc2.returncode == 0:
        return True, "concat re-encode succeeded"

    message = (
        "ffmpeg concat failed.\n"
        f"[copy stderr]\n{proc.stderr[-1200:]}\n"
        f"[reencode stderr]\n{proc2.stderr[-1200:]}"
    )
    return False, message


def _segment_durations(target_duration: int, segment_duration: int) -> list[int]:
    if target_duration <= 0:
        raise RuntimeError("target_duration must be > 0")
    if segment_duration <= 0:
        raise RuntimeError("segment_duration must be > 0")

    segments = int(math.ceil(float(target_duration) / float(segment_duration)))
    durations: list[int] = []
    remaining = target_duration
    for _ in range(segments):
        current = min(segment_duration, remaining)
        durations.append(current)
        remaining -= current
    return durations


def _segment_filename(base_name: str, index: int, task_id: str) -> str:
    seed = base_name.strip() or "seedance"
    return f"{seed}_segment_{index:02d}_{task_id}.mp4"


def run_single_segment(
    *,
    gateway_base_url: str,
    headers: dict[str, str],
    model: str,
    prompt: str,
    duration: int,
    aspect_ratio: str,
    image_urls: list[str],
    video_urls: list[str],
    audio_urls: list[str],
    generate_audio: bool,
    camera_fixed: bool,
    watermark: bool,
    mode_override: str,
    include_default_negatives: bool,
    custom_negatives: list[str],
    ip_safe_rewrite: bool,
    allow_readable_text: bool,
    output_dir: Path,
    filename_prefix: str,
    download: bool,
    poll_interval_seconds: float,
    max_wait_seconds: int,
    timeout_seconds: int,
) -> dict[str, Any]:
    plan = build_structured_prompt(
        raw_prompt=prompt,
        mode_override=mode_override,
        image_urls=image_urls,
        video_urls=video_urls,
        audio_urls=audio_urls,
        duration_seconds=duration,
        aspect_ratio=aspect_ratio,
        generate_audio=generate_audio,
        watermark=watermark,
        include_default_negatives=include_default_negatives,
        custom_negatives=custom_negatives,
        ip_safe_rewrite=ip_safe_rewrite,
        allow_readable_text=allow_readable_text,
        segment_index=1,
        segment_count=1,
        continuation=False,
        use_video_reference=bool(video_urls),
    )

    text_prompt = build_seedance_prompt(
        plan["prompt_text"],
        duration_seconds=duration,
        aspect_ratio=aspect_ratio,
        camera_fixed=camera_fixed,
        watermark=watermark,
    )
    payload = build_create_payload(
        model=model,
        text_prompt=text_prompt,
        image_urls=image_urls,
        video_urls=video_urls,
        audio_urls=audio_urls,
        generate_audio=generate_audio,
        watermark=watermark,
    )

    create_resp = create_video_task(gateway_base_url, headers, payload, timeout_seconds)
    task_id = extract_task_id(create_resp)
    print(f"TASK: {task_id}")
    final_resp = poll_task_until_done(
        gateway_base_url,
        headers,
        task_id,
        model,
        poll_interval_seconds=poll_interval_seconds,
        max_wait_seconds=max_wait_seconds,
        timeout_seconds=timeout_seconds,
    )
    video_url = pick_primary_video_url(final_resp)
    if video_url:
        print(f"VIDEO_URL: {video_url}")

    local_file: Path | None = None
    if download and video_url:
        output_dir.mkdir(parents=True, exist_ok=True)
        filename = _segment_filename(filename_prefix, 1, task_id)
        local_file = download_file(video_url, output_dir / filename, timeout_seconds)
        print(f"VIDEO_FILE: {local_file}")
        print(f"MEDIA: {local_file}")

    return {
        "prompt_plan": {
            "mode": plan["mode"],
            "assets_mapping": plan["assets_mapping"],
            "negative_constraints": plan["negative_constraints"],
            "generation_settings": plan["generation_settings"],
            "ip_safe_rewrite_applied": plan["ip_safe_rewrite_applied"],
            "readable_text_guard_applied": plan["readable_text_guard_applied"],
            "final_prompt": plan["final_prompt"],
        },
        "task_id": task_id,
        "status": extract_status(final_resp),
        "video_url": video_url,
        "video_file": str(local_file) if local_file else None,
        "usage": extract_usage(final_resp),
        "create_response": create_resp,
        "final_response": final_resp,
    }


def run_multi_segment(
    *,
    gateway_base_url: str,
    headers: dict[str, str],
    model: str,
    prompt: str,
    target_duration: int,
    segment_duration: int,
    aspect_ratio: str,
    image_urls: list[str],
    video_urls: list[str],
    audio_urls: list[str],
    generate_audio: bool,
    camera_fixed: bool,
    watermark: bool,
    mode_override: str,
    include_default_negatives: bool,
    custom_negatives: list[str],
    ip_safe_rewrite: bool,
    allow_readable_text: bool,
    output_dir: Path,
    filename_prefix: str,
    download: bool,
    stitch: bool,
    poll_interval_seconds: float,
    max_wait_seconds: int,
    timeout_seconds: int,
) -> dict[str, Any]:
    durations = _segment_durations(target_duration, segment_duration)
    print(f"LONG_MODE: target={target_duration}s segments={len(durations)} durations={durations}")

    segment_results: list[dict[str, Any]] = []
    previous_video_url: str | None = None
    stitched_file: Path | None = None

    for idx, duration in enumerate(durations, start=1):
        continuation = idx > 1
        seg_video_urls = list(video_urls)
        if continuation and previous_video_url:
            seg_video_urls.insert(0, previous_video_url)

        plan = build_structured_prompt(
            raw_prompt=prompt,
            mode_override=mode_override,
            image_urls=image_urls,
            video_urls=seg_video_urls,
            audio_urls=audio_urls,
            duration_seconds=duration,
            aspect_ratio=aspect_ratio,
            generate_audio=generate_audio,
            watermark=watermark,
            include_default_negatives=include_default_negatives,
            custom_negatives=custom_negatives,
            ip_safe_rewrite=ip_safe_rewrite,
            allow_readable_text=allow_readable_text,
            segment_index=idx,
            segment_count=len(durations),
            continuation=continuation,
            use_video_reference=bool(continuation and previous_video_url),
        )

        text_prompt = build_seedance_prompt(
            plan["prompt_text"],
            duration_seconds=duration,
            aspect_ratio=aspect_ratio,
            camera_fixed=camera_fixed,
            watermark=watermark,
        )
        payload = build_create_payload(
            model=model,
            text_prompt=text_prompt,
            image_urls=image_urls,
            video_urls=seg_video_urls,
            audio_urls=audio_urls,
            generate_audio=generate_audio,
            watermark=watermark,
        )

        print(f"[segment {idx}/{len(durations)}] creating task ...")
        try:
            create_resp = create_video_task(gateway_base_url, headers, payload, timeout_seconds)
        except RuntimeError as exc:
            # Some Seedance endpoints/models do not support video-reference continuation (r2v).
            # Fallback to plain segment generation so long-duration output can still complete.
            error_text = str(exc).lower()
            can_fallback_without_video_ref = continuation and bool(previous_video_url)
            if can_fallback_without_video_ref and ("task_type r2v" in error_text or "reference video" in error_text):
                print(
                    f"[segment {idx}/{len(durations)}] WARN: continuation reference not supported, retrying without reference video."
                )
                fallback_plan = build_structured_prompt(
                    raw_prompt=prompt,
                    mode_override=mode_override,
                    image_urls=image_urls,
                    video_urls=video_urls,
                    audio_urls=audio_urls,
                    duration_seconds=duration,
                    aspect_ratio=aspect_ratio,
                    generate_audio=generate_audio,
                    watermark=watermark,
                    include_default_negatives=include_default_negatives,
                    custom_negatives=custom_negatives,
                    ip_safe_rewrite=ip_safe_rewrite,
                    allow_readable_text=allow_readable_text,
                    segment_index=idx,
                    segment_count=len(durations),
                    continuation=continuation,
                    use_video_reference=False,
                )
                fallback_prompt = build_seedance_prompt(
                    fallback_plan["prompt_text"],
                    duration_seconds=duration,
                    aspect_ratio=aspect_ratio,
                    camera_fixed=camera_fixed,
                    watermark=watermark,
                )
                payload_no_ref = build_create_payload(
                    model=model,
                    text_prompt=fallback_prompt,
                    image_urls=image_urls,
                    video_urls=video_urls,
                    audio_urls=audio_urls,
                    generate_audio=generate_audio,
                    watermark=watermark,
                )
                create_resp = create_video_task(gateway_base_url, headers, payload_no_ref, timeout_seconds)
                plan = fallback_plan
            else:
                raise
        task_id = extract_task_id(create_resp)
        print(f"[segment {idx}/{len(durations)}] TASK: {task_id}")
        final_resp = poll_task_until_done(
            gateway_base_url,
            headers,
            task_id,
            model,
            poll_interval_seconds=poll_interval_seconds,
            max_wait_seconds=max_wait_seconds,
            timeout_seconds=timeout_seconds,
        )
        video_url = pick_primary_video_url(final_resp)
        if video_url:
            print(f"[segment {idx}/{len(durations)}] VIDEO_URL: {video_url}")
            previous_video_url = video_url

        local_file: Path | None = None
        if download and video_url:
            output_dir.mkdir(parents=True, exist_ok=True)
            filename = _segment_filename(filename_prefix, idx, task_id)
            local_file = download_file(video_url, output_dir / filename, timeout_seconds)
            print(f"[segment {idx}/{len(durations)}] VIDEO_FILE: {local_file}")

        segment_results.append(
            {
                "segment_index": idx,
                "duration": duration,
                "prompt_plan": {
                    "mode": plan["mode"],
                    "assets_mapping": plan["assets_mapping"],
                    "negative_constraints": plan["negative_constraints"],
                    "generation_settings": plan["generation_settings"],
                    "ip_safe_rewrite_applied": plan["ip_safe_rewrite_applied"],
                    "readable_text_guard_applied": plan["readable_text_guard_applied"],
                    "final_prompt": plan["final_prompt"],
                },
                "task_id": task_id,
                "status": extract_status(final_resp),
                "video_url": video_url,
                "video_file": str(local_file) if local_file else None,
                "usage": extract_usage(final_resp),
                "create_response": create_resp,
                "final_response": final_resp,
            }
        )

    if stitch and download:
        local_paths = [Path(item["video_file"]) for item in segment_results if item.get("video_file")]
        if local_paths and len(local_paths) == len(segment_results):
            final_name = f"{filename_prefix or 'seedance'}_{target_duration}s.mp4"
            stitched_target = output_dir / final_name
            ok, msg = _ffmpeg_concat_copy(local_paths, stitched_target)
            if ok:
                stitched_file = stitched_target
                print(f"STITCHED_FILE: {stitched_file}")
                print(f"MEDIA: {stitched_file}")
            else:
                print(f"WARN: {msg}")
        else:
            print("WARN: skip stitching because some segments have no local video file.")

    return {
        "target_duration": target_duration,
        "segment_duration": segment_duration,
        "segments": segment_results,
        "stitched_file": str(stitched_file) if stitched_file else None,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Seedance video generation via Bustly Model Gateway")
    parser.add_argument("--prompt", "-p", required=True, help="Video prompt")
    parser.add_argument(
        "--model",
        default=DEFAULT_ROUTE_MODEL,
        help=f"Gateway model route key (default: {DEFAULT_ROUTE_MODEL})",
    )

    parser.add_argument("--duration", type=int, default=10, help="Single segment duration in seconds (default: 10)")
    parser.add_argument("--target-duration", type=int, default=0, help="Total duration for long mode. If >0, script splits into segments.")
    parser.add_argument("--segment-duration", type=int, default=10, help="Per-segment duration in long mode (default: 10)")
    parser.add_argument(
        "--single-max-duration",
        type=int,
        default=DEFAULT_SINGLE_MAX_DURATION,
        help=(
            "Max duration to attempt as single request before auto-splitting. "
            f"default: {DEFAULT_SINGLE_MAX_DURATION}"
        ),
    )
    parser.add_argument("--aspect-ratio", default="16:9", help="Aspect ratio hint, appended as --ratio if absent in prompt.")

    parser.add_argument("--image-url", action="append", default=[], help="Reference image URL (repeatable)")
    parser.add_argument("--video-url", action="append", default=[], help="Reference video URL (repeatable)")
    parser.add_argument("--audio-url", action="append", default=[], help="Reference audio URL (repeatable)")
    parser.add_argument(
        "--mode",
        default="auto",
        choices=["auto", "text-only", "first-last-frame", "all-reference"],
        help="Prompt mode. Default auto-selects based on assets.",
    )

    parser.add_argument("--camera-fixed", dest="camera_fixed", action="store_true", help="Append --camerafixed true if absent.")
    parser.add_argument("--camera-free", dest="camera_fixed", action="store_false", help="Append --camerafixed false if absent.")
    parser.set_defaults(camera_fixed=False)

    parser.add_argument("--watermark", dest="watermark", action="store_true", help="Append --watermark true if absent.")
    parser.add_argument("--no-watermark", dest="watermark", action="store_false", help="Append --watermark false if absent (default).")
    parser.set_defaults(watermark=False)
    parser.add_argument(
        "--allow-readable-text",
        action="store_true",
        help="Allow readable on-screen text/price labels in generated video (off by default to avoid gibberish text artifacts).",
    )

    parser.add_argument("--generate-audio", dest="generate_audio", action="store_true", help="Request audio video output.")
    parser.add_argument("--no-generate-audio", dest="generate_audio", action="store_false", help="Request silent video output.")
    parser.set_defaults(generate_audio=True)

    parser.add_argument("--download", dest="download", action="store_true", help="Download output video URL(s) locally.")
    parser.add_argument("--no-download", dest="download", action="store_false", help="Do not download files; return URL only.")
    parser.set_defaults(download=True)

    parser.add_argument("--stitch", dest="stitch", action="store_true", help="In long mode, stitch all local segments using ffmpeg.")
    parser.add_argument("--no-stitch", dest="stitch", action="store_false", help="In long mode, skip stitching.")
    parser.set_defaults(stitch=True)
    parser.add_argument("--negative", action="append", default=[], help="Extra negative constraints (repeatable).")
    parser.add_argument(
        "--no-default-negatives",
        dest="default_negatives",
        action="store_false",
        help="Disable built-in negative constraints.",
    )
    parser.set_defaults(default_negatives=True)
    parser.add_argument(
        "--ip-safe-rewrite",
        dest="ip_safe_rewrite",
        action="store_true",
        help="Auto rewrite IP-sensitive prompt to original-character phrasing.",
    )
    parser.add_argument(
        "--no-ip-safe-rewrite",
        dest="ip_safe_rewrite",
        action="store_false",
        help="Disable automatic IP-safe rewrite.",
    )
    parser.set_defaults(ip_safe_rewrite=True)
    parser.add_argument("--plan-only", action="store_true", help="Only print prompt plan JSON, do not call gateway.")

    parser.add_argument("--output-dir", default="./seedance_output", help="Directory for downloaded videos and summary JSON.")
    parser.add_argument("--filename-prefix", default="seedance", help="Output filename prefix.")

    parser.add_argument("--poll-interval", type=float, default=5.0, help="Polling interval seconds (default: 5)")
    parser.add_argument("--max-wait", type=int, default=900, help="Max wait seconds per task (default: 900)")
    parser.add_argument("--request-timeout", type=int, default=180, help="HTTP request timeout seconds (default: 180)")

    parser.add_argument("--jwt", help="Bustly user JWT override (defaults to bustlyOauth.json user.userAccessToken)")
    parser.add_argument("--workspace-id", help="Workspace UUID override (defaults to bustlyOauth.json user.workspaceId)")
    parser.add_argument("--run-id", help="Logical task run id for usage aggregation")
    parser.add_argument("--session-id", help="Logical task session id for usage aggregation")
    parser.add_argument("--print-json", action="store_true", help="Print full summary JSON")
    return parser.parse_args()


def _validate_args(args: argparse.Namespace) -> None:
    if args.duration <= 0:
        raise RuntimeError("--duration must be > 0")
    if args.target_duration < 0:
        raise RuntimeError("--target-duration must be >= 0")
    if args.segment_duration <= 0:
        raise RuntimeError("--segment-duration must be > 0")
    if args.single_max_duration <= 0:
        raise RuntimeError("--single-max-duration must be > 0")
    if args.poll_interval <= 0:
        raise RuntimeError("--poll-interval must be > 0")
    if args.max_wait <= 0:
        raise RuntimeError("--max-wait must be > 0")
    if args.request_timeout <= 0:
        raise RuntimeError("--request-timeout must be > 0")


def main() -> None:
    args = parse_args()
    try:
        _validate_args(args)
        run_id = resolve_run_id(args)
        out_dir = Path(args.output_dir).expanduser().resolve()
        out_dir.mkdir(parents=True, exist_ok=True)

        auto_split = args.target_duration == 0 and args.duration > args.single_max_duration
        effective_target_duration = args.target_duration if args.target_duration > 0 else (args.duration if auto_split else 0)
        effective_segment_duration = args.segment_duration
        if auto_split:
            effective_segment_duration = min(args.segment_duration, args.single_max_duration)
            print(
                "AUTO_LONG_MODE: "
                f"duration={args.duration}s exceeds single-max={args.single_max_duration}s, "
                f"fallback to segmented generation target={effective_target_duration}s segment={effective_segment_duration}s."
            )

        if args.target_duration > 0 and args.segment_duration > 15:
            print(
                "WARN: segment-duration > 15s may exceed upstream Seedance limits; consider <= 15 for higher success rate."
            )
        if effective_target_duration == 0 and args.duration > 15:
            print("WARN: duration > 15s may exceed upstream Seedance limits.")

        if args.plan_only:
            summary: dict[str, Any] = {
                "run_id": run_id,
                "model": args.model,
                "mode": "plan-only",
                "generated_at": int(time.time()),
            }
            if effective_target_duration > 0:
                durations = _segment_durations(effective_target_duration, effective_segment_duration)
                plans: list[dict[str, Any]] = []
                for idx, duration in enumerate(durations, start=1):
                    continuation = idx > 1
                    seg_video_urls = list(args.video_url)
                    if continuation:
                        seg_video_urls = ["<previous_segment_video_url>"] + seg_video_urls
                    plan = build_structured_prompt(
                        raw_prompt=args.prompt,
                        mode_override=args.mode,
                        image_urls=args.image_url,
                        video_urls=seg_video_urls,
                        audio_urls=args.audio_url,
                        duration_seconds=duration,
                        aspect_ratio=args.aspect_ratio,
                        generate_audio=args.generate_audio,
                        watermark=args.watermark,
                        include_default_negatives=args.default_negatives,
                        custom_negatives=args.negative,
                        ip_safe_rewrite=args.ip_safe_rewrite,
                        allow_readable_text=args.allow_readable_text,
                        segment_index=idx,
                        segment_count=len(durations),
                        continuation=continuation,
                        use_video_reference=continuation,
                    )
                    plans.append(plan)
                summary["result"] = {
                    "target_duration": effective_target_duration,
                    "segment_duration": effective_segment_duration,
                    "plans": plans,
                    "auto_split_applied": auto_split,
                }
            else:
                plan = build_structured_prompt(
                    raw_prompt=args.prompt,
                    mode_override=args.mode,
                    image_urls=args.image_url,
                    video_urls=args.video_url,
                    audio_urls=args.audio_url,
                    duration_seconds=args.duration,
                    aspect_ratio=args.aspect_ratio,
                    generate_audio=args.generate_audio,
                    watermark=args.watermark,
                    include_default_negatives=args.default_negatives,
                    custom_negatives=args.negative,
                    ip_safe_rewrite=args.ip_safe_rewrite,
                    allow_readable_text=args.allow_readable_text,
                    segment_index=1,
                    segment_count=1,
                    continuation=False,
                    use_video_reference=bool(args.video_url),
                )
                summary["result"] = plan

            summary_path = out_dir / f"summary_{run_id}.json"
            summary_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
            print(f"SUMMARY_FILE: {summary_path}")
            print(json.dumps(summary, ensure_ascii=False, indent=2))
            return

        jwt, workspace_id = resolve_auth(args)
        session_id = resolve_session_id(args)
        gateway_base_url = resolve_gateway_base_url()
        headers = build_headers(jwt, workspace_id, run_id, session_id)

        summary = {
            "run_id": run_id,
            "workspace_id": workspace_id,
            "gateway_base_url": gateway_base_url,
            "model": args.model,
            "generated_at": int(time.time()),
        }

        if effective_target_duration > 0:
            multi = run_multi_segment(
                gateway_base_url=gateway_base_url,
                headers=headers,
                model=args.model,
                prompt=args.prompt,
                target_duration=effective_target_duration,
                segment_duration=effective_segment_duration,
                aspect_ratio=args.aspect_ratio,
                image_urls=args.image_url,
                video_urls=args.video_url,
                audio_urls=args.audio_url,
                generate_audio=args.generate_audio,
                camera_fixed=args.camera_fixed,
                watermark=args.watermark,
                mode_override=args.mode,
                include_default_negatives=args.default_negatives,
                custom_negatives=args.negative,
                ip_safe_rewrite=args.ip_safe_rewrite,
                allow_readable_text=args.allow_readable_text,
                output_dir=out_dir,
                filename_prefix=args.filename_prefix,
                download=args.download,
                stitch=args.stitch,
                poll_interval_seconds=args.poll_interval,
                max_wait_seconds=args.max_wait,
                timeout_seconds=args.request_timeout,
            )
            summary["mode"] = "multi-segment"
            summary["result"] = multi
            summary["auto_split_applied"] = auto_split
        else:
            try:
                single = run_single_segment(
                    gateway_base_url=gateway_base_url,
                    headers=headers,
                    model=args.model,
                    prompt=args.prompt,
                    duration=args.duration,
                    aspect_ratio=args.aspect_ratio,
                    image_urls=args.image_url,
                    video_urls=args.video_url,
                    audio_urls=args.audio_url,
                    generate_audio=args.generate_audio,
                    camera_fixed=args.camera_fixed,
                    watermark=args.watermark,
                    mode_override=args.mode,
                    include_default_negatives=args.default_negatives,
                    custom_negatives=args.negative,
                    ip_safe_rewrite=args.ip_safe_rewrite,
                    allow_readable_text=args.allow_readable_text,
                    output_dir=out_dir,
                    filename_prefix=args.filename_prefix,
                    download=args.download,
                    poll_interval_seconds=args.poll_interval,
                    max_wait_seconds=args.max_wait,
                    timeout_seconds=args.request_timeout,
                )
                summary["mode"] = "single-segment"
                summary["result"] = single
            except RuntimeError as exc:
                if not _is_duration_unsupported_error(exc):
                    raise
                retry_segment_duration = min(args.segment_duration, args.single_max_duration)
                if retry_segment_duration >= args.duration:
                    raise
                print(
                    "AUTO_RETRY_LONG_MODE: single-segment duration rejected by upstream, "
                    f"retrying as segmented generation target={args.duration}s segment={retry_segment_duration}s."
                )
                multi = run_multi_segment(
                    gateway_base_url=gateway_base_url,
                    headers=headers,
                    model=args.model,
                    prompt=args.prompt,
                    target_duration=args.duration,
                    segment_duration=retry_segment_duration,
                    aspect_ratio=args.aspect_ratio,
                    image_urls=args.image_url,
                    video_urls=args.video_url,
                    audio_urls=args.audio_url,
                    generate_audio=args.generate_audio,
                    camera_fixed=args.camera_fixed,
                    watermark=args.watermark,
                    mode_override=args.mode,
                    include_default_negatives=args.default_negatives,
                    custom_negatives=args.negative,
                    ip_safe_rewrite=args.ip_safe_rewrite,
                    allow_readable_text=args.allow_readable_text,
                    output_dir=out_dir,
                    filename_prefix=args.filename_prefix,
                    download=args.download,
                    stitch=args.stitch,
                    poll_interval_seconds=args.poll_interval,
                    max_wait_seconds=args.max_wait,
                    timeout_seconds=args.request_timeout,
                )
                summary["mode"] = "multi-segment"
                summary["result"] = multi
                summary["auto_split_applied"] = True
                summary["auto_split_reason"] = "single_duration_unsupported"

        summary_path = out_dir / f"summary_{run_id}.json"
        summary_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"SUMMARY_FILE: {summary_path}")
        if args.print_json:
            print(json.dumps(summary, ensure_ascii=False, indent=2))
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
