# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Jira Sprint Sunburst Report — a Lambda-deployed tool that pulls sprint data from Jira Cloud, rolls story points up by a two-level classification taxonomy, computes delivery-flow metrics (throughput, return rates, rolling 30-day stage counts), and produces a single self-contained interactive HTML report (Plotly sunburst chart + filterable tickets table). The report is generated on a schedule, uploaded to S3, and viewed by opening that S3 object — there is no server-side app beyond the Lambda invocation itself.

## Commands

```bash
npm install                  # Install dependencies
npm run build                # Bundle with esbuild (see esbuild.config.mjs)
npm test                     # Run vitest test suite
npm run test:watch           # Vitest watch mode
```

### Running locally without deploying

`src/cli.ts` exists but is **not** the real entry point and is currently unused/broken — don't route new features through it. The actual way to exercise the real Lambda code path locally is `sam local invoke`, wrapped by helper scripts (they build, invoke, and split the response into a report + log file since a Lambda sandbox's `/var/task` is read-only and can't be written to directly):

```bash
./scripts/run-report-locally.sh              # Mac/Linux
./scripts/run-report-locally.ps1             # Windows PowerShell
./scripts/run-report-locally-windows.sh      # Windows Git Bash
```

Output: `./out/report.html` and `./out/report.log`. Full prerequisites (AWS CLI, SAM CLI, Docker/colima) and troubleshooting are in `README.md`'s "Running Locally" section — read that before debugging local-invoke issues.

Requires `aws login` (SSO session) beforehand; sessions expire quickly and errors surface as `LoginRefreshRequired`.

## Tech Stack

- **Language:** TypeScript (strict mode), Node.js 22+ LTS
- **HTTP:** Native `fetch` (thin wrapper in `JiraClient`, no heavyweight SDK)
- **Charting:** Plotly.js (client-side only, loaded in the generated HTML, never bundled into the Node/Lambda artifact)
- **Logging:** Pino (structured JSON logging, no `console.log` anywhere)
- **Config:** YAML files + Zod schema validation
- **Deployment:** AWS SAM (Lambda, scheduled trigger, S3 bucket, Secrets Manager)
- **Tests:** Vitest
- **Build:** esbuild (single bundled artifact for Lambda)

## Architecture

Layered, dependency-injected architecture. Constructors take collaborators for mockability.

```
src/
  cli.ts                        Unused/broken legacy entry point — do not extend
  handlers/
    lambda-handler.ts            Real entry point. Loads Jira OAuth creds + base URL from
                                  Secrets Manager, loads config/config.local.yaml via
                                  ConfigLoader, runs ReportGenerator, returns its result
                                  (string | void) as the Lambda response.
  app/
    report-generator.ts          Orchestrates the whole flow: discover sprints → select
                                  window → compute rolling 30-day stage summary → per-sprint
                                  issues/sunburst/metrics/throughput → build ReportModel →
                                  render → upload (or return HTML locally). See "Report
                                  Generation Flow" below.
  config/
    config-loader.ts             Reads/validates YAML, merges in secrets, builds AppConfig
    app-config.ts                Typed AppConfig interface
  logging/
    logger-factory.ts            init(level); child(component) → Logger; buffers logs in
                                  memory instead of stdout when not under sam local invoke
                                  (see "Logging" below)
  jira/
    jira-client.ts               OAuth 2.0 (client credentials) + HTTP, agileGet + searchJql
    sprint-repository.ts         discoverSprints(boardId); selectWindow(sprints, closed, future)
    issue-repository.ts          All Jira reads: per-sprint issues, JQL-based throughput/
                                  return-rate/stage-count queries (see below)
  domain/
    sprint.ts                    { id, name, state, startDate, endDate, completeDate }
    issue.ts                     { key, summary, status, storyPoints, classification }
    classification.ts / classification-parser.ts    Two-level cascading select parsing
    sunburst-aggregator.ts       aggregate(issues, showEmptyCategories) → SunburstDataset
    sunburst-dataset.ts          { ids[], labels[], parents[], values[] } (Plotly format)
    metric-dataset.ts            Per-sprint metrics: QA/UAT return counts, past-QA/UAT
                                  counts, throughput story points per stage
    stage-summary-dataset.ts     Rolling 30-day, project-scoped ticket counts by stage
                                  (NOT sprint-scoped, NOT affected by sprint checkboxes)
    throughput-issue-keys.ts     Issue keys backing each Throughput card, per sprint —
                                  used client-side to filter the tickets table by click
    target-sunburst-generator.ts Generates the "target distribution" sunburst from config
  report/
    report-model.ts               ReportModel — everything HtmlReportRenderer needs
    report-data-serializer.ts     Shapes ReportModel fields into script-safe JSON strings
                                  (see "XSS/script-injection safety" below)
    html-report-renderer.ts       Builds the entire HTML/CSS/client-JS report as one
                                  template-literal string. Largest file in the repo.
    output/                       Legacy OutputTarget/LocalFileOutput — NOT used by the
                                  real Lambda path (S3 upload is inline in ReportGenerator);
                                  kept only because cli.ts still references it.
config/
  schema.ts                      Zod schema — source of truth for what config fields exist
  config.yaml                    Base template (committed, no secrets)
  config.local.yaml              Deployed as-is into the real Lambda (see warning below)
scripts/
  run-report-locally*.sh/.ps1     Local-invoke helpers (build + sam local invoke + extract)
  extract-report-response.mjs    Parses sam local invoke's JSON response into report.html
test/
  *.test.ts                      Vitest suite
```

