# Jira Sprint Sunburst Report — Build Spec & Agent Context

This document is the build context for an automated tool that pulls data from Jira Cloud,
rolls story points up by a two-level classification taxonomy, and produces an HTML report
with an interactive Plotly sunburst chart. It is written to be handed to a coding agent
(Claude Code) and to a human reviewer.

The architecture and conventions sections are stable and good to persist as `CLAUDE.md`.
The milestones drive the work — build and verify one at a time.

---

## 1. Goal

On-demand CLI tool (later: AWS Lambda) that, given a Jira board, selects a window of sprints,
fetches their issues, aggregates story points by a `Level 1 -> Level 2` classification, and emits
a single self-contained HTML report. The report has a sprint selector menu; choosing a sprint shows
that sprint's sunburst (inner ring = Level 1, outer ring = Level 2, wedge size = summed story points).

A prototype of the target output exists in Excel (a `Level 1 / Level 2 / Points` table feeding a
native Excel sunburst). The Excel taxonomy is illustrative only — the **live taxonomy comes from the
Jira classification field values**, not the prototype's hardcoded categories.

---

## 2. Tech stack (decided)

- **Language:** TypeScript on Node.js (LTS). TS chosen for type safety and readability on handoff.
- **HTTP:** native `fetch` / `undici` — a thin client, no heavyweight Jira SDK (the Jira Cloud search
  API changed in 2025 and SDKs lagged; a thin wrapper over `fetch` is easier to keep current and to mock in tests).
- **Charting:** Plotly. **Runs client-side in the browser** — `plotly.js` is referenced/inlined in the
  emitted HTML, never bundled into the Node process. The Node side only does HTTP + transform + templating.
- **Logging:** Pino. One root logger configured from config; every component gets a child logger tagged
  with its name. No `console.log` anywhere.
- **Config:** YAML files + a schema validator (recommend `zod`). Secrets come from env vars, never files.
- **Templating:** a single HTML template (template literal or `ejs`).
- **Tests:** `vitest`.
- **Build/bundle:** `esbuild` (compiles the multi-file project to one optimized JS artifact; good for
  fast Lambda cold starts later).

### Why this translates cleanly to Lambda later
The tool is a stateless run-to-completion job. The entry point (`cli.ts`) is a *thin adapter* over the
real logic in `ReportGenerator.generate()`. A Lambda is a deployment package of many files with one
designated handler export — so the Lambda version is just a second thin adapter (`handler.ts`) wiring up
the same `ReportGenerator`, triggered by an event instead of `argv`. Output already sits behind an
`OutputTarget` interface (`LocalFileOutput` now; `S3Output` / `ConfluencePublisher` later) so no core
rewrite is needed. **Do not** put logic in `cli.ts`.

---

## 3. Architecture

Layered, dependency-injected (constructors take their collaborators so units are mockable).

```
cli.ts            thin entry: parse argv -> build AppConfig -> run ReportGenerator
handler.ts        (future) thin Lambda entry over the same ReportGenerator

ReportGenerator   orchestration / use-case. Wires config + repos + builder + renderer + output.

config/
  ConfigLoader    loads + validates YAML, resolves secrets from env -> AppConfig
  AppConfig       typed config object

logging/
  LoggerFactory   init(level); child(component) -> Logger

jira/
  JiraClient      auth + HTTP. searchJql(jql, fields) with nextPageToken paging; agileGet(path)
  SprintRepository  discoverSprints(boardId); selectWindow(sprints)
  IssueRepository   fetchBySprint(sprintId) -> Issue[]

domain/
  Sprint          { id, name, state, startDate, endDate, completeDate }
  Issue           { key, summary, storyPoints, classification }  + displayName -> `${key} ${summary}`
  Classification  { level1, level2 }
  ClassificationParser  parse(raw) -> Classification   (rules below)
  SunburstAggregator    aggregate(issues) -> SunburstDataset
  SunburstDataset       { ids[], labels[], parents[], values[] }   (Plotly sunburst shape)

report/
  ReportBuilder        build(sprints, issuesBySprint) -> ReportModel
  ReportModel          { menu: SprintMenuItem[], datasets: Map<sprintId, SunburstDataset> }
  HtmlReportRenderer   render(model) -> html string
  output/
    OutputTarget       interface: write(html, name): Promise<void>
    LocalFileOutput    writes to local path
    ConfluencePublisher  (future stub)
```

