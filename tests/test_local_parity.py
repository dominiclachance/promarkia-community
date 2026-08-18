import ast
import json
from pathlib import Path

import pytest
from fastapi import HTTPException
from sqlmodel import Session, SQLModel, create_engine, select

from promarkia_local.approval_guard import ApprovalRequired, require_approval
from promarkia_local.catalog import SQUADS
from promarkia_local.models import LocalApproval, LocalMcpServer, LocalProfile, LocalSecret
from promarkia_local.router import _validated_provider_target
from promarkia_local.runtime import MUTATING_TOOLS, prepare_team_config
from promarkia_local.vault import LocalVault
from scripts.sanitize_team_export import SOURCE_SECRET_ASSIGNMENT, SOURCE_SERPER_HEADER


class FakeDb:
    def __init__(self):
        self.engine = create_engine("sqlite://", connect_args={"check_same_thread": False})
        SQLModel.metadata.create_all(self.engine)


def test_provider_target_validation_blocks_unsafe_network_targets(monkeypatch):
    def resolve(hostname, _port, **_kwargs):
        addresses = {
            "api.openai.com": "104.18.7.192",
            "localhost": "127.0.0.1",
            "metadata.test": "169.254.169.254",
            "model.lan": "192.168.1.25",
        }
        return [(2, 1, 6, "", (addresses[hostname], 0))]

    monkeypatch.setattr("promarkia_local.router.socket.getaddrinfo", resolve)

    assert _validated_provider_target("openai", "https://api.openai.com/v1/models").startswith("https://")
    assert _validated_provider_target("ollama", "http://localhost:11434/api/tags").startswith("http://")
    assert _validated_provider_target("openai-compatible", "https://model.lan/v1/models").startswith("https://")
    with pytest.raises(HTTPException, match="OpenAI must use"):
        _validated_provider_target("openai", "https://example.com/v1/models")
    with pytest.raises(HTTPException, match="loopback"):
        _validated_provider_target("ollama", "http://model.lan:11434/api/tags")
    with pytest.raises(HTTPException, match="prohibited"):
        _validated_provider_target("openai-compatible", "http://metadata.test/latest/meta-data")


def test_full_catalog_contains_general_chat_and_fifteen_squads():
    assert len(SQUADS) == 16
    assert {row["id"] for row in SQUADS} == {1, 9, 10, 11, 12, 16, 17, 18, 19, 20, 21, 37, 38, 39, 40, 41}


def test_every_exported_mutation_tool_is_classified():
    data = json.loads((Path(__file__).parents[1] / "apps/api/promarkia_local/squads.json").read_text(encoding="utf-8"))
    external_prefixes = ("send_", "publish_", "post_", "add_post_", "create_google_", "create_outlook_", "create_notion_", "submit_")
    discovered = set()

    def walk(value):
        if isinstance(value, dict):
            config = value.get("config")
            if isinstance(config, dict) and isinstance(config.get("name"), str):
                if config["name"].startswith(external_prefixes):
                    discovered.add(config["name"])
            for child in value.values():
                walk(child)
        elif isinstance(value, list):
            for child in value:
                walk(child)

    walk(data)
    assert discovered <= set(MUTATING_TOOLS)


def test_exported_squad_code_contains_no_literal_provider_credentials():
    data = json.loads((Path(__file__).parents[1] / "apps/api/promarkia_local/squads.json").read_text(encoding="utf-8"))

    def walk(value):
        if isinstance(value, dict):
            for child in value.values():
                yield from walk(child)
        elif isinstance(value, list):
            for child in value:
                yield from walk(child)
        elif isinstance(value, str):
            yield value

    for value in walk(data):
        assert SOURCE_SECRET_ASSIGNMENT.search(value) is None
        assert SOURCE_SERPER_HEADER.search(value) is None


