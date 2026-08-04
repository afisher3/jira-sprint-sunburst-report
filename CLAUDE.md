# CLAUDE.md

Guidance for Claude Code in this repo. This file is kept under ~180 lines on purpose (Claude Code loads it in full every session — shorter files get followed more reliably). It covers what isn't obvious from reading the code: past production incidents, rejected designs, and dead-but-present config. For everything else — directory layout, full config example, tech stack, exact JQL per card, tickets-table UX — read `README.md`, which is the source of truth and won't drift from this file.

For a cheaper same-day refresher, read `CLAUDE.compact.md`. For two recurring workflows, use `.claude/skills/`: `build-and-test` and `add-filterable-stat-card` (the recipe behind every clickable stat card in the report).

## What this is

Lambda tool: pulls Jira Cloud sprint data → rolls story points up by a 2-level classification taxonomy → computes throughput/return-rate/stage/stale/rollover metrics → renders one self-contained HTML file (Plotly sunburst + tickets table) → uploads to S3. No server-side app beyond the Lambda invocation.

## Commands

```bash
npm install && npm run build && npm test    # build via esbuild, test via vitest
```
`src/cli.ts` is **dead and broken** — never extend it. To exercise the real code path locally, use `./scripts/run-report-locally.sh` (`.ps1`/`-windows.sh` for Windows) — wraps `sam local invoke`, writes `./out/report.html`/`.log`. Needs `aws login` (SSO) first; see README's "Running Locally" for prereqs/troubleshooting.

## Architecture essentials

Real entry point: `src/handlers/lambda-handler.ts` → loads OAuth creds from Secrets Manager + `config/config.local.yaml` → `ReportGenerator.generate()` (`src/app/report-generator.ts`, the sole orchestrator — put no flow logic elsewhere) → `HtmlReportRenderer.render()` (`src/report/html-report-renderer.ts`, the entire HTML/CSS/client-JS report as one template-literal string, largest file in the repo). Full directory tree: README's "Project Structure".

**Local vs. real Lambda — branch on `AWS_SAM_LOCAL`, never on config.** `sam local invoke` sets `AWS_SAM_LOCAL=true`. Both `ReportGenerator` (S3 upload vs. return HTML) and `LoggerFactory` (stdout vs. in-memory buffer) key off this env var. `config/config.local.yaml` is the exact file bundled into the real Lambda, so a config-driven switch here previously caused a real prod incident (S3 upload silently skipped, full HTML/logs dumped to the Lambda console). New local-only behavior must key off `process.env.AWS_SAM_LOCAL === 'true'`, not config.

**Lambda filesystem:** only `/tmp` is writable; `/var/task` is read-only. Local dev returns HTML as the Lambda response (`scripts/extract-report-response.mjs` captures it) rather than writing a file — `sam local invoke` containers are `--rm` and gone right after.

## Report Generation Flow

1. Discover all sprints → select window (see Domain Rules below) — issues are only ever fetched for the windowed sprints, never the full backlog.
2. Rolling 30-day stage summary (`stageSummaryDataset`): 8 parallel JQL queries scoped by the `filter = 11682` saved filter (see README for what that filter is and its own JQL) — project-independent-of-sprint-selection, computed once, unaffected by checkboxes. `fetchTotalCountLast30Days` chunks into three 10-day windows (one 30-day query was slow) de-duplicated via a `Set<string>` of keys.
3. Per windowed sprint (parallelized via `Promise.all`): fetch issues, aggregate sunburst, fetch throughput/return-rate/stale metrics.
4. Post-loop: rollover tickets (issue key appears in > 2 windowed sprints) computed from already-fetched `issuesBySprint` — no extra Jira calls.
5. Render, then upload to S3 (`Key: "metrics-report"`) unless `AWS_SAM_LOCAL==='true'`. Logs uploaded alongside as `metrics-report.log` in a `finally` block.

Exact JQL for every card: README's "Card Reference & Sample JQL".

## Ticket-table filtering model (easy to get backwards)

Every clickable stat card (`stat-card-clickable` + `data-throughput-key`, spanning Throughput/Return Rates/Sprint Details' stale+rollover) filters the tickets table by issue **key** returned from that card's JQL — **never** by an issue's current status, which is only ever a display column. (A status-based design was explicitly rejected: current status doesn't reflect "did this pass through this stage," which is what these cards measure.) Fully generic client-side (`getThroughputKeySet`/`updateIssuesTable`/click handler all key off `data-throughput-key`) — a new card needs zero new client-JS; see `add-filterable-stat-card` skill. Stale/Rollover counts must be **deduped** (`getThroughputKeySet(...).size`), unlike Throughput's sum-of-lengths display — a rollover ticket legitimately sits in multiple selected sprints' key lists.

Tickets table columns are all sortable (`data-sort-key`, client-side only); the panel collapses via one `#tickets-toggle` button whose label swaps between "Tickets - N" and "Table of issues" via two sibling spans with `#tickets-count-label` nested inside one — don't replace via `textContent`, that nested lookup must survive collapse state.

## Domain Rules (implement exactly)

