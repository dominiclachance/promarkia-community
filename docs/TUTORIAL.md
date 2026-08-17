# Tutorial: Build Your First Local Campaign

This walkthrough produces a private campaign package without a Promarkia account or public
publishing action.

## 1. Start Promarkia

Use the Windows/macOS desktop release, or run from source:

```bash
python -m venv .venv
pip install -r requirements.lock
pip install --no-deps -e .
promarkia serve
```

Open `http://127.0.0.1:8788`. The default mock provider is deterministic and requires no key.

## 2. Create the campaign

Enter:

- Company website: a public HTTP(S) company page
- Campaign goal: one specific business outcome
- Audience: the buyer or user segment
- Offer: the action you want the audience to take

Choose **Build campaign**. The local worker researches the public page and creates research,
positioning, landing-page copy, email, social, ad concepts, a content calendar, QA report, and
receipt.

## 3. Review before approval

Open every artifact and verify claims, names, links, offer details, compliance requirements, and
brand voice. The receipt records the provider, model, stage timestamps, hashes, and the fact that
nothing was published.

Choose **Approve drafts** only when the package is ready. Approval changes local state; it still
does not post anything publicly.

## 4. Use Ollama instead of the mock provider

```bash
ollama pull llama3.1:8b
```

macOS/Linux:

```bash
PROMARKIA_PROVIDER=ollama PROMARKIA_MODEL=llama3.1:8b promarkia serve
```

Windows PowerShell:

```powershell
$env:PROMARKIA_PROVIDER='ollama'
$env:PROMARKIA_MODEL='llama3.1:8b'
promarkia serve
```

Ollama stays on `127.0.0.1:11434` and requires no API key. For OpenAI, LM Studio, vLLM, or
LocalAI, use the OpenAI-compatible configuration in the README.

## 5. Find or remove local data

Source and Docker installs use `./data` unless `PROMARKIA_DATA_DIR` is set. Desktop releases use
the operating system's local application-data directory. Removing that directory permanently
removes local campaign history; back it up first if you need the artifacts.

