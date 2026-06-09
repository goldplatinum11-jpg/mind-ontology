# Architecture

## Two-line repo layout #architecture #layers

Three repos: public `core/` (the open-source engine), private `cloud/` (the
managed service with billing and admin), and `docs/` (the public site). Cloud
depends on Core; Core never depends on Cloud, and `docs/` is publish-on-merge.

## Tenancy and data #architecture #data

Each customer is one Workspace — an isolated tenant — in Cloud. Customer data
lives only in Cloud's managed store. Core ships no customer data and runs fully
self-hosted on the operator's own infrastructure.
