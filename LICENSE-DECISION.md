# License Decision — DECIDED: Apache-2.0

**Status:** DECIDED. Mind Ontology is licensed under **Apache License 2.0**.

The OSS license is no longer open: the operator selected **Apache-2.0** on
2026-06-09. The full license text ships in [`LICENSE`](LICENSE); attribution and
trademark scope are in [`NOTICE`](NOTICE).

---

## What is settled

| Item | Value |
|---|---|
| OSS license | **Apache-2.0** |
| `LICENSE` file present | **Yes** (canonical Apache-2.0 text) |
| `NOTICE` file present | **Yes** (copyright + trademark scope) |
| `package.json` `license` field | `Apache-2.0` (SPDX id) |
| Decision date | 2026-06-09 |
| Decision owner | Operator (SirtuinX) |

## Why Apache-2.0

Per [`docs/mind-ontology-license-boundary.md`](docs/mind-ontology-license-boundary.md):
Apache-2.0 is the right default for an MCP tool meant to be embedded into many
AI-agent workflows and commercial codebases — it is permissive *and* carries an
explicit patent grant, which MIT does not. The trust/adoption goal outweighs
copyleft leverage, so AGPL/GPL was not chosen.

## What is still gated (separate from the license)

Choosing the license does **not** mean the package is published. Distribution
remains deliberately gated:

- The package is prepared as `0.1.0` with the `files` allowlist applied and the
  `private` flag removed — publish-ready, but **unpublished**.
- No public remote, no push, no `npm publish` without the explicit operator
  publish decision.

Publishing is a later, separate operator decision (create the public GitHub
repository, add its URL to `package.json`, then approve the publish) tracked in
[`RELEASE-CHECKLIST.md`](RELEASE-CHECKLIST.md) and
[`docs/packaging.md`](docs/packaging.md). The Apache-2.0 grant applies to the
source as licensed; actual distribution is its own step.

## Trademark note

The Apache-2.0 grant covers code and docs only. It does **not** grant rights to
the "Mind Ontology" / "SIRT" names or marks, the hosted SIRT service, or private
deployments. See [`NOTICE`](NOTICE).
