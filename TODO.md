# TODO — memory-mcp

Open work for this repo. Landed changes are described in [`CHANGELOG.md`](CHANGELOG.md); this file
holds only what is still outstanding.

## Open

- [ ] **🟡 Decide which lockfile is authoritative — `bun.lock` or the root `package-lock.json`.**
  Both are committed for the same root package. Dependabot maintains the npm one (PR #165 was titled
  *"across 5 directories"*), while CI installs from `bun.lock`.

  **Current state is consistent, not broken.** `bc341764` updated both, and `package-lock.json`
  matches `package.json` field-by-field. A divergence would also be **loud rather than silent**:
  `bun install --frozen-lockfile` fails when `package.json` moves without `bun.lock`, which is
  exactly what turned `main` red on 2026-08-25. The gate does catch it.

  The problem is that `bun.lock` only moved because it was regenerated **by hand** on the PR branch.
  Nothing automates that, so every future Dependabot PR needs the same manual step or it goes red.

  The `tools/*` `package-lock.json` files are legitimate — separate npm mini-packages with no
  `bun.lock`. **Only the root one is the duplicate.**

  **Recommended:** delete the root `package-lock.json`, making `bun.lock` the single source of truth
  and stopping Dependabot from maintaining a file nothing installs from. Needs a decision on whether
  root dependencies are bun-managed or npm-managed, so it is not a drive-by fix.

- [ ] **Confirm the nightly `schedule` on `typescript.yml` actually fires.** Added 2026-08-28 at
  07:00 UTC to cover auto-merged Dependabot commits, which GitHub's recursion guard leaves with no
  `on: push` run. The trigger is in place but has not yet had a scheduled run — verify one lands
  before treating that gap as closed.

## Five-axis assessment — 2026-08-28

Per the workspace standing mandate, recorded so a later reader can see what was looked at and what
was deliberately left.

| Axis | Assessed | Left |
|---|---|---|
| Speed | not touched this pass | — |
| Stability | CI matrix (ubuntu/windows × Node 22/24) green on `main` | — |
| Reliability | **fixed** — `main` could carry an auto-merged commit with no CI run at all; nightly `schedule` + `workflow_dispatch` added | `bc341764` itself stays ungauged; it predates the dispatch trigger and cannot be backfilled |
| Security | **fixed** — `typescript.yml` now pins `permissions: contents: read` rather than inheriting the repo default (`read` today, but a repo-level setting that can widen silently). Advisory audit clean via temp-generated lock | — |
| Maintainability | **found** — two lockfiles for one root package; see the open item above | not fixed: needs the bun-vs-npm decision |
