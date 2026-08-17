# Privacy and data flow

Promarkia Community has no Promarkia account, hosted database, analytics, advertising tracker or
Promarkia-operated telemetry. Campaign records and generated artifacts are stored as plaintext in
the configured local data directory. Promarkia Community does not currently provide per-campaign
deletion in its UI or API. To remove stored data, stop the application and delete its configured
data directory. Source installs default to `./data`. Desktop installs default to
`%LOCALAPPDATA%\\PromarkiaCommunity\\data` on Windows,
`~/Library/Application Support/PromarkiaCommunity/data` on macOS, and
`${XDG_DATA_HOME:-~/.local/share}/PromarkiaCommunity/data` on Linux. Docker Compose stores data in
the named volume `promarkia-data`, removable with `docker compose down --volumes` after any export
or backup you want to keep.

Creating a campaign contacts the supplied company website from the machine running Promarkia. The
retrieved page text, campaign brief and generation instructions are then sent to the provider you
select. With the offline mock provider, nothing is sent to a model service. With Ollama on
loopback, model generation stays on that local Ollama instance. With a remote OpenAI-compatible
endpoint, the provider receives and may retain/process those inputs under its own privacy policy,
terms and regional processing rules. Review those terms before sending confidential information.

Provider API keys remain in the running process and are not written into campaign records or
artifacts. Promarkia Community does not publish generated content or connect to social accounts.
Approval means that the user accepted a generated draft for later use; it is not an automatic
publishing action.
