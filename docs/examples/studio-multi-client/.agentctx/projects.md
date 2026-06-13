# Projects

## Acme retail assistant #project #active #client-acme

Name: acme-retail-assistant
Status: active

A product-search and returns assistant for Acme's storefront. Owns the
`clients/acme/` workspace only. Time-sensitive; this is the active priority.

## Northwind clinic scheduler #project #active #client-northwind

Name: northwind-clinic-scheduler
Status: active

A patient self-scheduling flow for Northwind clinics. Owns `clients/northwind/`.
Handles health-adjacent data, so its constraints are stricter than other
engagements.

## Globex trading copilot #project #active #client-globex

Name: globex-trading-copilot
Status: active

A research copilot for Globex analysts. Owns `clients/globex/`. Read-only
against market data; never places or simulates trades.

## Studio platform #project #active #studio-platform

Name: studio-platform
Status: active

Shared foundation used by every engagement: auth, logging, and the context
compiler wiring under `platform/`. Changes here ripple to all clients, so they
ship behind review.

## Vega logistics pilot #project #archived

Name: vega-logistics-pilot
Status: archived

A finished proof-of-concept for Vega. Kept for reference; do not extend it or
reuse its code in active engagements.
