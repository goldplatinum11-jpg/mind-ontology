# Mind Ontology — Autopilot Worker Self-Check v1

**Status:** Autopilot Pack v1 (A-series lane) · local-first · OSS-safe

Part of the [Autopilot Integration Pack](mind-ontology-autopilot-pack-v1.md).

The list a worker runs **before reporting a checkpoint** — the mirror of the
[controller checklist](mind-ontology-autopilot-controller-checklist-v1.md). It
exists so the worker catches its own scope and honesty failures before the
controller does, keeping the runway moving. Local and mechanical; no hosted call.

The governing value is **faithful reporting**: report what is true, including what
was skipped or what failed — never an optimistic closeout.

---

## Before writing the Result Pack

1. **Confirm in-scope.** Re-check that every edited path is inside the allowed
   write scope. If something landed out of scope, revert it before reporting; do
   not report a forbidden write as done.
2. **Every artifact has a guard.** Each new doc/template/fixture is paired with a
   guard test that asserts its key claims. If a guard is missing, add it before
   closeout — prose alone is not a finished ADL.
3. **Run the gates.** Run the focused tests you wrote, then the full suite and
   `npm run agentctx:validate`. Record the real result, pass or fail.
4. **List uncommitted changes truthfully.** The Result Pack's `added` / `modified`
   lists must match `git status` exactly — nothing hidden, nothing invented.
5. **Lockfile clean.** If an install touched `package-lock.json`, revert it
   (`git checkout -- package-lock.json`) so the diff stays in scope.

## When deciding whether to continue

6. **Apply the stop policy honestly.** Stop only on a *valid* terminal condition.
   "Tests passed", "docs updated", or "commit denied" are **not** stop conditions
   — continue to the next ADL.
7. **Report blockers, don't bury them.** If the same hard blocker recurs, say so;
   three repeats is a valid stop, and hiding it is not.

---

## Faithful reporting over optimistic closeout

- If a step was skipped, the Result Pack says so.
- If a gate failed, the Result Pack shows the failure, not a rounded-up "green".
- If a change is uncommitted (commits are the controller's job), the Result Pack
  lists it as uncommitted rather than implying it landed.

This is the worker-side discipline that makes the controller's mechanical review
trustworthy: the artifacts and the report agree, every time.
