# Tutorial: Run the Full Promarkia Workspace Locally

## 1. Start the workspace

Use the Windows/macOS desktop release, `docker compose up --build`, or the Python installation steps in the README. Open `http://127.0.0.1:8788`.

The sidebar should show General Chat plus 15 specialized squads. The footer identifies the workspace as local mode.

## 2. Configure a model

Open **API Keys**.

Promarkia never bundles provider credentials. Add only the services you use;
research and transportation tools can read `SERPER_API_KEY` and
`FMCSA_WEB_KEY` from the same encrypted local vault.

- For Ollama, use a tool-capable model such as `qwen2.5:7b-instruct` and `http://127.0.0.1:11434/v1` for a native install.
- For Docker-to-host Ollama, use `http://host.docker.internal:11434/v1`.
- For OpenAI, store `OPENAI_API_KEY` in the encrypted key panel.
- For another compatible server, choose **OpenAI-compatible endpoint** and provide its model, base URL, and required key.

Select **Test connection**, then **Save provider**.

## 3. Start a real squad conversation

Choose General Chat or any specialist squad. Conversations, agent messages, runs, and uploaded/generated files persist in the local data directory. The same multi-agent routing definitions used by the hosted core are bundled locally.

## 4. Add integrations

Open **Connect Integrations**. Add the provider name, a local account label, non-secret connection settings, and the secret values required by that provider. Credentials are encrypted locally and injected at run time.

Some squad tools use Composio connection IDs; others accept provider-specific API credentials. Community does not create managed OAuth connections, so establish the account/connection with the provider first and enter its identifiers locally.

## 5. Add MCP servers

Open **MCP Servers** and register either:

- a local stdio command with arguments and environment secrets, or
- a Streamable HTTP endpoint with secret headers.

Enabled MCP workbenches are injected into each assistant at run time.

## 6. Publish with approval

Ask a squad to send, publish, upload, or create an external resource. The first mutation attempt will stop and create an item under **Approvals**. Verify the redacted preview, approve it, and retry the same action. The approval is consumed after one matching execution.

Changing the payload or repeating the action requires a new approval. Reject requests you do not recognize.

## 7. Schedule work

Open **Scheduled Tasks**, choose a squad, enter the task, timezone, and recurrence, then save it. Local schedules run only while Promarkia is running. Publishing actions created by scheduled work still require approval when the schedule is configured that way.

## 8. Use Launchpad and artifacts

Launchpad provides starter workflows for campaigns, social content, email, SEO, ads, images, video, and lead generation. **My Artifacts** stores uploaded and generated files with hashes and local paths.

## 9. Set a local cost guard

In **API Keys**, enter your provider's input/output rates and configure the monthly warning threshold or hard cap. This is a local estimate based on recorded usage, not a provider invoice and not Promarkia credits.

## 10. Back up or erase the workspace

Stop Promarkia and copy the configured data directory to back it up. Delete that directory—or the Docker volume—to erase the complete local workspace after preserving anything you need.
