"""Local Higgsfield MCP bridge for the Promarkia Video Squad.

The bridge owns OAuth refresh, MCP JSON-RPC transport, durable explainer
manifests, cost preflight, batched generation, polling, and idempotent final
assembly. It never logs or returns OAuth credentials.
"""

from __future__ import annotations

import contextlib
import difflib
import hashlib
import json
import os
import re
import tempfile
import time
import uuid
from pathlib import Path
from typing import Any, Iterator
from urllib.parse import quote

import requests


MCP_URL = "https://mcp.higgsfield.ai/mcp"
DEFAULT_OAUTH_FILE = Path(
    os.getenv(
        "HIGGSFIELD_MCP_OAUTH_FILE",
        str(Path.home() / ".promarkia" / "higgsfield-mcp-oauth.json"),
    )
)
DEFAULT_STATE_DIR = Path(
    os.getenv(
        "HIGGSFIELD_EXPLAINER_STATE_DIR",
        str(Path.home() / ".promarkia" / "files" / "user" / "higgsfield-explainers"),
    )
)
PUBLIC_FILE_BASE = os.getenv(
    "PROMARKIA_PUBLIC_FILE_BASE",
    "http://127.0.0.1:8788/files/user",
).rstrip("/")
TERMINAL_STATUSES = {
    "completed",
    "failed",
    "canceled",
    "cancelled",
    "nsfw",
    "ip_detected",
}
RATE_LIMIT_RETRY_SECONDS = max(
    10, int(os.getenv("HIGGSFIELD_RATE_LIMIT_RETRY_SECONDS", "30"))
)
_UUID_RE = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-"
    r"[89ab][0-9a-f]{3}-[0-9a-f]{12}$",
    re.IGNORECASE,
)
_PLACEHOLDER_PARTS = {
    "auto",
    "automatic",
    "selected",
    "selectedafteroptions",
    "selectedfromoptions",
    "placeholder",
    "voiceid",
    "styleid",
    "stylepresetid",
    "tbd",
    "todo",
    "none",
    "null",
}
_STYLE_ALIASES = {
    "editorial motion graphics": (
        "premium animated technical explainer modern diagrams architecture "
        "clean motion graphics technology education"
    ),
    "whiteboard doodle": (
        "whiteboard hand drawn doodle marker educational explainer"
    ),
    "hand drawn": "hand drawn illustrated educational explainer",
    "pastel flat 2d": "flat vector clean modern two dimensional explainer",
    "isometric flat vector": (
        "isometric vector architecture systems technical diagram"
    ),
}
_DEFAULT_STYLE_TITLE = "Editorial Motion Graphics"
_DEFAULT_VOICE_NAME = "Julian"


class HiggsfieldMcpError(RuntimeError):
    """Safe provider error that contains no credentials."""