- **Classification parsing**: Jira field is `level1 -> level2` (space-hyphen-greater-space). Null/blank → `Unclassified`/`Unspecified`. Split on `->`, trim; no level2 → `Unspecified`. Never hardcode classification values.
- **Sprint window**: all `active` + 3 most-recent `closed` (by `completeDate` desc, fallback `endDate`) + next 3 `future` (by `startDate` asc). Fetch sprint *metadata* for all sprints, but issues only for the windowed ~9.
- **Sunburst color matching** (actual vs. target charts): matched by **level1 label text** via a hardcoded `colorMap` in `html-report-renderer.ts` — not id or position (id formats differ between the two datasets: actual uses raw `"level1|level2"`, target uses sanitized alphanumerics). Keep `colorMap` in sync with real classification/config level1 names. Past bug: the lookup was `dataset.label` (doesn't exist, should be `dataset.labels[i]`) — silently always missed the map and fell back to positional colors that only looked right by coincidence. Check this first if actual/target colors ever mismatch.
- **Status-name config is exact-string, case-sensitive JQL text.** A wrong-case value (e.g. `"Ready for Dev"` vs. live `"ready for dev"`) silently returns 0, not an error. Check `config/config.local.yaml` against live Jira status names before assuming a code bug.
- **Stale** (14+ days no status change, excludes Resolved/Closed) is a per-sprint JQL query. **Rollover** (> 2 sprints) has no JQL — derived cross-sprint in `report-generator.ts`, see Flow step 4. Both thresholds are hardcoded constants, matching the 30-day window also being hardcoded.
- **Dead config fields** (loaded/validated but not actually read by the report flow): `jira.lastStatusOfDev` (`fetchDevThroughput`'s JQL is fully hardcoded) and `jira.projectKey` (the rolling 30-day queries are scoped only by `filter = 11682`, not `project = X`, as of a recent manual edit).

## Jira Integration

OAuth 2.0 client-credentials (`JiraClient.ensureAuth()`) — `clientId`/`clientSecret`/`baseUrl` come from Secrets Manager (`getJiraKeys()` in `lambda-handler.ts`), **never** YAML. Search via `/rest/api/3/search/jql` (`JiraClient.searchJql`) — the old `/rest/api/3/search` is gone from Jira Cloud; paginate on `nextPageToken`, not `startAt`; no reliable total count, accumulate returned issues. Sprints via Agile API (`startAt`/`maxResults`, `isLast`). Custom field IDs (`customfield_xxxxx`) are resolved once via `GET /rest/api/3/field` (`src/discover-fields.ts`), not assumed fixed across Jira instances.

## Configuration

`config/config.yaml` (template) and `config/config.local.yaml` — **the latter is bundled as-is into the real deployed Lambda**; any change ships to prod on next deploy. Field list/example: README's "Configuration" section. `output:` block is dead for the real Lambda path (`ReportGenerator` always uploads to S3 unless `AWS_SAM_LOCAL==='true'`) — only the unused `cli.ts` reads it; don't "fix" local/prod behavior there. `targetClassifications` percentages must sum to exactly 100 (`TargetSunburstGenerator` throws otherwise) and level1 names should match `colorMap` (see Domain Rules).

## Report Rendering & Client-Side

Single template-literal string, only external dep is the Plotly CDN script — this is intentional (portable S3 artifact). Every embedded data field must go through `ReportDataSerializer.toScriptSafeJson()` (escapes `<` so free-text Jira values can't break out of the `<script>` tag) — never call `JSON.stringify` directly in `html-report-renderer.ts`. Table rows use `createElement`/`textContent`, not `innerHTML`, except where a value is guaranteed numeric. `ReportModel` fields are consumed unconditionally by the serializer (e.g. `filterJqlByKey`) — a fixture missing a new required field crashes `render()` at runtime (`JSON.stringify(undefined).replace` throws), not just silently — always add new fields to `test/html-report-renderer.test.ts` fixtures, don't rely on `tsc` to catch it (excluded from type-checking, see Conventions). Tickets-table UX detail (sorting/collapse/filtering): README's "Tickets Table" section.

Each clickable card's JQL, shown live under the tickets table's "filtered by X" subtitle (`filterJqlByKey` in `report-generator.ts`), is a **third** copy of the same literal query text — alongside the real query in `issue-repository.ts` and README's "Card Reference & Sample JQL." All three must be updated together; nothing enforces this.

## Logging

Pino, structured JSON, no `console.log`. Under `sam local invoke`: stdout as usual. In real Lambda: buffered in memory, uploaded as `metrics-report.log` in a `finally` block — printing full logs to the Lambda console was itself the production incident described above; don't reintroduce a stdout path for real-Lambda.

## Conventions

- `strict: true`, no new `any` in domain code — some pre-existing `any`/implicit-`any` in `issue-repository.ts` predates recent work, not something to clean up incidentally.
- Constructor injection everywhere; no module-level singletons except `LoggerFactory`.
- Pure functions for parsing/aggregation (no I/O), for unit testability.
- `tsconfig.json` excludes `test/` from type-checking — changing `ReportModel`/domain interfaces won't be caught by `tsc`; check `test/*.ts` fixtures manually.

## Testing

`npm test` / `npm run test:watch`. On this machine, sandboxed `vitest` fails with `ERR_DLOPEN_FAILED` (macOS code-signing on the native Rollup binary, not a real failure) — re-run with sandboxing disabled. Currently 51 tests / 6 files; state the actual numbers when reporting results, a changed count is itself a signal. Test fixtures use empty `Map()`s for `throughputIssueKeysBySprint`, so extending `ThroughputIssueKeys` doesn't require fixture changes unless you're testing that field's behavior.