### Lambda-ready design
The tool is stateless and run-to-completion, deployed via AWS SAM. `handler()` in `src/handlers/lambda-handler.ts` is the sole real entry point — it fetches Jira OAuth credentials from Secrets Manager, loads `config/config.local.yaml`, and delegates everything else to `ReportGenerator.generate()`. Do not put orchestration logic anywhere except `ReportGenerator`.

### Local vs. real Lambda: `AWS_SAM_LOCAL`, not config
`sam local invoke` automatically sets `AWS_SAM_LOCAL=true` in the invoked environment. Both `ReportGenerator` (S3 upload vs. returning HTML) and `LoggerFactory` (stdout vs. in-memory buffering) branch on this env var — **never** on `config.output.type` or similar. This is deliberate and hard-won: `config/config.local.yaml` is the exact same file bundled into the real deployed Lambda, so any config-driven local/prod switch here previously caused a real production incident (S3 upload silently skipped, full HTML/logs dumped into the Lambda console instead). If you add a new local-only behavior, key it off `process.env.AWS_SAM_LOCAL === 'true'`, not config.

### Lambda filesystem constraints
Only `/tmp` is writable in a Lambda sandbox (real or `sam local invoke`) — `/var/task` (the deployment bundle, i.e. `process.cwd()`) is read-only. This is why local dev returns the rendered HTML as the Lambda response (captured by `scripts/extract-report-response.mjs`) rather than writing a file that could be `docker cp`'d out — containers from `sam local invoke` are ephemeral (`--rm`) and gone almost immediately after the invoke completes, so there's no window to copy files out anyway.

## Report Generation Flow (`ReportGenerator.doGenerate()`)

1. `SprintRepository.discoverSprints()` — fetch all sprint metadata on the board.
2. `SprintRepository.selectWindow()` — narrow to the display window (see "Sprint Window Selection" below). Issue-level data is only ever fetched for this window, never the full backlog.
3. **Rolling 30-day stage summary** (`stageSummaryDataset`, feeds "Sprint Summary by Stages"): 8 parallel JQL queries scoped to `config.jira.projectKey`, entirely independent of sprint selection/windowing — computed once, not per sprint, and not affected by the sprint checkboxes in the UI. `fetchTotalCountLast30Days` is chunked into three non-overlapping 10-day windows (a single 30-day query was slow/large on a busy project) and de-duplicated via a `Set<string>` of issue keys before taking `.size`.
4. Per windowed sprint (looped, each iteration parallelized internally via `Promise.all`):
   - `IssueRepository.fetchBySprint()` → full issue list for that sprint (used both for the sunburst and as the base set for the tickets table).
   - `SunburstAggregator.aggregate()` → per-sprint sunburst dataset.
   - Metrics: QA/UAT return counts, past-QA/past-UAT counts, and throughput per stage (refinement/dev/QA/UAT-signoff). The throughput queries return `{ totalStoryPoints, issueKeys }` — the `issueKeys` are stored separately (`throughputIssueKeysBySprint`) purely so the client-side tickets table can filter by "which issues actually passed through this stage," decoupled from an issue's *current* status.
