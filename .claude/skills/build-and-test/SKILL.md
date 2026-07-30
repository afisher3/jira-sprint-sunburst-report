---
name: build-and-test
description: Build the Lambda bundle with esbuild and run the full vitest suite for jira-sprint-sunburst-report, including the sandbox workaround this machine needs for vitest's native Rollup binary. Use after any src/ change, before reporting a change complete.
---

# Build and test

Run these two steps after any `src/` change in this repo:

1. `npm run build` — bundles via `esbuild.config.mjs` into `dist/{cli,discover-fields,lambda-handler}.js`. Must exit clean (no esbuild errors) before considering a change complete.
2. `npx vitest run` — **must** be called with `dangerouslyDisableSandbox: true`. On this machine, sandboxed vitest fails with `ERR_DLOPEN_FAILED` (a macOS code-signing restriction on the native Rollup binary) — that failure is not a real test regression, just re-run with the sandbox disabled rather than debugging it as a code issue.

Report actual pass/fail counts (currently 51 tests across 6 files) rather than a bare "tests pass" — a changed count (e.g. 50/51, or 5 files instead of 6) is itself a signal something broke or a fixture went stale, and is easy to miss if you don't state the numbers.

If `tsconfig.json`'s exclusion of `test/` from type-checking means `tsc --noEmit` won't catch drift between `ReportModel`/domain interfaces and `test/*.ts` fixtures — if you change a shared interface (e.g. `ThroughputIssueKeys`, `ReportModel`), check whether existing fixtures still compile/pass rather than assuming a green `npm run build` covers it.
