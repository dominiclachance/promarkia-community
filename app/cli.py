from __future__ import annotations

import argparse
import json

import uvicorn

from .api import create_app
from .config import Settings
from .db import Database
from .models import CampaignCreate
from .providers import create_provider
from .services.artifacts import ArtifactStore
from .services.campaigns import CampaignService


def build_service(settings: Settings) -> CampaignService:
    settings.ensure_directories()
    database = Database(settings.database_path)
    database.initialize()
    return CampaignService(
        settings=settings,
        database=database,
        artifacts=ArtifactStore(settings.campaigns_dir),
        provider=create_provider(settings),
    )


def main() -> None:
    parser = argparse.ArgumentParser(prog="promarkia", description="Promarkia Community Edition")
    subparsers = parser.add_subparsers(dest="command", required=True)
    subparsers.add_parser("serve", help="Start the local WebUI and API")
    create_parser = subparsers.add_parser("create", help="Run one campaign synchronously")
    create_parser.add_argument("company_url")
    create_parser.add_argument("goal")
    create_parser.add_argument("--audience", default="")
    create_parser.add_argument("--offer", default="")
    subparsers.add_parser("list", help="List local campaigns")
    show_parser = subparsers.add_parser("show", help="Show one local campaign")
    show_parser.add_argument("campaign_id")
    args = parser.parse_args()
    settings = Settings.from_env()

    if args.command == "serve":
        if not settings.binds_loopback_only and not settings.unsafe_allow_network_bind:
            raise SystemExit(
                "Refusing a non-loopback bind. Promarkia Community has no network "
                "authentication. Use the loopback-only Docker Compose configuration, "
                "or set PROMARKIA_UNSAFE_ALLOW_NETWORK_BIND=1 only after adding a "
                "trusted authenticated reverse proxy."
            )
        uvicorn.run(create_app(settings), host=settings.host, port=settings.port)
        return

    service = build_service(settings)
    if args.command == "create":
        request = CampaignCreate(
            company_url=args.company_url,
            goal=args.goal,
            audience=args.audience,
            offer=args.offer,
        )
        campaign = service.create(request)
        service.run(campaign["id"])
        print(json.dumps(service.database.get_campaign(campaign["id"]), indent=2))
    elif args.command == "list":
        print(json.dumps(service.database.list_campaigns(), indent=2))
    elif args.command == "show":
        campaign = service.database.get_campaign(args.campaign_id)
        if not campaign:
            raise SystemExit("Campaign not found")
        campaign["artifacts"] = service.artifacts.list(args.campaign_id)
        print(json.dumps(campaign, indent=2))