---

## 4. Domain rules (precise — the agent must implement exactly)

### 4.1 Classification parsing
The Jira field `Custom field (Classification)` is a **single field** using Jira's two-level cascading
select. In exports it is one string with the levels joined by ` -> ` (space, hyphen, greater-than, space),
e.g. `App Dev -> New Feature`. Level 2 values can themselves contain ` / ` and other characters.

Parse robustly:
1. If the raw value is null / empty / whitespace → `{ level1: "Unclassified", level2: "Unspecified" }`.
2. Otherwise split on `->`, trim each part.
3. `level1 = parts[0]`. If there is a second part, `level2 = parts.slice(1).join(" -> ").trim()`,
   else `level2 = "Unspecified"` (covers values like `App Dev` or `Security` with no second level).

The canonical set of valid classifications is whatever appears in the live field — do not hardcode it.

### 4.2 Story points
Use the field exported as `Custom field (Story Points)`. The team-managed `Story point estimate` field
is empty here and must not be used. Issues with no story points count as 0 in the rollup.

### 4.3 Sprint window selection (`selectWindow`)
Given all sprints discovered on the board, the window is:
- **all** sprints in state `active`, plus
- the **3 most recently closed** (state `closed`, ordered by `completeDate` desc — fall back to `endDate`), plus
- the **next 3 future** (state `future`, ordered by `startDate` asc).

Cost control: sprint *metadata* is cheap; *issues* are expensive. `discoverSprints` fetches metadata only
(paging through closed sprints), `selectWindow` slices to the rule, and `IssueRepository.fetchBySprint`
is only ever called for the resulting window (~9 sprints). Never fetch issues for the whole backlog.

Contractor teams sometimes run their own sprints in the same project; these appear in the board's sprint
list and will show up in the window/menu naturally if active or recently closed. That is expected — the
menu lists every windowed sprint by name and the user navigates to the one they want.

### 4.4 Aggregation
Group windowed issues per sprint by `(level1, level2)`, sum story points, and emit Plotly sunburst arrays:
- A root-less two-level hierarchy: Level 1 nodes (parent = "") and Level 2 nodes (parent = its Level 1 id).
- Use stable ids (e.g. `L1` and `L1|L2`) so labels can repeat across branches.
- **Default:** include only categories that actually appear in the sprint. Make "show full taxonomy with
  zeros" a config flag (`report.showEmptyCategories`, default false) — the prototype kept some zeros visible,
  so this is intentionally configurable.

---

## 5. Jira integration notes (Jira Cloud)

- **Auth:** Basic auth, `Authorization: Basic base64(email:apiToken)`. `email` and `baseUrl` live in config;
  `apiToken` comes from env (`JIRA_API_TOKEN`). Fail with a clear message on 401/403.
- **Issue search:** the legacy `/rest/api/3/search` endpoint was **removed** from Jira Cloud. Use
  `/rest/api/3/search/jql`. Pagination is via an opaque `nextPageToken` (not `startAt`), and there is no
  reliable total count — loop until no `nextPageToken` is returned. Request only the fields needed.
- **Sprints:** use the Agile API (separate from platform search, not affected by the above removal):
  - `GET /rest/agile/1.0/board/{boardId}/sprint?state=...` (paginated with `startAt`/`maxResults`,
    response carries `isLast`) to list sprints with `id, name, state, startDate, endDate, completeDate`.
  - `GET /rest/agile/1.0/sprint/{sprintId}/issue?jql=...&fields=...` to fetch a sprint's issues.
