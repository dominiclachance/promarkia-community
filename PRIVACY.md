# Privacy and data flow

Promarkia Community has no Promarkia account, billing, Firebase, Firestore, advertising tracker, or Promarkia-operated telemetry.

## Stored locally

The configured local data directory contains the SQLite databases, conversation and run history, schedules, usage estimates, artifacts, uploaded/generated files, owner profile, and the encrypted credential vault. Secrets are encrypted at rest with a key generated on the same device. Anyone who controls both the data directory and the operating-system account can access the workspace; Community is a single-owner application, not a multi-user security boundary.

Desktop defaults are `%LOCALAPPDATA%\PromarkiaCommunity` on Windows, `~/Library/Application Support/PromarkiaCommunity` on macOS, and `${XDG_DATA_HOME:-~/.local/share}/PromarkiaCommunity` on Linux. Docker uses the `promarkia-data` volume. `PROMARKIA_DATA_DIR` overrides the location.

## Data sent to providers

Prompts, conversation context, files, and tool arguments are sent only to providers needed for the action you request:

- Ollama on loopback keeps model requests on that Ollama instance.
- OpenAI or an OpenAI-compatible remote endpoint receives model prompts under its own terms.
- Connected integration and MCP providers receive the data required for their tool calls.
- Publishing providers receive the approved post, email, document, media, or event payload.

The application does not conceal these third-party data flows. Review each provider's retention, training, regional-processing, and permission policies before using confidential information.

## External actions

Supported send/publish/create actions require a local approval. The approval queue stores a redacted preview and fingerprint; stored secrets are not included in the preview. An approval permits one identical execution and is then consumed.

## Deletion

Individual conversations, artifacts, integrations, MCP servers, approvals, and schedules can be managed from the application where controls are available. To erase the entire workspace, stop Promarkia, back up anything you need, and delete the configured data directory or Docker volume.
