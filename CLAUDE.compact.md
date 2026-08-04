# CLAUDE.compact.md

Condensed refresher — read `CLAUDE.md` in full at least once; use this afterward to reorient cheaply. If this and `CLAUDE.md` disagree, `CLAUDE.md` wins.

**What this is:** Lambda pulls Jira Cloud sprint data → rolls story points by 2-level classification → computes throughput/return-rate/stage/stale/rollover metrics → renders one self-contained HTML file (Plotly sunburst + tickets table) → uploads to S3.

**Real entry point:** `src/handlers/lambda-handler.ts` → `ReportGenerator.generate()`. `src/cli.ts` is dead/broken — never extend it.

**Local dev:** `./scripts/run-report-locally.sh` (or `.ps1`/`-windows.sh`) — wraps `sam local invoke`, writes `./out/report.html` + `./out/report.log`. Needs `aws login` SSO first.

**Local vs. prod branch:** always `process.env.AWS_SAM_LOCAL === 'true'`, never config — `config/config.local.yaml` is bundled as-is into the real Lambda, so a config-driven switch previously caused a prod incident (S3 upload silently skipped).

**Ticket table filtering = by issue key, never by current status.** Every clickable card (`.stat-card-clickable` + `data-throughput-key`) — Throughput (`refinement`/`dev`/`qa`/`uatSignoff`), Return Rates (`qaReturn`/`uatReturn`), and Sprint Details (`stale`/`rollover`) alike — filters via `throughputIssueKeys[sprintId][key]`. Stale/Rollover display counts are deduped (`.size`), unlike Throughput's sum-of-lengths. Adding a new one: see `.claude/skills/add-filterable-stat-card`.

**Tickets panel:** all 5 columns sortable client-side (`data-sort-key`); whole panel collapses via one button (`#tickets-toggle`) whose label swaps between "Tickets - N" and "Table of issues" via two hidden/shown sibling spans — don't touch via `textContent`, `#tickets-count-label` lives nested inside one of those spans.

**Sunburst colors:** actual vs. target charts match by **level1 label text** via a hardcoded `colorMap` in `html-report-renderer.ts` — not by id or position (id formats differ between the two datasets). Keep `colorMap` in sync with real classification level1 names / `config.local.yaml`'s `targetClassifications`, which must sum to exactly 100.

**Report is one template-literal string** (`html-report-renderer.ts`) — HTML/CSS/client-JS, only external dep is the Plotly CDN script. All embedded data goes through `ReportDataSerializer.toScriptSafeJson()` (escapes `<` so free-text Jira values can't break out of the `<script>` tag) — never call `JSON.stringify` directly there.

**Status-name config values are exact-string, case-sensitive JQL text** — mismatches silently return 0, not an error. Check `config/config.local.yaml` against live Jira status names before assuming a code bug.

**Dead config, loaded but unused by the real flow:** `jira.lastStatusOfDev` (Dev Throughput's JQL is hardcoded) and `jira.projectKey` (the rolling 30-day queries are scoped only by `filter = 11682`, not `project = X`).

**Jira auth:** OAuth2 client-credentials, creds from Secrets Manager (never YAML). Search via `/rest/api/3/search/jql` with `nextPageToken` pagination (old `/search` endpoint is gone).

**Build/test:** see `.claude/skills/build-and-test` — `npm run build` then `npx vitest run` with `dangerouslyDisableSandbox: true` (native Rollup binary code-signing issue on this machine, not a real failure). Currently 51 tests / 6 files.
