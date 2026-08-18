"""Per-run local provider selection and external-action protection."""

from __future__ import annotations

import ast
import copy
import os
import tempfile
from pathlib import Path
from typing import Any

from sqlmodel import Session, select

from .models import LocalIntegration, LocalMcpServer, LocalProfile, LocalSecret
from .vault import LocalVault


MUTATING_TOOLS = {
    "add_post_to_wordpress": "wordpress",
    "create_google_calendar_event": "google-calendar",
    "create_google_docs_from_markdown": "google-docs",
    "create_google_sheet_from_json": "google-sheets",
    "create_notion_page_with_content": "notion",
    "create_outlook_calendar_event": "outlook-calendar",
    "linkedin_upload_image_from_url": "linkedin",
    "log_pr_coverage": "external-storage",
    "post_reddit_comment": "reddit",
    "publish_linkedin_post_from_image_url": "linkedin",
    "save_backlink_prospects": "external-storage",
    "send_facebook_post": "facebook",
    "send_gmail_email": "gmail",
    "send_instagram_carousel": "instagram",
    "send_instagram_post": "instagram",
    "send_linkedin_post": "linkedin",
    "send_outlook_email": "outlook",
    "send_reddit_post": "reddit",
    "send_x_post": "x",
    "send_x_reply": "x",
    "submit_backlink_form": "website",
}


def _guard_source(source: str, function_name: str, provider: str) -> str:
    tree = ast.parse(source)
    target = next(
        (node for node in ast.walk(tree) if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.name == function_name),
        None,
    )
    if target is None:
        public_functions = [
            node for node in tree.body
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))
            and not node.name.startswith("_")
        ]
        if len(public_functions) != 1:
            raise ValueError(f"Mutation tool {function_name} has no unambiguous callable")
        target = public_functions[0]
    if any(
        isinstance(node, ast.ImportFrom) and node.module == "promarkia_local.approval_guard"
        for node in target.body
    ):
        return source
    guard_nodes = ast.parse(
        "from promarkia_local.approval_guard import require_approval as _promarkia_require_approval\n"
        f"_promarkia_require_approval({function_name!r}, {provider!r}, locals())\n"
    ).body
    insert_at = 1 if target.body and isinstance(target.body[0], ast.Expr) and isinstance(target.body[0].value, ast.Constant) and isinstance(target.body[0].value.value, str) else 0
    target.body[insert_at:insert_at] = guard_nodes
    ast.fix_missing_locations(tree)
    return ast.unparse(tree)


def _localize_tool_source(source: str) -> str:
    """Remove production/Linux-only paths from exported FunctionTool sources."""
    root = Path(os.getenv("AUTOGENSTUDIO_APPDIR", str(Path.home() / ".promarkia"))).resolve()
    user_files = root / "files" / "user"
    temp_root = Path(tempfile.gettempdir()) / "promarkia"
    user_files.mkdir(parents=True, exist_ok=True)
    temp_root.mkdir(parents=True, exist_ok=True)
    public_base = os.getenv(
        "PROMARKIA_PUBLIC_ASSET_BASE_URL", "http://127.0.0.1:8788/files/user"
    ).rstrip("/")
    replacements = {
        "import fcntl": "from promarkia_local.filelock_compat import fcntl",
        "/home/ubuntu/.autogenstudio/files/user": user_files.as_posix(),
        "/home/ubuntu/.autogenstudio": root.as_posix(),
        "/home/ubuntu": (root / "legacy-home").as_posix(),
        "https://apis.promarkia.com/api/files/user": public_base,
        "https://apis.promarkia.com/api/": public_base + "/",
        "/PROMARKIA_LOCAL_DATA/files/user": user_files.as_posix(),
        "/PROMARKIA_LOCAL_DATA": root.as_posix(),
        "PROMARKIA_LOCAL_ASSET_BASE": public_base,
        '"/tmp/': repr(temp_root.as_posix() + "/")[1:-1].join(('"', '')),
        "'/tmp/": repr(temp_root.as_posix() + "/")[1:-1].join(("'", "")),
    }
    for old, new in replacements.items():
        source = source.replace(old, new)
    # The exported transcript tool used MoviePy only to invoke ffmpeg. MoviePy
    # currently constrains Pillow below security-fixed releases, so use the
    # packaged imageio-ffmpeg binary directly instead.
    source = source.replace(
        "from moviepy import VideoFileClip",
        "import subprocess\nfrom imageio_ffmpeg import get_ffmpeg_exe",
    )
    source = source.replace(
        "with VideoFileClip(video_path) as video:\n"
        "            if video.audio is None:\n"
        "                return \"\"\n"
        "            video.audio.write_audiofile(audio_path)",
        "subprocess.run([get_ffmpeg_exe(), '-y', '-i', video_path, "
        "'-vn', '-codec:a', 'libmp3lame', audio_path], "
        "check=True, capture_output=True, timeout=600)",
    )
    return source


