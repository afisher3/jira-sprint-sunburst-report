# Jira Sprint Sunburst and Delivery Metrics Report

Automated tool that pulls sprint data from Jira Cloud, rolls story points up by a two-level classification taxonomy, and produces an interactive HTML report with delivery metrics.

## Business Value

### What It Does

This tool pulls sprint data from Jira Cloud and generates an HTML report with visual sunburst charts showing how your team's story points are distributed across a two-level classification taxonomy and other delivery health metrics.

### Key Business Value

**1. Strategic Work Visibility**
- **See the big picture**: Instantly understand where your engineering effort is going across sprints
- **Track portfolio balance**: Are you building new features vs. fixing bugs vs. paying down tech debt?
- **Identify trends**: Compare actual work distribution against your strategic goals

**2. Data-Driven Decision Making**
- **Target vs. Actual**: Side-by-side comparison shows if your team is working on what matters most
- **Multi-sprint analysis**: Checkbox interface lets you aggregate data across active, recent, and upcoming sprints
- **Classification flexibility**: Works with any two-level Jira custom field taxonomy your organization uses

**3. Time Savings & Automation**
- **No manual reporting**: Eliminates hours of manually pulling data from Jira and building spreadsheets
- **Always up-to-date**: Run on-demand to get current sprint data
- **Self-service**: Product managers and leadership can generate their own reports

**4. Stakeholder Communication**
- **Beautiful visualizations**: Interactive Plotly sunburst charts are presentation-ready
- **Easy to understand**: Color-coded hierarchy makes it clear where points are allocated
- **Exportable**: HTML reports can be shared, embedded in Confluence, or presented to executives

**5. Delivery Health**
- **Flow metrics**: Throughput per stage and return rate surface bottlenecks

### Example Use Cases

- **Sprint Planning**: "Are we allocating enough points to security work this quarter?"
- **Board Reviews**: "Show me our actual vs. target distribution for the last 3 sprints"
- **OKR Tracking**: "What percentage of our work supports our Q2 objectives?"
- **Resource Allocation**: "Are we spending too much time on maintenance vs. innovation?"

---

**Bottom line**: Turns raw Jira data into actionable insights about where your engineering capacity is going, helping leadership make better strategic decisions about work prioritization.

## Metrics Definitions
- QA Return Rate: percent of issues that failed QA in the last 30 days
  (number of issues that failed QA / number of issues that moved out of QA)*100
  If no issues have moved past QA, it will be reported as zero
- UAT Return Rate: percent of issues that failed UAT in the last 30 days
  (number of issues that failed UAT / number of issues that moved out of UAT)*100
  If no issues have moved past UAT, it will be reported as zero
- Throughput: number of issues that reached the final status of each stage in the last 30 days

## Current Processes
Currently, there are 3 workflows used for DevOps tickets:

Story Workflow (the "Dev" of DevOps)
Used for issue types "Story" (new code) and "Bug" (fixes), includes 15 status options

Task & Spike Workflow (the "Ops" of DevOps)
Used for issue types "Task" (account setup, config updates, etc) and "Spike" (research and decision making), only includes 13 status options because QA is not included

Vulnerability Workflow (the Security work of DevOps)
Used for issue type "Vulnerability" (resolving specific security findings, typically with updates to 3rd party libraries), very similar to Task & Spike flow except there is "Under Investigation" status that happens before "Refined", also "Deferred" is not an option

Each status option has 1 to many paths to other options, so there could be several paths we haven't accounted for in the metrics. Any changes to the above workflows will require updates to the dashboard

## Current Status

**All 3 Critical Milestones Complete** ✓
- Jira OAuth 2.0 integration
- Multi-sprint selection with checkboxes
- Interactive sunburst visualization with target comparison

## Working with Claude Code

This repo ships a `CLAUDE.md` with the context an AI assistant needs to work here safely — architecture, past production incidents, and conventions that aren't obvious from the code alone (e.g. the local-vs-Lambda environment switch, the ticket-table filter-by-key rule, why `src/cli.ts` is dead code).

To start a new Claude Code session on this project, open a session in this directory and give it a prompt like:

> Read CLAUDE.md and get up to speed on this project before we start.

If you've already had Claude read `CLAUDE.md` earlier in the day and just need a cheap refresher (e.g. a new session after a short break), point it at the condensed version instead:

> Read CLAUDE.compact.md for a quick refresher, then let's work on `<describe your task>`.

