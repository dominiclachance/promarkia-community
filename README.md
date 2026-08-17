# Promarkia Community

Turn a company URL and campaign goal into a complete, editable campaign package on your own
computer. Promarkia Community is free, MIT-licensed and approval-first: version 0.1 generates
drafts and receipts but cannot publish them publicly.

![Promarkia Community campaign demo](docs/assets/demo.gif)

## Install

- **Windows/macOS:** download the latest desktop release from
  `github.com/dominiclachance/promarkia-community/releases`.
- **Docker:** run `docker compose up --build`.
- **Python:** follow the five-minute start below.

Desktop artifacts are built and smoke-tested on their native operating systems. Preview builds
are unsigned until Agentix Labs code-signing and Apple notarization certificates are configured.

## What it creates

- company research and open questions
- positioning and message hierarchy
- landing-page copy
- four-email sequence
- eight social drafts
- six ad concepts
- 14-day content calendar
- QA report and hash-verifiable receipt

## Five-minute start

Requires Python 3.11+.

```bash
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.lock
pip install --no-deps -e .
promarkia serve
```

Open <http://127.0.0.1:8788>. The default `mock` provider is offline and deterministic, so
the interface works without an API key. It still fetches the public company page; use the
automated tests if you are offline.

## Use your own model provider

Copy `.env.example` to `.env`, then set:

```dotenv
PROMARKIA_PROVIDER=openai-compatible
PROMARKIA_BASE_URL=https://api.openai.com/v1
PROMARKIA_MODEL=gpt-4.1-mini
PROMARKIA_API_KEY=your-key-here
```

The key is read from the process environment. It is not written to SQLite, artifacts, receipts
or application responses. Any endpoint implementing the common `/chat/completions` contract
can be used.

### Ollama and fully local models

Install Ollama, pull a model, and start Promarkia with the native keyless provider:

```bash
ollama pull llama3.1:8b
PROMARKIA_PROVIDER=ollama PROMARKIA_MODEL=llama3.1:8b promarkia serve
```

On Windows PowerShell, set the variables first with `$env:PROMARKIA_PROVIDER="ollama"` and
`$env:PROMARKIA_MODEL="llama3.1:8b"`. The Ollama provider only accepts loopback endpoints and
defaults to `http://127.0.0.1:11434`. LM Studio, vLLM and LocalAI remain available through the
OpenAI-compatible provider.

## Docker

```bash
docker compose up --build
```

The published port binds to `127.0.0.1` by default and generated files persist in the named
`promarkia-data` volume.

## CLI

```bash
promarkia create https://example.com "Launch the new service" \
  --audience "Operations leaders" --offer "Free assessment"
promarkia list
promarkia show CAMPAIGN_ID
```

## Local data

SQLite and generated campaigns are stored in `./data` by default. Delete that directory to
remove your local history. Never commit `.env` or `data/`.

## Security model

- local-only network binding by default
- HTTP(S)-only company research with private/reserved-network rejection
- DNS validation on every redirect, bounded redirects, response size and timeout
- no shell execution, public posting, managed OAuth or multi-user access
- UUID-derived artifact paths and a fixed artifact allowlist
- provider keys remain environment-only

See [SECURITY.md](SECURITY.md) for limitations and reporting instructions.

For a guided walkthrough, see [Build Your First Local Campaign](docs/TUTORIAL.md).

## Community versus Promarkia Cloud

Community is the free local campaign workspace. Promarkia Cloud adds managed hosting,
maintenance, backups, integrations and scheduling for people who do not want to operate the
software themselves. Generated content quality and provider usage remain bounded by the model
and API account you choose locally.