def _mcp_workbenches(db_manager) -> list[dict[str, Any]]:
    root = Path(os.getenv("AUTOGENSTUDIO_APPDIR", str(Path.home() / ".promarkia")))
    vault = LocalVault(root)
    workbenches: list[dict[str, Any]] = []
    with Session(db_manager.engine) as session:
        rows = session.exec(
            select(LocalMcpServer).where(LocalMcpServer.enabled == True)  # noqa: E712
        ).all()
        secrets = {
            row.name: vault.decrypt(row.encrypted_value)
            for row in session.exec(select(LocalSecret)).all()
        }
    for row in rows:
        prefix = f"mcp.{row.name}."
        values = {
            name[len(prefix):]: secrets[name]
            for name in row.env_secret_names or []
            if name.startswith(prefix) and name in secrets
        }
        if row.transport == "stdio":
            if not row.command:
                continue
            params: dict[str, Any] = {
                "command": row.command,
                "args": row.args or [],
                "env": values,
                "encoding": "utf-8",
                "encoding_error_handler": "strict",
                "type": "StdioServerParams",
                "read_timeout_seconds": 30,
            }
        else:
            if not row.url:
                continue
            params = {
                "type": "StreamableHttpServerParams",
                "url": row.url,
                "headers": values or None,
                "timeout": 30.0,
                "sse_read_timeout": 300.0,
                "terminate_on_close": True,
            }
        workbenches.append({
            "provider": "autogen_ext.tools.mcp.McpWorkbench",
            "component_type": "workbench",
            "version": 1,
            "component_version": 1,
            "description": f"Local MCP server: {row.name}",
            "label": row.name,
            "config": {"server_params": params, "tool_overrides": {}},
        })
    return workbenches


def _provider_preferences(db_manager) -> dict[str, Any]:
    with Session(db_manager.engine) as session:
        profile = session.get(LocalProfile, "local") or LocalProfile()
        prefs = profile.preferences or {}
    return {
        "provider": str(prefs.get("model_provider") or "openai").lower(),
        "model": str(prefs.get("model") or "").strip(),
        "base_url": str(prefs.get("base_url") or "").strip(),
    }


def _configure_model(component: dict[str, Any], prefs: dict[str, Any]) -> None:
    provider_path = str(component.get("provider") or "")
    if "OpenAIChatCompletionClient" not in provider_path:
        return
    config = component.setdefault("config", {})
    provider = prefs["provider"]
    model = prefs["model"]
    if provider == "ollama":
        model = model or "qwen2.5:7b-instruct"
        config.update({
            "model": model,
            "base_url": prefs["base_url"] or "http://127.0.0.1:11434/v1",
            "api_key": "ollama",
            "organization": None,
            "model_info": {
                "family": "unknown", "vision": False, "function_calling": True,
                "json_output": False, "structured_output": False,
            },
        })
        component["label"] = f"Ollama {model}"
    elif provider in {"openai-compatible", "compatible"}:
        if not prefs["base_url"]:
            raise ValueError("OpenAI-compatible provider requires a base URL")
        model = model or config.get("model") or "local-model"
        config.update({
            "model": model,
            "base_url": prefs["base_url"],
            "organization": None,
            "model_info": {
                "family": "unknown", "vision": False, "function_calling": True,
                "json_output": False, "structured_output": False,
            },
        })
        component["label"] = f"Compatible {model}"
    else:
        if model:
            config["model"] = model
        config.pop("api_key", None)
        config.pop("organization", None)


def prepare_team_config(team_config: Any, db_manager) -> Any:
    if not isinstance(team_config, dict):
        return team_config
    prepared = copy.deepcopy(team_config)
    prefs = _provider_preferences(db_manager)
    local_mcp = _mcp_workbenches(db_manager)

    def walk(value: Any) -> None:
        if isinstance(value, dict):
            _configure_model(value, prefs)
            config = value.get("config")
            if isinstance(config, dict):
                if value.get("component_type") == "agent" and local_mcp:
                    existing = config.setdefault("workbench", [])
                    if isinstance(existing, list):
                        labels = {str(item.get("label")) for item in existing if isinstance(item, dict)}
                        existing.extend(item for item in copy.deepcopy(local_mcp) if item["label"] not in labels)
                name = config.get("name")
                if isinstance(config.get("source_code"), str):
                    config["source_code"] = _localize_tool_source(config["source_code"])
                    if name in MUTATING_TOOLS:
                        config["source_code"] = _guard_source(
                            config["source_code"], name, MUTATING_TOOLS[name]
                        )
            for child in value.values():
                walk(child)
        elif isinstance(value, list):
            for child in value:
                walk(child)

    walk(prepared)
    return prepared


def append_local_connection_context(task: Any, db_manager) -> Any:
    """Expose configured account identifiers, never secrets, to squad prompts."""
    if not isinstance(task, str):
        return task
    with Session(db_manager.engine) as session:
        integrations = session.exec(select(LocalIntegration).where(LocalIntegration.enabled == True)).all()  # noqa: E712
        mcp_servers = session.exec(select(LocalMcpServer).where(LocalMcpServer.enabled == True)).all()  # noqa: E712
    if not integrations and not mcp_servers:
        return task
    lines = ["\n\nLOCAL WORKSPACE CONNECTIONS (identifiers only; credentials are injected securely):"]
    for row in integrations:
        safe_settings = {
            key: value for key, value in (row.settings or {}).items()
            if not any(marker in key.lower() for marker in ("secret", "token", "password", "key"))
        }
        lines.append(f"- Integration {row.provider}/{row.account_label}: {safe_settings}")
    for row in mcp_servers:
        lines.append(f"- MCP server {row.name}: transport={row.transport}")
    lines.append("All external write/publish/send actions require local human approval before execution.")
    return task + "\n".join(lines)
