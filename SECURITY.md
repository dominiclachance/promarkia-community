# Security

## Supported version

Security updates currently target the latest `0.1.x` release.

## Report a vulnerability

Please do not open a public issue for a suspected vulnerability. Email `security@agentixlabs.com`
with reproduction steps, impact and affected version. Do not include real API keys or customer
data. We will acknowledge reports as quickly as practical.

## Important limitations

- The application is designed for one trusted user on one computer. It has no user accounts or
  authorization layer. Keep the default loopback bind. Host, Origin and Fetch Metadata guards
  intentionally reject public-network and cross-site browser access.
- Company-page retrieval blocks local/private/reserved destinations and rechecks redirects.
  DNS validation and connection are separate operating-system steps, so a security review is
  still required before exposing this fetcher to untrusted internet users.
- Generated model content is untrusted draft material. Review factual claims, links, regulatory
  requirements and brand suitability before use.
- API keys are environment-only, but any provider receives the campaign prompt and extracted
  website text. Review your provider's data handling terms.

The completed engineering review is in `docs/SECURITY_REVIEW.md`.
