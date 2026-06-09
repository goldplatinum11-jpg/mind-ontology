# Decisions

## Adopt an open-core model #boundary #oss

Status: accepted
Date: 2026-01-20

Lumen Core ships under Apache-2.0; Lumen Cloud is the paid, hosted,
source-available line. Reason: build community trust on the open engine while
keeping a defensible commercial offering on top.

## Bill Lumen Cloud per active Workspace #hosted #billing

Status: accepted
Date: 2026-03-05

Lumen Cloud is priced per active Workspace, not per seat. Reason: it aligns price
with tenant value and keeps small teams cheap so they upgrade willingly.

## Gate every deploy and publish behind operator approval #safety #release

Status: accepted
Date: 2026-02-12

Releases, Cloud deploys, and docs-site publishes require an explicit human go.
Reason: a solo operator cannot absorb a silent bad public release, so the AI
always stops at the boundary.
