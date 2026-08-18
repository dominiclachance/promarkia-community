# GitHub and Product Hunt launch campaign

## Positioning

Headline: **The full Promarkia AI marketing workspace, free and local.**

One-line pitch: Run General Chat and all 15 Promarkia squads on your computer with local history, artifacts, schedules, MCP, BYO integrations, image/video tools, and approval-first publishing—without billing or Firebase.

## Core demonstration

1. Start the desktop app with no Promarkia account.
2. Show all 16 experiences in the sidebar.
3. Configure Ollama and run a real General Chat conversation.
4. Route a task through a specialist squad and open its persisted history/artifact.
5. Add an MCP server and a BYO integration.
6. Ask for an external action, show the fail-closed approval request, approve once, and execute the identical action.
7. Create a recurring local task from Launchpad.
8. Contrast Community's local SQLite/vault/files with Cloud's managed operation.

## Launch assets

- README screenshot and 60-second demo of the full workspace
- all-squads, conversation, integrations/MCP, approval, scheduling, artifacts, and local-provider frames
- native installer and Docker quick starts
- exact Community-versus-Cloud table
- security model, privacy flow, SBOM, checksums, and known limitations

## Copy deck

GitHub CTA: `Prefer zero setup and managed integrations? Try Promarkia Cloud.`

Product Hunt tagline: `The complete Promarkia AI marketing workspace—free, local, and approval-first.`

Product Hunt description: `Run General Chat plus 15 specialist AI squads locally. Keep conversations, artifacts, schedules, keys, MCP servers, and connected workflows on your machine. Use Ollama or your own model provider, and require explicit approval before supported external publishing actions. Promarkia Cloud is the managed version for people who do not want to operate it.`

Founder opening: `We open-sourced the complete core Promarkia workspace, not a limited demo. The local edition includes every squad and the operating features needed to use them. Cloud charges for hosting, managed identity, OAuth, upgrades, backups, uptime, and support—not for unlocking the core product.`

## Launch gate

- exact release commit passes CI/security/license checks
- Windows installer and macOS DMG pass native smoke tests
- README and demo show the full product, not the retired campaign generator
- no production credentials, customer data, billing, Firebase, or Firestore
- external actions remain fail-closed behind approval
- known limitations are explicit

Do not ask for votes, buy engagement, or mass-message people. Recruit relevant testers and report actual installation and activation data.
