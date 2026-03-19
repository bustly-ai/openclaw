#!/usr/bin/env python3
"""Generate speech audio via Bustly Model Gateway (audio.pro route)."""

import argparse
import base64
import json
import os
import sys
from pathlib import Path
from typing import Any
from urllib.error import HTTPError
from urllib.request import Request, urlopen

DEFAULT_GATEWAY_BASE_URL_ENV = os.environ.get("BUSTLY_MODEL_GATEWAY_BASE_URL", "").strip()
DEFAULT_ROUTE_MODEL = os.environ.get("BUSTLY_MODEL_GATEWAY_AUDIO_ROUTE", "audio.pro").strip() or "audio.pro"
DEFAULT_USER_AGENT = os.environ.get("BUSTLY_MODEL_GATEWAY_USER_AGENT", "OpenClaw/CLI").strip() or "OpenClaw/CLI"
DEFAULT_STATE_DIR = ".bustly"
FALLBACK_GATEWAY_BASE_URL = "https://gw.bustly.ai"


def resolve_state_dir() -> Path:
    override = os.environ.get("OPENCLAW_STATE_DIR", "").strip()
    if override:
        return Path(os.path.expanduser(override)).resolve()
    return (Path.home() / DEFAULT_STATE_DIR).resolve()


def load_bustly_oauth_config() -> dict:
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


def load_openclaw_config() -> dict:
    config_path = resolve_state_dir() / "openclaw.json"
    if not config_path.exists():
        return {}
    try:
        payload = json.loads(config_path.read_text(encoding="utf-8"))
    except Exception:
        return {}
    return payload if isinstance(payload, dict) else {}


def resolve_gateway_base_url(cli_base_url: str | None) -> str:
    if isinstance(cli_base_url, str) and cli_base_url.strip():
        return cli_base_url.strip()
    if DEFAULT_GATEWAY_BASE_URL_ENV:
        return DEFAULT_GATEWAY_BASE_URL_ENV

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


def audio_speech_url(base_url: str) -> str:
    base = (base_url or "").strip().rstrip("/")
    if not base:
        raise RuntimeError("Gateway base URL is empty.")
    if base.endswith("/api/v1"):
        return f"{base}/audio/speech"
    return f"{base}/api/v1/audio/speech"


def decode_audio_payload(raw_audio: str) -> bytes:
    candidate = (raw_audio or "").strip()
    if not candidate:
        raise RuntimeError("TTS response did not include audio payload.")

    # MiniMax TTS returns hex in current API. Keep base64 fallback for compatibility.
    try:
        return bytes.fromhex(candidate)
    except ValueError:
        try:
            return base64.b64decode(candidate, validate=True)
        except Exception as exc:
            raise RuntimeError(f"Unsupported audio encoding in response: {exc}") from exc


def build_payload(args: argparse.Namespace) -> dict:
    if not args.text.strip():
        raise RuntimeError("Empty text provided")

    voice_setting = {
        "voice_id": args.voice,
        "speed": args.speed,
        "vol": 1.0,
        "pitch": 0,
    }
    if args.emotion:
        voice_setting["emotion"] = args.emotion

    return {
        "model": (args.model or DEFAULT_ROUTE_MODEL).strip() or DEFAULT_ROUTE_MODEL,
        "text": args.text,
        "stream": False,
        "voice_setting": voice_setting,
        "audio_setting": {
            "sample_rate": 32000,
            "bitrate": 128000,
            "format": "mp3",
            "channel": 1,
        },
    }


