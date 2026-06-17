# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Jira Sprint Sunburst Report — an automated tool that pulls data from Jira Cloud, rolls story points up by a two-level classification taxonomy, and produces an HTML report with an interactive Plotly sunburst chart.

## Commands

### Development
```bash
npm install                  # Install dependencies
npm run build               # Compile TypeScript with esbuild
npm test                    # Run vitest test suite
```

### Running the CLI
```bash
node dist/cli.js            # Runs against config/config.local.yaml
```

Environment variables required:
- `JIRA_API_TOKEN` — API token for Jira authentication (never in config files)

## Tech Stack

- **Language:** TypeScript (strict mode), Node.js LTS
- **HTTP:** Native `fetch`/`undici` (thin wrapper, no heavyweight SDK)
- **Charting:** Plotly.js (client-side in browser, never bundled into Node)
- **Logging:** Pino (structured JSON logging, no `console.log`)
- **Config:** YAML files + Zod schema validation
- **Templating:** Template literals or EJS
- **Tests:** Vitest
- **Build:** esbuild (single optimized artifact for Lambda-ready deployment)

## Architecture

Layered, dependency-injected architecture. Constructors take collaborators for mockability.

```
cli.ts              Thin entry: parse argv → AppConfig → ReportGenerator
handler.ts          (Future) Lambda entry over same ReportGenerator

ReportGenerator     Orchestrates config + repos + builder + renderer + output

config/
  ConfigLoader      Loads/validates YAML, resolves secrets from env
  AppConfig         Typed config object

logging/
  LoggerFactory     init(level); child(component) → Logger

jira/
  JiraClient        Auth + HTTP with nextPageToken paging
  SprintRepository  discoverSprints(boardId); selectWindow(sprints)
  IssueRepository   fetchBySprint(sprintId) → Issue[]

domain/
  Sprint            { id, name, state, startDate, endDate, completeDate }
  Issue             { key, summary, storyPoints, classification }
  Classification    { level1, level2 }
  ClassificationParser    parse(raw) → Classification
  SunburstAggregator      aggregate(issues) → SunburstDataset
  SunburstDataset         { ids[], labels[], parents[], values[] }

report/
  ReportBuilder           build(sprints, issuesBySprint) → ReportModel
  ReportModel             { menu, datasets: Map<sprintId, SunburstDataset> }
  HtmlReportRenderer      render(model) → HTML string
  output/
    OutputTarget          Interface: write(html, name): Promise<void>
    LocalFileOutput       Writes to local filesystem
    ConfluencePublisher   (Future stub)
```

### Lambda-Ready Design
The tool is stateless and run-to-completion. **Do not put logic in `cli.ts`**. The CLI is a thin adapter over `ReportGenerator.generate()`. A future Lambda handler will be another thin adapter over the same generator. Output sits behind `OutputTarget` interface for flexibility.

## Domain Rules (Implement Exactly)

### Classification Parsing
Jira field `Custom field (Classification)` is a two-level cascading select exported as a single string with levels joined by ` -> ` (space-hyphen-greater-space), e.g. `App Dev -> New Feature`.

Parse rules:
1. If null/empty/whitespace → `{ level1: "Unclassified", level2: "Unspecified" }`
2. Otherwise split on `->`, trim each part
3. `level1 = parts[0]`; if second part exists, `level2 = parts.slice(1).join(" -> ").trim()`, else `level2 = "Unspecified"`

Do not hardcode classifications — use whatever appears in the live field.

### Story Points
Use `Custom field (Story Points)` (not `Story point estimate`). Issues with no story points count as 0.

### Sprint Window Selection
Given all sprints on the board, select:
- **All** sprints in state `active`
- **3 most recently closed** (state `closed`, ordered by `completeDate` desc, fallback to `endDate`)
- **Next 3 future** (state `future`, ordered by `startDate` asc)

**Cost control:** Only fetch sprint *metadata* for all sprints. Only fetch *issues* for the windowed sprints (~9 sprints). Never fetch issues for entire backlog.

### Aggregation
Group windowed issues per sprint by `(level1, level2)`, sum story points, emit Plotly sunburst arrays:
- Two-level hierarchy: Level 1 nodes (parent = ""), Level 2 nodes (parent = Level 1 id)
- Use stable IDs (e.g. `L1` and `L1|L2`)
- Default: include only categories present in sprint. Config flag `report.showEmptyCategories` (default false) controls whether to show empty branches.

## Jira Integration

### Authentication
Basic auth: `Authorization: Basic base64(email:apiToken)`
- `email` and `baseUrl` in config YAML
- `apiToken` from env (`JIRA_API_TOKEN`)
- Fail clearly on 401/403

### Issue Search
The legacy `/rest/api/3/search` was **removed** from Jira Cloud. Use `/rest/api/3/search/jql`:
- Pagination via opaque `nextPageToken` (not `startAt`)
- No reliable total count — loop until no `nextPageToken`
- Request only needed fields

### Sprints (Agile API)
- List: `GET /rest/agile/1.0/board/{boardId}/sprint?state=...` (paginated with `startAt`/`maxResults`, response has `isLast`)
- Issues: `GET /rest/agile/1.0/sprint/{sprintId}/issue?jql=...&fields=...`

### Custom Fields
Story Points and Classification are `customfield_xxxxx`. Resolve once via `GET /rest/api/3/field`, then put IDs in config (`storyPointsFieldId`, `classificationFieldId`).

Keep `JiraClient` thin and mockable. Log endpoint + JQL at debug, retries at warn.

## Configuration

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
  type: local
  path: ./out/report.html
logLevel: info
```

**Secrets never in YAML.** `JIRA_API_TOKEN` read from environment by `ConfigLoader`.

Config files:
- `config/config.yaml` — base defaults (committed)
- `config/config.local.yaml` — local overrides (committed, no secrets)
- `config/schema.ts` — Zod schema; `ConfigLoader` validates and fails loudly

## Conventions

- TypeScript `strict: true`, no `any` in domain code
- Constructor injection everywhere; no module-level singletons except `LoggerFactory`
- No `console.log` — use injected logger
- Pure functions for parsing/aggregation (no I/O) for easy unit testing
- Fixture `test/fixtures/Jira__17_.csv` should be used for offline validation (325 story points total)

## Testing

Run tests: `npm test`

Key test coverage:
- `ConfigLoader`: valid + invalid configs
- `selectWindow`: exact slicing rule against fixture sprints
- `ClassificationParser`: normal, level1-only, blank, odd spacing
- `SunburstAggregator`: correct group/sum and parent/child structure
- `JiraClient`: pagination against mocked multi-page response
- Golden test: fixture through parse + aggregate → assert expected rollup