- **Custom field IDs:** Story Points and Classification are `customfield_xxxxx`. Resolve them once via
  `GET /rest/api/3/field`, then put the IDs in config (`storyPointsFieldId`, `classificationFieldId`).
  Provide a tiny one-off script or documented manual step to discover them; do not hardcode in source.
- Keep `JiraClient` a thin, mockable wrapper. Log endpoint + JQL at debug, retries/backoff at warn.

---

## 6. Config & secrets (GitOps shape)

```
config/
  config.yaml         # base, non-secret defaults (committed)
  config.local.yaml   # local overrides (committed; no secrets)
  schema.ts           # zod schema; ConfigLoader validates on load and fails loudly
```

Example (non-secret) config:
```yaml
jira:
  baseUrl: https://<org>.atlassian.net
  email: <service-account-email>
  boardId: 0
  storyPointsFieldId: customfield_10016
  classificationFieldId: customfield_XXXXX
window:
  closed: 3
  future: 3
report:
  showEmptyCategories: false
output:
  type: local            # local | confluence (future)
  path: ./out/report.html
logLevel: info
```
Secrets are never in YAML. `JIRA_API_TOKEN` is read from the environment by `ConfigLoader`.

---

## 7. Conventions

- TypeScript `strict: true`. No `any` in domain code.
- Constructor injection everywhere; no module-level singletons except `LoggerFactory`.
- No `console.log` — use the injected logger.
- Pure functions for parsing/aggregation (no I/O) so they are trivially unit-testable.
- The provided `Jira__17_.csv` export should be committed under `test/fixtures/` and used to validate
  parsing and aggregation offline, without a live Jira connection.

---

## 8. Milestones

Build and verify these in order, ideally one per branch. Each has an explicit "done when" you can run.

### Milestone 1 — Executable skeleton + config + hello-world report (no Jira)
**Purpose:** prove the build/run loop, config loading/validation, logging, and the HTML output pipeline.

**In scope:** project scaffold (`package.json`, `tsconfig.json`, esbuild build, `vitest`), `ConfigLoader`
+ `AppConfig` + schema, `LoggerFactory`, `OutputTarget` + `LocalFileOutput`, `HtmlReportRenderer` emitting
a minimal page, `Cli`, and a `ReportGenerator` stubbed to produce a trivial report model.

**Out of scope:** any Jira code, real data, Plotly, sunburst.

**Deliverable:** `npm run build` then running the CLI reads the config and writes an HTML file that says
"Hello world" and echoes a couple of config values (e.g. board id and window sizes) to prove the wiring.

**Done when:**
- [ ] `npm install` and `npm run build` succeed with zero TS errors.
- [ ] Running the CLI against `config.local.yaml` writes the HTML to the configured `output.path`.
- [ ] Opening the file in a browser shows "Hello world" + the echoed config values.
- [ ] A deliberately invalid config (e.g. missing `boardId`) fails fast with a clear validation error.
- [ ] Logs are structured JSON at the configured level.
- [ ] Unit tests pass: `ConfigLoader` (valid + invalid), `HtmlReportRenderer` (output contains expected text),
      `LocalFileOutput` (writes a file).

### Milestone 2 — Connect to Jira, discover sprints, render the window (no issues yet)
**Purpose:** prove auth, the Agile sprint discovery + pagination, and the window-selection logic.

**In scope:** `JiraClient` (auth, `agileGet`, `searchJql` with `nextPageToken`, retries), `SprintRepository`
(`discoverSprints`, `selectWindow`), `Sprint`. Custom field IDs resolved and placed in config. The report
for this milestone is an HTML page listing the selected sprints.

**Out of scope:** issue fetching, classification, story-point rollup, sunburst.

**Deliverable:** running the CLI connects to real Jira and writes an HTML page listing each windowed sprint
with its name, state, and start/end dates.