def call_gateway(gateway_base_url: str, jwt: str, workspace_id: str, payload: dict) -> tuple[dict | None, bytes]:
    target = audio_speech_url(gateway_base_url)
    req = Request(
        target,
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        method="POST",
        headers={
            "Authorization": f"Bearer {jwt}",
            "X-Workspace-Id": workspace_id,
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": DEFAULT_USER_AGENT,
        },
    )
    try:
        with urlopen(req, timeout=120) as resp:
            raw_body = resp.read()
            content_type = (resp.headers.get("content-type") or "").lower()
            if "application/json" in content_type:
                try:
                    text = raw_body.decode("utf-8", errors="strict")
                    parsed = json.loads(text)
                    if isinstance(parsed, dict):
                        return parsed, raw_body
                except Exception:
                    # Some upstreams may return audio bytes with JSON content-type.
                    pass
            return None, raw_body
    except HTTPError as exc:
        raw = exc.read().decode("utf-8", errors="replace")
        message = raw
        try:
            payload = json.loads(raw)
            if isinstance(payload, dict):
                error = payload.get("error")
                if isinstance(error, dict):
                    message = str(error.get("message") or message)
                else:
                    message = str(payload.get("message") or message)
        except Exception:
            pass
        raise RuntimeError(f"Gateway request failed ({exc.code}): {message}") from exc
    except Exception as exc:
        raise RuntimeError(f"Gateway request failed: {exc}") from exc


def main():
    parser = argparse.ArgumentParser(description="MiniMax Text-to-Speech via Bustly Gateway")
    parser.add_argument("text", help="Text to convert to speech")
    parser.add_argument(
        "--voice",
        default="male-qn-qingse",
        choices=[
            "male-qn-qingse",
            "female-shaonv",
            "female-yujie",
            "male-qn-jingying",
            "presenter_male",
            "presenter_female",
        ],
        help="Voice ID",
    )
    parser.add_argument(
        "--emotion",
        choices=["happy", "sad", "angry", "fearful", "disgusted", "surprised", "calm", "whisper"],
        help="Emotion",
    )
    parser.add_argument("--speed", type=float, default=1.0, help="Speed 0.5-2.0")
    parser.add_argument("--output", "-o", default="tts_output.mp3", help="Output file")
    parser.add_argument(
        "--model",
        default=DEFAULT_ROUTE_MODEL,
        help=f"Gateway model route key (default: {DEFAULT_ROUTE_MODEL})",
    )
    parser.add_argument(
        "--gateway-base-url",
        default="",
        help=(
            "Gateway base URL override. "
            "Priority: --gateway-base-url > BUSTLY_MODEL_GATEWAY_BASE_URL > "
            "~/.bustly/openclaw.json(models.providers.bustly.baseUrl) > "
            f"{FALLBACK_GATEWAY_BASE_URL}"
        ),
    )
    parser.add_argument(
        "--jwt",
        help="Bustly user JWT (optional; defaults to bustlyOauth.json user.userAccessToken)",
    )
    parser.add_argument(
        "--workspace-id",
        help="Workspace UUID (optional; defaults to bustlyOauth.json user.workspaceId)",
    )
    args = parser.parse_args()

    try:
        jwt, workspace_id = resolve_auth(args)
        gateway_base_url = resolve_gateway_base_url(args.gateway_base_url)
        payload = build_payload(args)
        data, raw_body = call_gateway(gateway_base_url, jwt, workspace_id, payload)

        extra: dict[str, Any] = {}
        if isinstance(data, dict):
            status_code = data.get("base_resp", {}).get("status_code", -1)
            if status_code != 0:
                raise RuntimeError(data.get("base_resp", {}).get("status_msg", "Unknown error"))

            raw_audio = data.get("data", {}).get("audio")
            if isinstance(raw_audio, str) and raw_audio.strip():
                audio_bytes = decode_audio_payload(raw_audio)
            elif raw_body:
                audio_bytes = raw_body
            else:
                raise RuntimeError("TTS response did not include audio payload.")
            extra = data.get("extra_info", {}) if isinstance(data.get("extra_info"), dict) else {}
        else:
            if not raw_body:
                raise RuntimeError("TTS response did not include audio payload.")
            audio_bytes = raw_body
        output_path = Path(args.output).expanduser().resolve()
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_bytes(audio_bytes)

        print(f"SUCCESS: Audio saved to {output_path}")
        print(f"Duration: {extra.get('audio_length', 0)} ms")
        print(f"Size: {extra.get('audio_size', len(audio_bytes))} bytes")
        print(f"Characters: {extra.get('usage_characters', 0)}")
    except Exception as exc:
        print(f"ERROR: {exc}")
        sys.exit(1)


if __name__ == "__main__":
    main()