There are also reusable project skills in `.claude/skills/` that Claude can invoke directly instead of re-deriving the steps each time:
- **`build-and-test`** — the build + test loop for this repo, including the sandbox workaround `vitest` needs on macOS.
- **`add-filterable-stat-card`** — the recipe for adding a new clickable stat card (like the Throughput or Return Rate cards) that filters the tickets table by issue key.

You can ask Claude to use these by name (e.g. "use the `add-filterable-stat-card` skill to add a card for X"), or it will pick them up on its own when a request matches.

## Prerequisites

- Node.js 22+ (LTS)
- AWS SAM CLI
- Jira Cloud account with OAuth 2.0 credentials
- JIRA_CLIENT_ID and JIRA_CLIENT_SECRET stored in Secrets Manager

## Installation

```bash
npm install
```

## Configuration

1. Copy `config/config.yaml` to `config/config.local.yaml`
2. Update the following in `config.local.yaml`:
   - `jira.baseUrl` - Your Jira Cloud URL (e.g., https://your-org.atlassian.net)
   - `jira.boardId` - The board ID to query
   - `jira.storyPointsFieldId` - Custom field ID for story points (e.g., customfield_10016)
   - `jira.classificationFieldId` - Custom field ID for classification (e.g., customfield_10100)
   - `jira.lastStatusOfRefinement` - Last status in the refinement stage of your Jira workflow
   - `jira.lastStatusOfDev` - Last status in the dev stage of your Jira workflow
   - `jira.lastStatusOfQA` - Last status in the QA stage of your Jira workflow
   - `jira.lastStatusOfUAT` - Last status in the UAT stage of your Jira workflow
3. Update SECRET_NAME in `template.yaml` to match the name of the Secrets Manager secret with your Jira keys

Never commit secrets to config files. OAuth credentials must come from the environment.

## Usage & Development

```bash

#Install dependencies
npm install

# Build the project
npm run build

# Deploy to SAM
sam build
sam deploy --guided

# Run tests
npm test
```

The generated HTML report shows:
- Sprint selection via checkboxes (all active + 3 most recent closed + 3 next future sprints)
- Interactive sunburst chart aggregating selected sprints
- Side-by-side target distribution comparison (configurable)
- Real-time updates as you check/uncheck sprints
- Summary stats: total story points, issues, stale tickets, and rollover tickets
- A sortable, filterable, collapsible table of every ticket in the selected sprints (see "Tickets Table" below)

## Tickets Table

The report's tickets table lists every issue in whichever sprints are currently checked. Each row shows the issue key (linked out to that issue in Jira), summary, story points, status, and which sprint it belongs to.

- **Sortable** — click any column header to sort by that column ascending; click it again to reverse the order. The active column is highlighted with a ▲/▼ indicator. Sorting is done entirely in the browser, so it stays applied as you check/uncheck sprints or change filters.
- **Collapsible** — the panel's header is a single toggle button. Its label switches between "Tickets - N" (expanded, showing the current row count) and "Table of issues" (collapsed), with the chevron rotating to match.
- **Filterable by clicking any stat card** — every clickable card elsewhere in the report (Throughput, Return Rates, and the Stale/Rollover Tickets cards in Sprint Details) narrows the table down to just the issues behind that number when clicked. A subtitle above the table reads "— filtered by \<card name\>"; clicking the same card again clears the filter. See "Card Reference & Sample JQL" below for exactly which issues back each card.
- **Empty state** — if no tickets match the current sprint selection (or the active filter), the table is replaced with a "No tickets to show." message instead of rendering an empty grid.

## Running Locally

Runs the real Lambda handler via `sam local invoke` against live Jira data, without uploading to S3.

### Mac/Linux

Prerequisites:
- Node.js 22+ and npm
- AWS CLI, authenticated
- AWS SAM CLI
- Docker or colima, running

```bash
# If using colima instead of Docker Desktop
colima start

# Refresh AWS credentials (SSO/temp creds expire quickly)
aws login

./scripts/run-report-locally.sh
```

- Report: `./out/report.html`
- Logs: `./out/report.log`
- Script handles `npm run build`, `sam build`, `DOCKER_HOST` (colima socket), `--no-memory-limit`, and extracting the HTML from the invoke response.
- `LoginRefreshRequired` error → re-run `aws login`, then retry.
- npm/build errors → run `npm install`, then retry.

### Windows

Prerequisites:
- Node.js 22+ and npm
- AWS CLI, authenticated
- AWS SAM CLI
- Docker Desktop, running

**PowerShell**

```powershell
aws login
.\scripts\run-report-locally.ps1
```

- Report: `.\out\report.html`
- Logs: `.\out\report.log` (printed after the invoke finishes, not streamed live — see script header for why)
- npm/build errors → run `npm install`, then retry.

**Git Bash**

```bash
aws login
./scripts/run-report-locally-windows.sh
```

- Report: `.\out\report.html`
- Logs: `.\out\report.log` (streamed live, same as Mac/Linux — real bash supports it)
- npm/build errors → run `npm install`, then retry.

## Output
Each run writes the generated HTML report to the S3 bucket specified by BUCKET_NAME using the key 'metrics-report'. The latest run overrides the previous report.

## Infrastructure
AWS SAM provisions the application infrastructure, including:
- Lambda function for scheduled report generation
- S3 bucket for report storage
- Secrets Manager integration for Jira credentials

## Project Structure

```
src/
  cli.ts                      CLI entry point (thin adapter)
  app/
    report-generator.ts       Main orchestrator
  config/
    config-loader.ts          YAML loader with validation
    app-config.ts             TypeScript config types
  logging/
    logger-factory.ts         Pino-based structured logging
  jira/
    jira-client.ts                 OAuth 2.0 HTTP client
    sprint-repository.ts           Sprint discovery and window selection
    issue-repository.ts            Issue fetching with custom fields
  domain/
    sprint.ts                      Sprint domain model
    issue.ts                       Issue domain model
    classification.ts              Classification type
    classification-parser.ts       Parse cascading select field
    sunburst-aggregator.ts         Aggregate issues to sunburst data
    sunburst-dataset.ts            Plotly-compatible data structure
    metric-dataset.ts              Data structure for metrics data
    target-sunburst-generator.ts   Generate target distribution from config
  handlers/
    lambda-handler.ts              Lambda entry point
  report/
    html-report-renderer.ts        Renders interactive HTML with Plotly
    report-model.ts                Data model for reports
    output/
      output-target.ts             Output interface (legacy - not used when outputting to S3)
      local-file-output.ts         Writes to local filesystem (legacy - not used when outputting to S3)
config/
  schema.ts                   Zod validation schema
  config.yaml                 Base config template
  config.local.yaml          Local overrides (no secrets, gitignored)
test/
  *.test.ts                   Unit tests with vitest
```

## Milestones

- [x] **Milestone 1**: Executable skeleton + config + hello-world report (no Jira)
- [x] **Milestone 2**: Connect to Jira with OAuth, discover sprints, render the window (no issues yet)
- [x] **Milestone 3**: Full app with issues, classification, rollup, Plotly sunburst, sprint menu

## Enhancements

- [x] **Multi-sprint selection**: Checkbox interface for selecting multiple sprints to aggregate
- [x] **Dynamic aggregation**: Real-time chart updates combining data from selected sprints
- [x] **Target comparison**: Configurable target distribution sunburst displayed side-by-side

## Tech Stack

- TypeScript (strict mode)
- Node.js (native fetch/undici)
- Pino (structured logging)
- Zod (config validation)
- YAML (configuration)
- Vitest (testing)
- esbuild (bundling)
- Plotly.js (client-side interactive sunburst charts)

## Card Reference & Sample JQL

Every stat card in the report is backed by a specific query in `src/jira/issue-repository.ts`. Sample JQL below uses `sprint = 255` in place of a real sprint ID, except for the Last 30 Days Summary cards, which are intentionally project-scoped rather than sprint-scoped (called out below). These are copied from the current code — if a card's number ever looks wrong, this is the first place to check for drift between this doc and the actual query.
Many of the JQL queries include a reference to filter ID 11682, the "DevOps Team Filter", which is used for generating the board reviewed at Daily Standups. This filter ensures queried results do not include project specific tickets by utilizing a list of parent epic IDs to check. The list of epics for the filter will require updates whenever a new project begins or the list of tickets to include for the dashboard needs refinement.
Filter 11682 JQL used during development:
```
project = ATHENA
and issuetype NOT IN (Test, Epic, Initiative)
and issue NOT IN (portfolioChildIssuesOf("ATHENA-8540"), portfolioChildIssuesOf("ATHENA-10452"), portfolioChildIssuesOf("ATHENA-10511"), portfolioChildIssuesOf("ATHENA-10719"), portfolioChildIssuesOf("ATHENA-10720"))
ORDER BY Rank
```

### Last 30 Days Summary
Rolling 30-day window, scoped to the whole project — independent of sprint selection or checkboxes.

- **Total Tickets** — count of all project issues updated in the last 30 days. Computed as three non-overlapping 10-day windows, unioned by issue key (`fetchTotalCountLast30Days`).
  ```
  filter = 11682 AND updated >= -30d AND updated < -20d
  ```
  (repeated for the -20d→-10d and -10d→now windows, then de-duplicated)

- **Refined** — issues that transitioned into the "Refined" status at some point in the last 30 days (`fetchStatusCountLast30Days`, status = `refinedStatusName` config value).
  ```
  filter = 11682 AND Status changed to "Refined" after -30d
  ```

- **Ready for Dev** — same query shape, status = `readyForDevStatusName`.
  ```
  filter = 11682 AND Status changed to "ready for dev" after -30d
  ```

- **Ready for Testing** — status = `readyForTestingStatusName`.
  ```
  filter = 11682 AND Status changed to "Ready for Testing" after -30d
  ```

- **Ready for UAT** — status = `readyForUatStatusName`.
  ```
  filter = 11682 AND Status changed to "Ready for UAT" after -30d
  ```

- **Resolved** — status = `resolvedStatusName`.
  ```
  filter = 11682 AND Status changed to "Resolved" after -30d
  ```

- **Closed** — status = `closedStatusName`.
  ```
  filter = 11682 AND Status changed to "Closed" after -30d
  ```

- **Reopened** — status = `reopenedStatusName`.
  ```
  filter = 11682 AND Status changed to "Reopened" after -30d
  ```

### Sprint Details
Recomputed for whichever sprints are currently checked.

- **Total Story Points** / **Issues** — sum of story points / count of every issue currently in the selected sprint(s) (`fetchBySprint`).
  ```
  sprint = 255
  ```

- **Stale Tickets (14+ days no status change)** — open issues (excludes Resolved/Closed) in the sprint whose status hasn't changed in 14 days (`fetchStaleTickets`).
  ```
  sprint = 255 AND NOT status changed after -14d AND filter = 11682 AND status NOT IN (resolved, closed)
  ```

- **Rollover Tickets (in > 2 sprints)** — has no JQL of its own. It re-uses the plain `sprint = 255`-style query already run for every windowed sprint, then flags any issue key that shows up in more than 2 of those sprints' results.

### Throughput
Ticket count and story points for issues that reached the final status of each stage, for the selected sprint(s).

- **Refinement Throughput** — issues that transitioned to the configured `lastStatusOfRefinement` status (`fetchThroughputBySprintStage`).
  ```
  sprint = 255 AND Status changed to "ready for dev"
  ```

- **Dev Throughput** — issues that moved out of peer review into testing/UAT (`fetchDevThroughput`). This one is fully hardcoded and does **not** read the `lastStatusOfDev` config value, even though that field exists in config/schema — worth knowing if you go looking for where it's wired in.
  ```
  sprint = 255 AND status CHANGED FROM ("In Peer Review") TO ("Ready for Testing", "Ready for UAT")
  ```

- **QA Throughput** — issues that transitioned to the configured `lastStatusOfQA` status.
  ```
  sprint = 255 AND Status changed to "Ready for UAT"
  ```

- **UAT Signoff Throughput** — issues that transitioned to the configured `lastStatusOfUAT` status.
  ```
  sprint = 255 AND Status changed to "Resolved"
  ```

### Return Rates
Each rate is `(numerator issues / denominator issues) * 100`, computed client-side from two separately-fetched JQL counts.

- **QA Return Rate**
  - Numerator (`fetchReturnCountQA`) — issues flagged as having failed QA at least once:
    ```
    sprint = 255 AND "QA Fail Count[Number]" > 0
    ```
  - Denominator (`fetchCountPastQA`) — issues that passed through the QA gate at all:
    ```
    sprint = 255 AND Status CHANGED FROM ("Ready for Testing", "In Testing") TO ("Ready for UAT", "Reopened")
    ```

- **UAT Return Rate**
  - Numerator (`fetchReturnCountUAT`) — issues flagged as having failed UAT at least once:
    ```
    sprint = 255 AND "UAT Fail Count[Number]" > 0
    ```
  - Denominator (`fetchCountPastUAT`) — issues that passed through the UAT gate at all:
    ```
    sprint = 255 AND status CHANGED FROM ("Ready for UAT") TO ("Resolved", "Closed", "Reopened")
    ```

### Tickets Table
Not a stat card, but the thing every card above filters into: the full issue list for the selected sprint(s) (`fetchBySprint`, same query as Sprint Details), sortable by any column and collapsible via the panel's toggle button.

## License

MIT