def test_runtime_switches_models_to_ollama_and_injects_guard():
    db = FakeDb()
    with Session(db.engine) as session:
        session.add(LocalProfile(preferences={
            "model_provider": "ollama", "model": "qwen2.5:7b-instruct",
            "base_url": "http://127.0.0.1:11434/v1",
        }))
        session.commit()
    config = {
        "provider": "autogen_agentchat.agents.AssistantAgent",
        "config": {
            "model_client": {
                "provider": "autogen_ext.models.openai.OpenAIChatCompletionClient",
                "config": {"model": "cloud", "organization": "cloud-org"},
            },
            "tools": [{
                "provider": "autogen_core.tools.FunctionTool",
                "config": {"name": "send_x_post", "source_code": "def send_x_post(text: str):\n    return text\n"},
            }],
        },
    }
    prepared = prepare_team_config(config, db)
    model = prepared["config"]["model_client"]["config"]
    source = prepared["config"]["tools"][0]["config"]["source_code"]
    assert model["model"] == "qwen2.5:7b-instruct"
    assert model["base_url"] == "http://127.0.0.1:11434/v1"
    assert model["organization"] is None
    assert "_promarkia_require_approval" in source


def test_approval_is_one_time_and_fails_closed(monkeypatch):
    from autogenstudio.web import deps

    db = FakeDb()
    monkeypatch.setattr(deps, "_db_manager", db)
    with pytest.raises(ApprovalRequired, match="pending approval"):
        require_approval("send_x_post", "x", {"text": "hello"})
    with Session(db.engine) as session:
        row = session.exec(select(LocalApproval)).one()
        assert row.status == "pending"
        assert "hello" in json.dumps(row.preview)
        row.status = "approved"
        session.add(row)
        session.commit()
    require_approval("send_x_post", "x", {"text": "hello"})
    with Session(db.engine) as session:
        assert session.exec(select(LocalApproval)).one().status == "executed"
    with pytest.raises(ApprovalRequired, match="pending approval"):
        require_approval("send_x_post", "x", {"text": "hello"})


def test_all_exported_tools_compile_after_cross_platform_localization(monkeypatch, tmp_path):
    monkeypatch.setenv("AUTOGENSTUDIO_APPDIR", str(tmp_path))
    db = FakeDb()
    with Session(db.engine) as session:
        session.add(LocalProfile(preferences={"model_provider": "ollama"}))
        session.commit()
    squads = json.loads(
        (Path(__file__).parents[1] / "apps/api/promarkia_local/squads.json").read_text(
            encoding="utf-8"
        )
    )
    sources = []

    def walk(value):
        if isinstance(value, dict):
            config = value.get("config")
            if isinstance(config, dict) and isinstance(config.get("source_code"), str):
                sources.append(config["source_code"])
            for child in value.values():
                walk(child)
        elif isinstance(value, list):
            for child in value:
                walk(child)

    for squad in squads:
        walk(prepare_team_config(squad["component"], db))
    assert len(sources) >= 100
    localized_transcript_tools = 0
    for source in sources:
        ast.parse(source)
        assert "/home/ubuntu" not in source
        assert "apis.promarkia.com" not in source
        assert "wisdomprompt-70290" not in source
        assert "from moviepy" not in source
        if "get_ffmpeg_exe" in source:
            localized_transcript_tools += 1
    assert localized_transcript_tools == 1


def test_enabled_mcp_server_is_injected_into_every_agent(monkeypatch, tmp_path):
    monkeypatch.setenv("AUTOGENSTUDIO_APPDIR", str(tmp_path))
    db = FakeDb()
    vault = LocalVault(tmp_path)
    with Session(db.engine) as session:
        session.add(LocalProfile(preferences={"model_provider": "ollama"}))
        session.add(LocalSecret(
            name="mcp.demo.Authorization", encrypted_value=vault.encrypt("Bearer local")
        ))
        session.add(LocalMcpServer(
            name="demo", transport="streamable-http", url="http://127.0.0.1:9999/mcp",
            env_secret_names=["mcp.demo.Authorization"],
        ))
        session.commit()
    component = {
        "component_type": "agent",
        "provider": "autogen_agentchat.agents.AssistantAgent",
        "config": {"name": "assistant", "workbench": []},
    }
    prepared = prepare_team_config(component, db)
    workbench = prepared["config"]["workbench"][0]
    assert workbench["provider"] == "autogen_ext.tools.mcp.McpWorkbench"
    assert workbench["config"]["server_params"]["headers"] == {
        "Authorization": "Bearer local"
    }
