# Agent Roles

## Frontend worker #agent #worker #frontend

Implements storefront UI and checkout lanes. Calls `get_context(task)` at each
step and `list_constraints()` before risky writes.

## Backend worker #agent #worker #backend

Implements billing and data-platform lanes. Same two-tool discipline; stays inside
the lane's allowed write scope.

## Team controller #agent #controller

Plans lanes across the storefront, billing, and data projects, reviews results
against the constraints, and approves continuation only on no valid terminal stop.
