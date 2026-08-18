# Provenance and License Review — Full Local Workspace

Promarkia Community is intentionally derived from the Promarkia production product so the local edition can provide the same core squads and workflows. It is not a clean-room reimplementation.

## Included from the product

- the production React workspace, adapted to local APIs and local single-owner identity
- AutoGen Studio-based conversation/runtime code
- sanitized team definitions for General Chat and 15 specialized squads
- built-in tool source required by those squads

## Explicitly excluded

- production credentials and secret files
- customer data and production databases
- Firebase and Firestore
- Stripe, subscriptions, credits, and auto-recharge
- hosted multi-tenancy, managed identity, managed OAuth relay, cloud queues, and infrastructure automation

## Third-party material

The exact release environment generates:

- `requirements.lock`
- `sbom.cdx.json`
- `THIRD_PARTY_LICENSES/inventory.json`
- bundled license and notice texts
- `THIRD_PARTY_NOTICES.md`

Release verification fails if an inventoried component is missing from the SBOM or its declared license material is absent from the bundle.

## Review boundary

This is technical provenance and dependency-license evidence, not a legal opinion. Dominic has stated that separate trademark clearance and licensed-counsel approval are not launch requirements for this owner-controlled release. The final publication decision remains with the repository owner.