5. Build `ReportModel` (includes `baseUrl` for constructing Jira issue links client-side) and render via `HtmlReportRenderer`.
6. Output: if `AWS_SAM_LOCAL==='true'`, return the HTML string directly; otherwise upload to S3 (`Key: "metrics-report"`). Logs are uploaded alongside as `metrics-report.log` in a `finally` block (so they're captured even on failure) unless running locally, where they've already gone to stdout.

### Ticket-table filtering model (important, easy to get backwards)
The tickets table shows the full per-sprint issue list for the selected sprints. Clicking a Throughput card filters that table down to the issue **keys** returned by that stage's JQL query — **not** by each issue's current status. An issue's current status is only ever displayed as a column value, never used as a filter predicate. (An earlier design that filtered by current status was explicitly rejected — current status doesn't reflect "did this issue pass through this stage at some point," which is what the throughput cards actually measure.)

## Domain Rules (Implement Exactly)

### Classification Parsing
Jira field `Custom field (Classification)` is a two-level cascading select exported as a single string with levels joined by ` -> ` (space-hyphen-greater-space), e.g. `App Dev -> New Feature`.

Parse rules:
1. If null/empty/whitespace → `{ level1: "Unclassified", level2: "Unspecified" }`
2. Otherwise split on `->`, trim each part
3. `level1 = parts[0]`; if second part exists, `level2 = parts.slice(1).join(" -> ").trim()`, else `level2 = "Unspecified"`

Do not hardcode classifications — use whatever appears in the live field.

### Story Points
Use the configured `storyPointsFieldId` custom field (resolve the actual ID via `GET /rest/api/3/field`; do not assume a fixed field ID across Jira instances). Issues with no story points count as 0.

### Sprint Window Selection
Given all sprints on the board, select:
- **All** sprints in state `active`
- **3 most recently closed** (state `closed`, ordered by `completeDate` desc, fallback to `endDate`)
- **Next 3 future** (state `future`, ordered by `startDate` asc)

**Cost control:** Only fetch sprint *metadata* for all sprints. Only fetch *issues* for the windowed sprints (~9 sprints). Never fetch issues for the entire backlog.

### Aggregation
Group windowed issues per sprint by `(level1, level2)`, sum story points, emit Plotly sunburst arrays:
- Two-level hierarchy: Level 1 nodes (parent = ""), Level 2 nodes (parent = Level 1 id)
- Use stable IDs (e.g. `L1` and `L1|L2`)
- Default: include only categories present in the sprint. Config flag `report.showEmptyCategories` (default false) controls whether to show empty branches.