def _atomic_json_write(path: Path, value: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            json.dump(value, handle, ensure_ascii=False, indent=2)
            handle.flush()
            os.fsync(handle.fileno())
        try:
            os.chmod(temporary, 0o600)
        except OSError:
            pass
        os.replace(temporary, path)
    finally:
        with contextlib.suppress(FileNotFoundError):
            os.unlink(temporary)


@contextlib.contextmanager
def _locked_file(path: Path) -> Iterator[None]:
    """Cross-platform best-effort exclusive lock used around token refresh."""

    path.parent.mkdir(parents=True, exist_ok=True)
    lock_path = path.with_suffix(path.suffix + ".lock")
    handle = open(lock_path, "a+b")
    try:
        if os.name == "nt":
            import msvcrt

            handle.seek(0)
            if handle.tell() == 0:
                handle.write(b"0")
                handle.flush()
            msvcrt.locking(handle.fileno(), msvcrt.LK_LOCK, 1)
        else:
            import fcntl

            fcntl.flock(handle.fileno(), fcntl.LOCK_EX)
        yield
    finally:
        if os.name == "nt":
            import msvcrt

            handle.seek(0)
            with contextlib.suppress(OSError):
                msvcrt.locking(handle.fileno(), msvcrt.LK_UNLCK, 1)
        else:
            import fcntl

            with contextlib.suppress(OSError):
                fcntl.flock(handle.fileno(), fcntl.LOCK_UN)
        handle.close()


def _oauth_access_token(path: Path = DEFAULT_OAUTH_FILE) -> str:
    if not path.is_file():
        raise HiggsfieldMcpError("Higgsfield MCP OAuth is not configured")
    with _locked_file(path):
        state = json.loads(path.read_text(encoding="utf-8"))
        tokens = state.get("tokens") or {}
        access_token = tokens.get("access_token")
        refresh_token = tokens.get("refresh_token")
        issued_at = float(tokens.get("obtained_at") or path.stat().st_mtime)
        expires_in = int(tokens.get("expires_in") or 0)
        if access_token and (
            not expires_in or time.time() < issued_at + max(60, expires_in - 300)
        ):
            return str(access_token)
        if not refresh_token:
            raise HiggsfieldMcpError("Higgsfield MCP OAuth requires reauthorization")

        metadata = (state.get("discoveryState") or {}).get(
            "authorizationServerMetadata"
        ) or {}
        token_endpoint = metadata.get("token_endpoint")
        client = state.get("clientInformation") or {}
        client_id = client.get("client_id")
        if not token_endpoint or not client_id:
            raise HiggsfieldMcpError("Higgsfield MCP OAuth metadata is incomplete")
        response = requests.post(
            token_endpoint,
            data={
                "grant_type": "refresh_token",
                "refresh_token": refresh_token,
                "client_id": client_id,
                "scope": tokens.get("scope") or client.get("scope") or "",
            },
            timeout=30,
        )
        if response.status_code >= 400:
            raise HiggsfieldMcpError(
                f"Higgsfield OAuth refresh failed with HTTP {response.status_code}"
            )
        refreshed = response.json()
        if "access_token" not in refreshed:
            raise HiggsfieldMcpError("Higgsfield OAuth refresh returned no access token")
        if "refresh_token" not in refreshed:
            refreshed["refresh_token"] = refresh_token
        refreshed["obtained_at"] = int(time.time())
        state["tokens"] = refreshed
        _atomic_json_write(path, state)
        return str(refreshed["access_token"])


def _decode_mcp_response(response: requests.Response) -> dict[str, Any]:
    if response.status_code >= 400:
        request_id = response.headers.get("x-request-id") or response.headers.get(
            "request-id"
        )
        suffix = f" (request {request_id})" if request_id else ""
        raise HiggsfieldMcpError(
            f"Higgsfield MCP HTTP {response.status_code}{suffix}"
        )
    content_type = response.headers.get("content-type", "")
    if "application/json" in content_type:
        return response.json()
    events: list[dict[str, Any]] = []
    for line in response.text.splitlines():
        if line.startswith("data:"):
            raw = line[5:].strip()
            if raw:
                events.append(json.loads(raw))
    if not events:
        raise HiggsfieldMcpError(
            f"Unexpected Higgsfield MCP response type {content_type!r}"
        )
    return events[-1]


class HiggsfieldMcpClient:
    def __init__(self, oauth_file: Path = DEFAULT_OAUTH_FILE) -> None:
        self._oauth_file = oauth_file
        self._request_id = 0
        self._session_id: str | None = None
        self._access_token = _oauth_access_token(oauth_file)
        self.connect()

    def _post(
        self, payload: dict[str, Any], *, timeout: int = 180
    ) -> dict[str, Any]:
        headers = {
            "Authorization": f"Bearer {self._access_token}",
            "Accept": "application/json, text/event-stream",
            "Content-Type": "application/json",
        }
        if self._session_id:
            headers["Mcp-Session-Id"] = self._session_id
        response = requests.post(
            MCP_URL, headers=headers, json=payload, timeout=timeout
        )
        if response.status_code == 401:
            self._access_token = _oauth_access_token(self._oauth_file)
            headers["Authorization"] = f"Bearer {self._access_token}"
            response = requests.post(
                MCP_URL, headers=headers, json=payload, timeout=timeout
            )
        session_id = response.headers.get("mcp-session-id")
        if session_id:
            self._session_id = session_id
        if str(payload.get("method") or "").startswith("notifications/"):
            if response.status_code >= 400:
                _decode_mcp_response(response)
            return {"ok": True}
        return _decode_mcp_response(response)

    def connect(self) -> None:
        self._request_id += 1
        response = self._post(
            {
                "jsonrpc": "2.0",
                "id": self._request_id,
                "method": "initialize",
                "params": {
                    "protocolVersion": "2025-06-18",
                    "capabilities": {},
                    "clientInfo": {
                        "name": "promarkia-video-squad",
                        "version": "1.0.0",
                    },
                },
            }
        )
        if response.get("error"):
            raise HiggsfieldMcpError(
                f"Higgsfield MCP initialize failed: {response['error']}"
            )
        self._post(
            {
                "jsonrpc": "2.0",
                "method": "notifications/initialized",
                "params": {},
            }
        )

    def call(
        self, tool_name: str, arguments: dict[str, Any], *, timeout: int = 180
    ) -> dict[str, Any]:
        self._request_id += 1
        response = self._post(
            {
                "jsonrpc": "2.0",
                "id": self._request_id,
                "method": "tools/call",
                "params": {"name": tool_name, "arguments": arguments},
            },
            timeout=timeout,
        )
        if response.get("error"):
            raise HiggsfieldMcpError(
                f"{tool_name} failed: {json.dumps(response['error'])}"
            )
        result = response.get("result") or {}
        if result.get("isError"):
            message = _text_content(result) or f"{tool_name} returned an error"
            raise HiggsfieldMcpError(message)
        return result


def _structured(result: dict[str, Any]) -> dict[str, Any]:
    value = result.get("structuredContent")
    return value if isinstance(value, dict) else {}


def _text_content(result: dict[str, Any]) -> str:
    lines = [
        str(item.get("text"))
        for item in result.get("content") or []
        if isinstance(item, dict) and item.get("type") == "text" and item.get("text")
    ]
    return "\n".join(lines)


def _result_payload(result: dict[str, Any]) -> dict[str, Any]:
    structured = _structured(result)
    if structured:
        return structured
    text = _text_content(result)
    try:
        parsed = json.loads(text)
        return parsed if isinstance(parsed, dict) else {"value": parsed}
    except Exception:
        return {"text": text}


def _cost_exact(result: dict[str, Any]) -> float:
    payload = _result_payload(result)
    cost = payload.get("cost") or {}
    if not isinstance(cost, dict) or "credits_exact" not in cost:
        notice = payload.get("notice")
        if notice:
            raise HiggsfieldMcpError(
                f"Cost preflight needs prompt adjustment: {json.dumps(notice)}"
            )
        raise HiggsfieldMcpError(
            f"Cost preflight returned no cost: {json.dumps(payload)[:800]}"
        )
    return float(cost["credits_exact"])


def _first_job(result: dict[str, Any]) -> dict[str, Any]:
    payload = _result_payload(result)
    jobs = payload.get("results") or []
    if not jobs or not isinstance(jobs, list):
        raise HiggsfieldMcpError(
            f"Generation returned no job: {json.dumps(payload)[:800]}"
        )
    job = jobs[0]
    if not isinstance(job, dict) or not job.get("id"):
        raise HiggsfieldMcpError("Generation returned an invalid job")
    return job


def _generate_video_literal(
    client: HiggsfieldMcpClient, params: dict[str, Any]
) -> tuple[dict[str, Any], str]:
    """Follow Higgsfield's literal-retry contract for heuristic preset notices."""

    working = dict(params)
    result = client.call("generate_video", {"params": working})
    payload = _result_payload(result)
    notice = payload.get("notice")
    declined = str(working.get("declined_preset_id") or "")
    if isinstance(notice, dict) and notice.get("type") == "preset_recommendation":
        retry = (notice.get("data") or {}).get("retry_literal_with") or {}
        declined = str(retry.get("declined_preset_id") or "")
        if not declined:
            raise HiggsfieldMcpError(
                f"Preset recommendation returned no literal retry id: {json.dumps(notice)}"
            )
        working["declined_preset_id"] = declined
        result = client.call("generate_video", {"params": working})
    return result, declined


def _job_status(client: HiggsfieldMcpClient, job_id: str) -> dict[str, Any]:
    return _result_payload(
        client.call("job_status", {"jobId": job_id, "sync": True}, timeout=60)
    )


def _job_state(payload: dict[str, Any]) -> str:
    if isinstance(payload.get("result"), dict):
        return str(payload["result"].get("status") or "").lower()
    if isinstance(payload.get("job"), dict):
        return str(payload["job"].get("status") or "").lower()
    if isinstance(payload.get("generation"), dict):
        return str(payload["generation"].get("status") or "").lower()
    return str(payload.get("status") or "").lower()


def _job_url(payload: dict[str, Any]) -> str | None:
    candidates: list[dict[str, Any]] = [payload]
    for key in ("result", "job", "generation"):
        if isinstance(payload.get(key), dict):
            candidates.append(payload[key])
    for candidate in candidates:
        results = candidate.get("results")
        if isinstance(results, dict):
            for key in ("rawUrl", "url", "minUrl"):
                if results.get(key):
                    return str(results[key])
        for key in ("rawUrl", "url", "output_url"):
            if candidate.get(key):
                return str(candidate[key])
    return None


def _manifest_path(explainer_id: str) -> Path:
    if not explainer_id or any(
        char not in "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_"
        for char in explainer_id
    ):
        raise HiggsfieldMcpError("Invalid explainer id")
    return DEFAULT_STATE_DIR / f"{explainer_id}.json"


def _load_manifest(explainer_id: str) -> dict[str, Any]:
    path = _manifest_path(explainer_id)
    if not path.is_file():
        raise HiggsfieldMcpError("Explainer preflight/job was not found")
    return json.loads(path.read_text(encoding="utf-8"))


def _save_manifest(manifest: dict[str, Any]) -> None:
    manifest["updated_at"] = int(time.time())
    _atomic_json_write(_manifest_path(str(manifest["explainer_id"])), manifest)


def _download_media(url: str, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = destination.with_suffix(destination.suffix + ".part")
    with requests.get(url, stream=True, timeout=(20, 180)) as response:
        if response.status_code >= 400:
            raise HiggsfieldMcpError(
                f"Caption source download failed with HTTP {response.status_code}"
            )
        with open(temporary, "wb") as handle:
            for chunk in response.iter_content(chunk_size=1024 * 1024):
                if chunk:
                    handle.write(chunk)
            handle.flush()
            os.fsync(handle.fileno())
    os.replace(temporary, destination)


def _apply_adaptive_captions(
    manifest: dict[str, Any], provider_url: str
) -> dict[str, Any]:
    """Render measured captions once, after free caption-less MCP assembly."""

    from adaptive_caption_renderer import probe_duration, render_adaptive_captions

    explainer_id = str(manifest["explainer_id"])
    base_path = DEFAULT_STATE_DIR / f"{explainer_id}-caption-source.mp4"
    final_path = DEFAULT_STATE_DIR / f"{explainer_id}-final.mp4"
    captioning = manifest.get("captioning") or {}
    if captioning.get("status") == "completed" and final_path.is_file():
        return captioning

    manifest["captioning"] = {
        "status": "rendering",
        "mode": "adaptive",
        "provider_url": provider_url,
    }
    manifest["state"] = "captioning"
    _save_manifest(manifest)
    try:
        if not base_path.is_file():
            _download_media(provider_url, base_path)
        ordered_jobs = sorted(
            manifest["jobs"]["blocks"], key=lambda value: int(value["index"])
        )
        audio_durations = [
            probe_duration(str(item["audio_url"])) for item in ordered_jobs
        ]
        temporary_output = final_path.with_suffix(".rendering.mp4")
        report = render_adaptive_captions(
            str(base_path),
            str(temporary_output),
            manifest["request"]["blocks"],
            audio_durations=audio_durations,
            font_key=str(manifest["request"].get("subtitles_font") or "anton"),
        )
        os.replace(temporary_output, final_path)
        public_url = (
            f"{PUBLIC_FILE_BASE}/higgsfield-explainers/{quote(final_path.name)}"
        )
        captioning = {
            "status": "completed",
            "mode": "adaptive",
            "all_cues_fit": bool(report["layout"]["all_cues_fit"]),
            "cue_count": int(report["cue_count"]),
            "safe_box": report["layout"]["safe_box"],
            "font_family": report["layout"]["font_family"],
            "audio_durations": audio_durations,
            "provider_url": provider_url,
            "final_url": public_url,
        }
        manifest["captioning"] = captioning
        manifest["provider_final_url"] = provider_url
        manifest["final_url"] = public_url
        manifest["state"] = "completed"
        _save_manifest(manifest)
        return captioning
    except Exception as exc:
        manifest["captioning"] = {
            "status": "failed",
            "mode": "adaptive",
            "provider_url": provider_url,
            "error": str(exc)[:500],
        }
        manifest["provider_final_url"] = provider_url
        manifest["state"] = "failed"
        manifest["failures"] = [
            {"kind": "adaptive_captions", "status": "failed"}
        ]
        _save_manifest(manifest)
        raise HiggsfieldMcpError("Adaptive caption rendering failed") from exc


def _normalized_blocks(blocks: Any) -> list[dict[str, str]]:
    if isinstance(blocks, str):
        blocks = json.loads(blocks)
    if not isinstance(blocks, list) or not 2 <= len(blocks) <= 180:
        raise HiggsfieldMcpError("blocks must contain between 2 and 180 items")
    normalized: list[dict[str, str]] = []
    for index, block in enumerate(blocks, 1):
        if not isinstance(block, dict):
            raise HiggsfieldMcpError(f"Block {index} must be an object")
        narration = str(block.get("narration") or "").strip()
        video_prompt = str(block.get("video_prompt") or "").strip()
        if not narration or not video_prompt:
            raise HiggsfieldMcpError(
                f"Block {index} requires narration and video_prompt"
            )
        normalized.append(
            {
                "index": index,
                "narration": narration,
                "video_prompt": video_prompt,
            }
        )
    return normalized


def mcp_health() -> dict[str, Any]:
    client = HiggsfieldMcpClient()
    workspaces = _result_payload(client.call("list_workspaces", {})).get(
        "workspaces"
    ) or []
    balance = _result_payload(client.call("balance", {}))
    presets = _result_payload(client.call("get_explainer_presets", {})).get(
        "items"
    ) or []
    return {
        "ok": bool(workspaces and presets and "credits" in balance),
        "workspace_count": len(workspaces),
        "workspaces": workspaces,
        "credits": balance.get("credits"),
        "plan": balance.get("subscription_plan_type"),
        "explainer_preset_count": len(presets),
        "mcp_url": MCP_URL,
    }


def _normalized_match_text(value: Any) -> str:
    return re.sub(r"[^a-z0-9]+", " ", str(value or "").lower()).strip()


def _is_placeholder_identifier(value: Any) -> bool:
    text = re.sub(r"[^a-z0-9]+", "", str(value or "").lower())
    return not text or text in _PLACEHOLDER_PARTS or "placeholder" in text


def _require_real_identifier(value: Any, field_name: str) -> str:
    text = str(value or "").strip()
    if _is_placeholder_identifier(text) or not _UUID_RE.fullmatch(text):
        raise HiggsfieldMcpError(
            f"{field_name} must be a real Higgsfield UUID returned by the live "
            "options tool; placeholders are not accepted"
        )
    return text


def _rank_option(
    item: dict[str, Any],
    query: str,
    *,
    fields: tuple[str, ...],
    aliases: str = "",
) -> float:
    term = _normalized_match_text(query)
    if not term:
        return 0.0
    candidate = _normalized_match_text(
        " ".join(str(item.get(field) or "") for field in fields) + " " + aliases
    )
    if not candidate:
        return 0.0
    query_tokens = set(term.split())
    candidate_tokens = set(candidate.split())
    overlap = len(query_tokens & candidate_tokens) / max(1, len(query_tokens))
    substring = 1.0 if term in candidate else 0.0
    sequence = difflib.SequenceMatcher(None, term, candidate).ratio()
    return round((overlap * 0.65) + (substring * 0.25) + (sequence * 0.10), 6)


def _rank_styles(
    presets: list[dict[str, Any]], query: str
) -> list[dict[str, Any]]:
    ranked = []
    for position, item in enumerate(presets):
        title = str(item.get("title") or "")
        score = _rank_option(
            item,
            query,
            fields=("title", "prompt"),
            aliases=_STYLE_ALIASES.get(title.lower(), ""),
        )
        preferred = 1 if title.lower() == _DEFAULT_STYLE_TITLE.lower() else 0
        ranked.append((score, preferred, -position, item))
    ranked.sort(key=lambda entry: (entry[0], entry[1], entry[2]), reverse=True)
    return [entry[3] for entry in ranked]


def _rank_voices(
    voices: list[dict[str, Any]], query: str
) -> list[dict[str, Any]]:
    ranked = []
    query_tokens = set(_normalized_match_text(query).split())
    for position, item in enumerate(voices):
        score = _rank_option(
            item,
            query,
            fields=("name", "gender", "voice_type"),
        )
        preferred = (
            1
            if str(item.get("name") or "").lower() == _DEFAULT_VOICE_NAME.lower()
            else 0
        )
        gender = str(item.get("gender") or "").lower()
        gender_matches = not ({"male", "female"} & query_tokens) or gender in query_tokens
        if preferred and gender_matches:
            score = round(score + 0.2, 6)
        ranked.append((score, preferred, -position, item))
    ranked.sort(key=lambda entry: (entry[0], entry[1], entry[2]), reverse=True)
    return [entry[3] for entry in ranked]


def _live_explainer_catalog(
    client: HiggsfieldMcpClient, voice_limit: int = 100
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    presets = _result_payload(client.call("get_explainer_presets", {})).get(
        "items"
    ) or []
    voices = _result_payload(
        client.call("list_voices", {"size": max(1, min(int(voice_limit), 100))})
    ).get("voices") or []
    return presets, voices


def explainer_options(
    style_query: str = "",
    voice_query: str = "",
    voice_limit: int = 100,
) -> dict[str, Any]:
    client = HiggsfieldMcpClient()
    presets, voices = _live_explainer_catalog(client, voice_limit)
    ranked_styles = _rank_styles(presets, style_query)
    ranked_voices = _rank_voices(voices, voice_query)
    if not ranked_styles or not ranked_voices:
        raise HiggsfieldMcpError(
            "Higgsfield returned no usable Explainer styles or narrator voices"
        )
    selected_style = ranked_styles[0]
    selected_voice = ranked_voices[0]
    return {
        "ok": True,
        "styles": ranked_styles,
        "voices": ranked_voices,
        "selected_style": selected_style,
        "selected_voice": selected_voice,
        "selection": {
            "style_query": style_query,
            "voice_query": voice_query,
            "fallback_used": not bool(style_query.strip() and voice_query.strip()),
            "instructions": (
                "Use selected_style.id, selected_voice.voice_id, and "
                "selected_voice.voice_type. Never invent or substitute IDs."
            ),
        },
        "selection_required": {
            "style": True,
            "voice": True,
            "duration": True,
            "aspect": True,
            "subtitles": True,
        },
        "caption_fonts": {
            "patrick": "legible handwritten",
            "caveat": "flowing cursive",
            "marker": "bold marker",
            "anton": "heavy condensed impact",
        },
        "caption_modes": {
            "adaptive": (
                "Promarkia-measured short phrases with automatic wrapping, "
                "font scaling, and safe-zone validation (recommended)"
            ),
            "provider": "Higgsfield MCP paper-label captions with fixed sizing",
        },
    }


def _resolve_style_media(
    client: HiggsfieldMcpClient,
    *,
    style_preset_id: str,
    style_media_id: str,
) -> tuple[str, dict[str, Any] | None]:
    if style_media_id:
        return _require_real_identifier(style_media_id, "style_media_id"), None
    if not style_preset_id:
        raise HiggsfieldMcpError(
            "A Higgsfield explainer preset id or existing style media/job id is required"
        )
    style_preset_id = _require_real_identifier(
        style_preset_id, "style_preset_id"
    )
    payload = _result_payload(
        client.call(
            "resolve_explainer_preset", {"preset_id": style_preset_id}
        )
    )
    media_id = payload.get("media_id")
    if not media_id and isinstance(payload.get("media"), dict):
        media_id = payload["media"].get("id")
    if not media_id:
        raise HiggsfieldMcpError(
            f"Preset resolution returned no media id: {json.dumps(payload)[:800]}"
        )
    return str(media_id), payload


def preflight_explainer(
    *,
    blocks: Any,
    voice_id: str = "",
    voice_type: str = "",
    aspect: str,
    style_preset_id: str = "",
    style_media_id: str = "",
    style_query: str = "",
    voice_query: str = "",
    selection_delegated: bool = False,
    subtitles_font: str = "",
    subtitles_mode: str = "adaptive",
) -> dict[str, Any]:
    normalized = _normalized_blocks(blocks)
    if aspect not in {"9:16", "16:9"}:
        raise HiggsfieldMcpError("aspect must be 9:16 or 16:9")
    if subtitles_font and subtitles_font not in {
        "patrick",
        "caveat",
        "marker",
        "anton",
    }:
        raise HiggsfieldMcpError("Invalid subtitle font")
    if subtitles_mode not in {"adaptive", "provider"}:
        raise HiggsfieldMcpError("subtitles_mode must be adaptive or provider")

    client = HiggsfieldMcpClient()
    presets, voices = _live_explainer_catalog(client)
    ranked_styles = _rank_styles(presets, style_query)
    ranked_voices = _rank_voices(voices, voice_query)
    if selection_delegated:
        if not style_media_id and (
            _is_placeholder_identifier(style_preset_id)
            or not _UUID_RE.fullmatch(str(style_preset_id or "").strip())
        ):
            if not ranked_styles:
                raise HiggsfieldMcpError(
                    "Automatic style selection found no live presets"
                )
            style_preset_id = str(ranked_styles[0].get("id") or "")
        if (
            _is_placeholder_identifier(voice_id)
            or not _UUID_RE.fullmatch(str(voice_id or "").strip())
        ):
            if not ranked_voices:
                raise HiggsfieldMcpError(
                    "Automatic narrator selection found no live voices"
                )
            selected_voice = ranked_voices[0]
            voice_id = str(selected_voice.get("voice_id") or "")
            voice_type = str(selected_voice.get("voice_type") or "")

    voice_id = _require_real_identifier(voice_id, "voice_id")
    if voice_type not in {"preset", "element"}:
        raise HiggsfieldMcpError(
            "voice_type must match the live narrator voice"
        )
    live_voice = next(
        (
            item
            for item in voices
            if str(item.get("voice_id") or "") == voice_id
            and str(item.get("voice_type") or "") == voice_type
        ),
        None,
    )
    if not live_voice:
        raise HiggsfieldMcpError(
            "voice_id and voice_type do not match a live Higgsfield narrator"
        )
    if style_preset_id and not style_media_id:
        style_preset_id = _require_real_identifier(
            style_preset_id, "style_preset_id"
        )
        if not any(
            str(item.get("id") or "") == style_preset_id for item in presets
        ):
            raise HiggsfieldMcpError(
                "style_preset_id does not match a live Higgsfield preset"
            )

    media_id, preset = _resolve_style_media(
        client,
        style_preset_id=style_preset_id,
        style_media_id=style_media_id,
    )
    video_costs: list[float] = []
    audio_costs: list[float] = []
    for block in normalized:
        video_result, declined_preset_id = _generate_video_literal(
            client,
            {
                "model": "gemini_omni",
                "prompt": block["video_prompt"],
                "duration": 10,
                "resolution": "720p",
                "medias": [{"value": media_id, "role": "image"}],
                "get_cost": True,
            },
        )
        block["declined_preset_id"] = declined_preset_id
        video_costs.append(_cost_exact(video_result))
        audio_result = client.call(
            "generate_audio",
            {
                "params": {
                    "model": "seed_audio",
                    "prompt": block["narration"],
                    "voice_type": voice_type,
                    "voice_id": voice_id,
                    "get_cost": True,
                }
            },
        )
        audio_costs.append(_cost_exact(audio_result))

    subtitle_cost = (
        0.05 * len(normalized)
        if subtitles_font and subtitles_mode == "provider"
        else 0.0
    )
    total = round(sum(video_costs) + sum(audio_costs) + subtitle_cost, 4)
    request = {
        "blocks": normalized,
        "voice_id": voice_id,
        "voice_type": voice_type,
        "aspect": aspect,
        "style_preset_id": style_preset_id,
        "style_media_id": media_id,
        "selected_style": next(
            (
                item
                for item in presets
                if str(item.get("id") or "") == style_preset_id
            ),
            None,
        ),
        "selected_voice": live_voice,
        "selection_delegated": bool(selection_delegated),
        "subtitles_font": subtitles_font,
        "subtitles_mode": subtitles_mode,
    }
    digest = hashlib.sha256(
        json.dumps(request, sort_keys=True, ensure_ascii=False).encode("utf-8")
    ).hexdigest()[:16]
    explainer_id = f"hfx-{int(time.time())}-{digest}"
    manifest = {
        "version": 1,
        "explainer_id": explainer_id,
        "state": "preflighted",
        "created_at": int(time.time()),
        "request": request,
        "preset_resolution": preset,
        "cost": {
            "video_credits": round(sum(video_costs), 4),
            "audio_credits": round(sum(audio_costs), 4),
            "subtitle_credits": round(subtitle_cost, 4),
            "assembly_credits": 0.0,
            "total_credits_exact": total,
            "per_block": [
                {
                    "index": index,
                    "video": video_costs[index - 1],
                    "audio": audio_costs[index - 1],
                }
                for index in range(1, len(normalized) + 1)
            ],
        },
        "jobs": {"blocks": [], "assembly": None},
    }
    _save_manifest(manifest)
    return {
        "ok": True,
        "explainer_id": explainer_id,
        "state": "preflighted",
        "duration_seconds": len(normalized) * 10,
        "cost": manifest["cost"],
        "no_jobs_submitted": True,
        "next_step": "Call start_higgsfield_explainer with this explainer_id and an explicit max_credits at least equal to total_credits_exact.",
    }


def start_explainer(
    *,
    explainer_id: str,
    max_credits: float,
    batch_size: int = 3,
) -> dict[str, Any]:
    manifest = _load_manifest(explainer_id)
    if manifest.get("state") not in {
        "preflighted",
        "submitted",
        "rendering",
        "rate_limited",
    }:
        return explainer_status(explainer_id=explainer_id, wait_seconds=0)
    estimated = float(manifest["cost"]["total_credits_exact"])
    if float(max_credits) + 1e-9 < estimated:
        raise HiggsfieldMcpError(
            f"max_credits {max_credits} is below preflight {estimated}"
        )
    batch_size = max(1, min(int(batch_size), 8))
    client = HiggsfieldMcpClient()
    balance = _result_payload(client.call("balance", {}))
    credits = float(balance.get("credits") or 0)
    manifest["authorization"] = {
        "max_credits": float(max_credits),
        "balance_before_first_submission": (
            (manifest.get("authorization") or {}).get(
                "balance_before_first_submission", credits
            )
        ),
        "batch_size": batch_size,
    }
    _save_manifest(manifest)

    request = manifest["request"]
    existing = {
        int(item["index"]): item for item in manifest["jobs"].get("blocks") or []
    }
    cost_by_index = {
        int(item["index"]): item for item in manifest["cost"].get("per_block") or []
    }
    remaining_estimated = 0.0
    for block in request["blocks"]:
        index = int(block["index"])
        saved = existing.get(index) or {}
        block_cost = cost_by_index.get(index) or {}
        if not saved.get("video_job_id"):
            remaining_estimated += float(block_cost.get("video") or 0)
        if not saved.get("audio_job_id"):
            remaining_estimated += float(block_cost.get("audio") or 0)
    remaining_estimated = round(remaining_estimated, 4)
    if credits + 1e-9 < remaining_estimated:
        raise HiggsfieldMcpError(
            "Insufficient Higgsfield credits to resume: "
            f"{credits} available, {remaining_estimated} remaining"
        )
    pending_blocks = [
        block
        for block in request["blocks"]
        if int(block["index"]) not in existing
        or not existing[int(block["index"])].get("video_job_id")
        or not existing[int(block["index"])].get("audio_job_id")
    ]
    # Submit only one bounded batch per call. The provider enforces a live
    # concurrency ceiling, so walking every batch in one call can successfully
    # charge several blocks and then return a misleading terminal 429.
    pending_blocks = pending_blocks[:batch_size]
    submitted_now: list[int] = []
    try:
        for block in pending_blocks:
            index = int(block["index"])
            item = existing.get(index) or {
                "index": index,
                "video_job_id": None,
                "audio_job_id": None,
                "video_status": "not_submitted",
                "audio_status": "not_submitted",
            }
            submitted_any = False
            if not item.get("video_job_id"):
                video_result, declined_preset_id = _generate_video_literal(
                    client,
                    {
                        "model": "gemini_omni",
                        "prompt": block["video_prompt"],
                        "duration": 10,
                        "resolution": "720p",
                        "medias": [
                            {
                                "value": request["style_media_id"],
                                "role": "image",
                            }
                        ],
                        **(
                            {"declined_preset_id": block["declined_preset_id"]}
                            if block.get("declined_preset_id")
                            else {}
                        ),
                    },
                )
                video = _first_job(video_result)
                if declined_preset_id:
                    block["declined_preset_id"] = declined_preset_id
                item["video_job_id"] = video["id"]
                item["video_status"] = str(video.get("status") or "submitted")
                submitted_any = True
                # Persist immediately so a crash never causes duplicate video spend.
                existing[index] = item
                manifest["jobs"]["blocks"] = [
                    existing[key] for key in sorted(existing)
                ]
                manifest["state"] = "submitted"
                _save_manifest(manifest)

            if not item.get("audio_job_id"):
                audio = _first_job(
                    client.call(
                        "generate_audio",
                        {
                            "params": {
                                "model": "seed_audio",
                                "prompt": block["narration"],
                                "voice_type": request["voice_type"],
                                "voice_id": request["voice_id"],
                            }
                        },
                    )
                )
                item["audio_job_id"] = audio["id"]
                item["audio_status"] = str(audio.get("status") or "submitted")
                submitted_any = True

            existing[index] = item
            manifest["jobs"]["blocks"] = [
                existing[key] for key in sorted(existing)
            ]
            manifest["state"] = "rendering"
            _save_manifest(manifest)
            if submitted_any:
                submitted_now.append(index)
    except HiggsfieldMcpError as exc:
        if "429" not in str(exc) and "rate_limit" not in str(exc).lower():
            raise
        retry_at = int(time.time()) + RATE_LIMIT_RETRY_SECONDS
        manifest["jobs"]["blocks"] = [
            existing[key] for key in sorted(existing)
        ]
        manifest["state"] = "rate_limited"
        manifest["last_provider_error"] = {
            "type": "rate_limit",
            "message": str(exc),
            "retry_at": retry_at,
        }
        _save_manifest(manifest)
        return {
            "ok": True,
            "explainer_id": explainer_id,
            "state": "rate_limited",
            "resumable": True,
            "preflight_credits": estimated,
            "remaining_preflight_credits": remaining_estimated,
            "balance_before_submission": credits,
            "submitted_blocks": submitted_now,
            "block_jobs": manifest["jobs"]["blocks"],
            "retry_after_seconds": RATE_LIMIT_RETRY_SECONDS,
            "next_step": (
                "Call continue_higgsfield_explainer with this same explainer_id. "
                "It will poll saved jobs and submit the next bounded batch after "
                "the provider concurrency window clears."
            ),
        }

    return {
        "ok": True,
        "explainer_id": explainer_id,
        "state": manifest["state"],
        "preflight_credits": estimated,
        "remaining_preflight_credits": remaining_estimated,
        "balance_before_submission": credits,
        "submitted_blocks": submitted_now,
        "block_jobs": manifest["jobs"]["blocks"],
        "next_step": (
            "Call continue_higgsfield_explainer with this explainer_id. It polls "
            "saved jobs, submits the next bounded batch when capacity is "
            "available, and assembles automatically when all requested blocks "
            "are ready."
        ),
    }


def explainer_status(
    *,
    explainer_id: str,
    wait_seconds: int = 25,
    auto_assemble: bool = True,
) -> dict[str, Any]:
    manifest = _load_manifest(explainer_id)
    if manifest.get("state") == "preflighted":
        return {
            "ok": True,
            "explainer_id": explainer_id,
            "state": "preflighted",
            "cost": manifest["cost"],
            "next_step": "Call start_higgsfield_explainer.",
        }
    client = HiggsfieldMcpClient()
    deadline = time.monotonic() + max(0, min(int(wait_seconds), 90))
    blocks = manifest["jobs"].get("blocks") or []

    while True:
        any_pending = False
        failures: list[dict[str, Any]] = []
        for item in blocks:
            for kind in ("video", "audio"):
                job_id = item.get(f"{kind}_job_id")
                if not job_id:
                    item[f"{kind}_status"] = "not_submitted"
                    failures.append(
                        {"index": item["index"], "kind": kind, "status": "missing"}
                    )
                    continue
                current = str(item.get(f"{kind}_status") or "").lower()
                if current not in TERMINAL_STATUSES:
                    payload = _job_status(client, str(job_id))
                    current = _job_state(payload)
                    item[f"{kind}_status"] = current
                    url = _job_url(payload)
                    if url:
                        item[f"{kind}_url"] = url
                if current not in TERMINAL_STATUSES:
                    any_pending = True
                elif current != "completed":
                    failures.append(
                        {"index": item["index"], "kind": kind, "status": current}
                    )
        manifest["jobs"]["blocks"] = blocks
        _save_manifest(manifest)
        if failures or not any_pending or time.monotonic() >= deadline:
            break
        time.sleep(2)

    failures = [
        {"index": item["index"], "kind": kind, "status": item.get(f"{kind}_status")}
        for item in blocks
        for kind in ("video", "audio")
        if str(item.get(f"{kind}_status") or "").lower()
        in TERMINAL_STATUSES - {"completed"}
    ]
    if failures:
        manifest["state"] = "failed"
        manifest["failures"] = failures
        _save_manifest(manifest)
        return {
            "ok": False,
            "explainer_id": explainer_id,
            "state": "failed",
            "failures": failures,
            "block_jobs": blocks,
            "retry_policy": "Do not resubmit automatically. Correct only failed blocks after review.",
        }

    expected_indexes = {
        int(item["index"]) for item in manifest["request"]["blocks"]
    }
    existing_indexes = {int(item["index"]) for item in blocks}
    submitted_jobs_pending = any(
        item.get(f"{kind}_job_id")
        and str(item.get(f"{kind}_status") or "").lower()
        not in TERMINAL_STATUSES
        for item in blocks
        for kind in ("video", "audio")
    )
    work_missing = (
        existing_indexes != expected_indexes
        or any(
            not item.get("video_job_id") or not item.get("audio_job_id")
            for item in blocks
        )
    )
    if work_missing and not submitted_jobs_pending:
        authorization = manifest.get("authorization") or {}
        authorized_max = authorization.get("max_credits")
        if authorized_max is None:
            manifest["state"] = "awaiting_resume_authorization"
            _save_manifest(manifest)
            return {
                "ok": False,
                "explainer_id": explainer_id,
                "state": "awaiting_resume_authorization",
                "cost": manifest["cost"],
                "block_jobs": blocks,
                "next_step": (
                    "Call start_higgsfield_explainer once with the original "
                    "explicit max_credits ceiling. Saved jobs will not be "
                    "resubmitted."
                ),
            }
        retry_at = int(
            ((manifest.get("last_provider_error") or {}).get("retry_at")) or 0
        )
        if retry_at > int(time.time()):
            manifest["state"] = "rate_limited"
            _save_manifest(manifest)
            return {
                "ok": True,
                "explainer_id": explainer_id,
                "state": "rate_limited",
                "resumable": True,
                "retry_after_seconds": retry_at - int(time.time()),
                "block_jobs": blocks,
                "cost": manifest["cost"],
                "next_step": (
                    "Call continue_higgsfield_explainer again with the same "
                    "explainer_id after the retry interval."
                ),
            }
        return start_explainer(
            explainer_id=explainer_id,
            max_credits=float(authorized_max),
            batch_size=int(authorization.get("batch_size") or 3),
        )

    blocks_complete = (
        existing_indexes == expected_indexes
        and bool(blocks)
        and all(
        item.get("video_status") == "completed"
        and item.get("audio_status") == "completed"
        for item in blocks
        )
    )
    assembly = manifest["jobs"].get("assembly")
    if blocks_complete and auto_assemble and not assembly:
        aspect = manifest["request"]["aspect"]
        params: dict[str, Any] = {
            "width": 720 if aspect == "9:16" else 1280,
            "height": 1280 if aspect == "9:16" else 720,
            "items": [
                {
                    "video": item["video_job_id"],
                    "audio": item["audio_job_id"],
                }
                for item in sorted(blocks, key=lambda value: int(value["index"]))
            ],
        }
        font = manifest["request"].get("subtitles_font")
        caption_mode = manifest["request"].get("subtitles_mode") or "provider"
        if font and caption_mode == "provider":
            params["subtitles"] = {"font": font}
        assembly_job = _first_job(
            client.call("explainer_video", {"params": params}, timeout=300)
        )
        assembly = {
            "job_id": assembly_job["id"],
            "status": str(assembly_job.get("status") or "submitted").lower(),
        }
        manifest["jobs"]["assembly"] = assembly
        manifest["state"] = "assembling"
        _save_manifest(manifest)

    if assembly:
        current = str(assembly.get("status") or "").lower()
        if current not in TERMINAL_STATUSES:
            payload = _job_status(client, str(assembly["job_id"]))
            current = _job_state(payload)
            assembly["status"] = current
            url = _job_url(payload)
            if url:
                assembly["url"] = url
            manifest["jobs"]["assembly"] = assembly
        if current == "completed" and assembly.get("url"):
            font = manifest["request"].get("subtitles_font")
            caption_mode = manifest["request"].get("subtitles_mode") or "provider"
            if font and caption_mode == "adaptive":
                _apply_adaptive_captions(manifest, str(assembly["url"]))
            else:
                manifest["state"] = "completed"
                manifest["final_url"] = assembly["url"]
        elif current in TERMINAL_STATUSES:
            manifest["state"] = "failed"
            manifest["failures"] = [
                {"kind": "assembly", "status": current}
            ]
        else:
            manifest["state"] = "assembling"
        _save_manifest(manifest)

    result = {
        "ok": manifest.get("state") != "failed",
        "explainer_id": explainer_id,
        "state": manifest.get("state"),
        "duration_seconds": len(manifest["request"]["blocks"]) * 10,
        "block_jobs": manifest["jobs"]["blocks"],
        "assembly": manifest["jobs"].get("assembly"),
        "final_url": manifest.get("final_url"),
        "cost": manifest["cost"],
    }
    if manifest.get("state") in {
        "rendering",
        "assembling",
        "submitted",
        "rate_limited",
    }:
        result["next_step"] = (
            "Call continue_higgsfield_explainer again with the same explainer_id. "
            "Never call start again."
        )
    return result


def safe_call(function, *args, **kwargs) -> str:
    try:
        return json.dumps(
            function(*args, **kwargs), ensure_ascii=False, separators=(",", ":")
        )
    except Exception as exc:
        return json.dumps(
            {
                "ok": False,
                "error": f"{type(exc).__name__}: {exc}",
            },
            ensure_ascii=False,
        )