**Done when:**
- [ ] With a valid `JIRA_API_TOKEN`, the CLI authenticates; bad credentials produce a clear error.
- [ ] `selectWindow` returns exactly: all `active` + 3 most-recently-closed + next 3 `future`.
- [ ] The HTML lists each sprint's name, state, and dates; contractor sprints appear when in window.
- [ ] Closed-sprint pagination works without fetching any issues (verify it handles >1 page of sprints).
- [ ] A wrong board id fails gracefully.
- [ ] Unit tests pass: `selectWindow` against a fixture set of sprints (assert the exact slicing rule),
      and `JiraClient` pagination against a mocked multi-page response.

### Milestone 3 — Full app: issues, classification, rollup, Plotly sunburst, sprint menu
**Purpose:** the finished report.

**In scope:** `IssueRepository.fetchBySprint`, `Issue` (incl. `summary` + `displayName`),
`ClassificationParser`, `SunburstAggregator` + `SunburstDataset`, `ReportBuilder` + `ReportModel`,
and an upgraded `HtmlReportRenderer` that embeds Plotly, all per-sprint datasets, a sprint selector menu,
and leaf tooltips showing category + points (and issue `key + summary` where applicable).

**Out of scope (future):** AWS/Lambda handler, S3/Confluence output, scheduling.

**Deliverable:** one self-contained HTML file with a sprint dropdown; selecting a sprint shows its
sunburst (Level 1 inner ring, Level 2 outer ring, wedge = summed story points), switching client-side
with no rebuild.

**Done when:**
- [ ] Per-sprint story points roll up by Level 1 / Level 2; the totals reconcile against a manual check
      (the bundled fixture sums to 325 story points across its issues).
- [ ] Classification rules applied exactly: blank → `Unclassified / Unspecified`; `Level1` with no `->`
      → `Level1 / Unspecified`.
- [ ] The sunburst renders and hover shows category + points.
- [ ] The menu lists every windowed sprint; switching updates the chart client-side.
- [ ] `report.showEmptyCategories` toggles whether empty branches show as zeros.
- [ ] Unit tests pass: `ClassificationParser` (normal, level1-only, blank, odd spacing),
      `SunburstAggregator` (correct group/sum and parent/child structure for Plotly), and a golden test
      that runs the fixture through parse + aggregate and asserts the expected rollup.

---

## 9. Suggested project layout

```
jira-sunburst-report/
  package.json
  tsconfig.json
  esbuild.config.mjs
  config/
    config.yaml
    config.local.yaml
    schema.ts
  src/
    cli.ts
    handler.ts                 # future Lambda entry (stub ok early)
    app/report-generator.ts
    config/config-loader.ts
    config/app-config.ts
    logging/logger-factory.ts
    jira/jira-client.ts
    jira/sprint-repository.ts
    jira/issue-repository.ts
    domain/sprint.ts
    domain/issue.ts
    domain/classification.ts
    domain/classification-parser.ts
    domain/sunburst-aggregator.ts
    domain/sunburst-dataset.ts
    report/report-builder.ts
    report/report-model.ts
    report/html-report-renderer.ts
    report/output/output-target.ts
    report/output/local-file-output.ts
    report/output/confluence-publisher.ts   # future stub
  templates/report.html
  test/
    fixtures/Jira__17_.csv
    config-loader.test.ts
    select-window.test.ts
    classification-parser.test.ts
    sunburst-aggregator.test.ts
  out/                         # generated reports (gitignored)
```

---

## 10. Driving Claude Code

- Tackle one milestone per session/branch; do not let it jump ahead to the sunburst before sprint
  discovery works.
- After each milestone, run the tests and the CLI yourself before moving on — the "Done when" lists are
  the gates.
- Commit the `Jira__17_.csv` fixture early so the parser and aggregator can be built and tested without a
  live Jira connection.
- Resolve the two custom field IDs (`GET /rest/api/3/field`) before starting Milestone 2.