### Status-name config is exact-string, case-sensitive JQL text
Every `*StatusName`/`lastStatusOf*` config value must match the exact Jira status string (JQL string matching inside `Status changed to "..."` is effectively what's being compared). A past real bug: `readyForDevStatusName: "Ready for Dev"` silently returned 0 because the actual Jira status was lowercase `"ready for dev"`. If a stage summary/throughput count looks wrong, check `config/config.local.yaml` against the live Jira workflow's exact status names before assuming a code bug — the report log (`./out/report.log` locally) includes the resolved JQL and counts.

## Jira Integration

### Authentication
OAuth 2.0 client-credentials flow (`JiraClient.ensureAuth()`), not basic auth/API token:
- `clientId`/`clientSecret` resolved from AWS Secrets Manager (`getJiraKeys()` in `src/handlers/lambda-handler.ts`), never from YAML
- `baseUrl` also comes from the same secret (`JIRA_BASE_URL`), not config — this is a common point of confusion since `config.yaml`/`config.local.yaml` don't actually carry `jira.baseUrl` despite it appearing in older docs/comments
- Token requests go to `auth.atlassian.com`; API calls are routed through `api.atlassian.com/ex/jira/{cloudId}/...` (cloud ID resolved once via `/oauth/token/accessible-resources`, matched against `baseUrl`)
- Fails loudly on 401/403 with a clear "check OAuth credentials" message

### Issue Search
The legacy `/rest/api/3/search` was **removed** from Jira Cloud. Use `/rest/api/3/search/jql` (`JiraClient.searchJql`):
- Pagination via opaque `nextPageToken` (not `startAt`) — loop until no `nextPageToken`
- No reliable total count — count by accumulating returned issues
- Request only needed fields

### Sprints (Agile API, `JiraClient.agileGet`)
- List: `GET /rest/agile/1.0/board/{boardId}/sprint?state=...` (paginated with `startAt`/`maxResults`, response has `isLast`)

### Custom Fields
Story points, classification, and QA/UAT fail-count fields are all `customfield_xxxxx`. Resolve once via `GET /rest/api/3/field` (see `src/discover-fields.ts`), then put IDs in config.

Keep `JiraClient` thin and mockable. Log endpoint + JQL at debug, retries/failures at warn/error.

## Configuration

```yaml
jira:
  boardId: 2
  storyPointsFieldId: customfield_10170
  classificationFieldId: customfield_10256
  qaFailCountFieldId: customfield_10223
  uatFailCountFieldId: customfield_10224
  lastStatusOfRefinement: "ready for dev"      # final status of the refinement stage
  lastStatusOfDev: "Ready for Testing"
  lastStatusOfQA: "Ready for UAT"
  lastStatusOfUAT: "Resolved"
  refinedStatusName: "Refined"                 # Sprint Summary by Stages card statuses
  readyForDevStatusName: "ready for dev"       # (must be exact-string match to live Jira)
  readyForTestingStatusName: "Ready for Testing"
  readyForUatStatusName: "Ready for UAT"
  resolvedStatusName: "Resolved"
  closedStatusName: "Closed"
  reopenedStatusName: "Reopened"
  projectKey: "ATHENA"                         # scopes the rolling 30-day queries
  authType: oauth
window:
  closed: 3
  future: 3
report:
  showEmptyCategories: false
  targetClassifications: [...]                 # optional target-distribution comparison
output:
  type: s3                                     # NOTE: unused by the real Lambda path, see below
  path: /tmp/report.html                       # only consulted by the unused cli.ts
logLevel: info
```

**`jira.baseUrl`, `clientId`, `clientSecret` are never in YAML** — resolved at runtime from the Secrets Manager secret named by `JIRA_SECRET_NAME` (env var), via `getJiraKeys()`. `BUCKET_NAME` (env var) names the S3 bucket the real Lambda uploads to.

**`output:` block is effectively dead for the real deployment path.** `ReportGenerator` always uploads to S3 unless `AWS_SAM_LOCAL==='true'`, in which case it returns HTML directly — regardless of what `output.type`/`output.path` say. It's only consulted by the currently-unused `cli.ts`. Don't "fix" a local/prod behavior by editing this block; see the `AWS_SAM_LOCAL` section above.

Config files:
- `config/config.yaml` — base defaults/template (committed)
- `config/config.local.yaml` — **this exact file is bundled into the real deployed Lambda** (committed, no secrets — see `package.json`'s `files` array). Any change here ships to production on next deploy.
- `config/schema.ts` — Zod schema; `ConfigLoader.load()` validates and fails loudly on bad config or missing secrets

## Report Rendering & Client-Side Behavior (`HtmlReportRenderer`)

The entire report — HTML, CSS, and client-side JS (Plotly sunburst rendering, sprint-checkbox aggregation, throughput-card click filtering) — is one self-contained template-literal string with no external file dependencies. This is intentional (single portable artifact uploaded to S3); a prior request to split the report's *data* into separate `.js` files was scoped down to "source-code organization only" (`ReportDataSerializer` as a separate module) with the actual HTML output remaining a single file.

### XSS / script-injection safety
Every piece of ReportModel data embedded into the report's `<script>` tag goes through `ReportDataSerializer`'s private `toScriptSafeJson()` (`JSON.stringify(value).replace(/</g, '\\u003c')`). `JSON.stringify` does not escape `<`, so free text sourced from Jira (issue summaries, sprint names) could otherwise contain a literal `</script>` that breaks out of the tag. **Any new data embedded into the report must go through this same helper** — do not call `JSON.stringify` directly in `html-report-renderer.ts`.

Client-side, table rows are built via `createElement`/`textContent`, not `innerHTML` string concatenation, for the same reason — except where the interpolated value is guaranteed numeric (e.g. the throughput card's "count (points) pts" subtext), where `innerHTML` is used deliberately for the subtext `<span>`.

### Client-side data flow
`sprints`/`datasets`/`metricDatasets`/`stageSummaryDataset`/`issuesBySprint`/`throughputIssueKeys`/`jiraBaseUrl` are all embedded as JS constants in the inline `<script>`. Sprint checkboxes drive `aggregateDatasets()` → `renderSunburst()`; the same checkbox change also calls `updateIssuesTable()`, which recomputes the active throughput filter (if any) against `issuesBySprint` using `throughputIssueKeys`. Issue links use `buildJiraIssueUrl(issueKey)` → `${jiraBaseUrl}/browse/${issueKey}`.

## Logging

Pino, structured JSON, no `console.log` anywhere. Behavior is environment-dependent (see `LoggerFactory.init()`):
- Under `sam local invoke` (`AWS_SAM_LOCAL==='true'`): logs go to stdout as usual (streamed live by the local-invoke scripts into `./out/report.log`).
- In a real deployed Lambda: logs are buffered in memory (never written to stdout/CloudWatch) and uploaded to S3 as `metrics-report.log` by `ReportGenerator` in a `finally` block, so they're captured on both success and failure. This exists because printing full report/log content to the Lambda console was itself a production incident (see `AWS_SAM_LOCAL` section above) — don't reintroduce a stdout path for the real-Lambda case.

## Conventions

- TypeScript `strict: true`, no `any` in domain code (some pre-existing `any`/implicit-`any` in `issue-repository.ts` predates recent work — don't treat it as something to silently "clean up" alongside unrelated changes)
- Constructor injection everywhere; no module-level singletons except `LoggerFactory`
- No `console.log` — use the injected/child logger
- Pure functions for parsing/aggregation (no I/O) for easy unit testing
- `tsconfig.json` excludes `test/` from type-checking — `tsc --noEmit` won't catch fixture drift; keep `test/*.ts` fixtures accurate manually when `ReportModel`/domain interfaces change
- Fixture `test/fixtures/Jira__17_.csv` should be used for offline validation (325 story points total)

## Testing

Run tests: `npm test` (or `npm run test:watch`)

Key test coverage:
- `ConfigLoader`: valid + invalid configs (all required `jira.*` fields, including the newer `*StatusName`/`projectKey` fields)
- `selectWindow`: exact slicing rule against fixture sprints
- `ClassificationParser`: normal, level1-only, blank, odd spacing
- `SunburstAggregator`: correct group/sum and parent/child structure
- `HtmlReportRenderer`: rendering across various `ReportModel` fixtures, including an HTML-escaping/script-injection regression test (sprint name containing `<script>...</script>`) — if you add a new embedded data field, add/extend a fixture here rather than assuming existing coverage extends to it
- Golden test: fixture through parse + aggregate → assert expected rollup

Note: on this machine, `vitest`/`npm test` can fail under the sandboxed shell due to a macOS code-signing restriction on the native Rollup binary (`ERR_DLOPEN_FAILED`) — not a real test failure; re-run with sandboxing disabled if you hit this.
