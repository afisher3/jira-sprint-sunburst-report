# Jira Sprint Sunburst Report

Automated tool that pulls data from Jira Cloud, rolls story points up by a two-level classification taxonomy, and produces an interactive HTML report with an interactive Plotly sunburst chart.

## Business Value

### What It Does

This tool automatically pulls sprint data from Jira Cloud and generates an interactive HTML report with visual sunburst charts showing how your team's story points are distributed across a two-level classification taxonomy (e.g., "App Dev → New Feature", "Infrastructure → Security").

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
- UAT Return Rate: percent of issues that failed UAT in the last 30 days
  (number of issues that failed UAT / number of issues that moved out of UAT)*100
- Throughput: number of issues that moved out of that stage in the last 30 days

## Current Status

**All 3 Critical Milestones Complete** ✓
- Jira OAuth 2.0 integration
- Multi-sprint selection with checkboxes
- Interactive sunburst visualization with target comparison

## Prerequisites

- Node.js 20+ (LTS)
- Jira Cloud account with OAuth 2.0 credentials
- JIRA_CLIENT_ID and JIRA_CLIENT_SECRET environment variables

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
3. Set OAuth credentials:
   ```bash
   export JIRA_CLIENT_ID=your-oauth-client-id
   export JIRA_CLIENT_SECRET=your-oauth-client-secret
   ```

Never commit secrets to config files. OAuth credentials must come from the environment.

## Usage

```bash
# Build the project
npm run build

# Run with default config (config/config.local.yaml)
export JIRA_CLIENT_ID=your-client-id
export JIRA_CLIENT_SECRET=your-client-secret
node dist/cli.js

# Run with custom config
node dist/cli.js path/to/config.yaml

# Run tests
npm test
```

The report will be written to the path specified in `output.path` (default: `./out/report.html`).

The generated HTML report shows:
- Sprint selection via checkboxes (all active + 3 most recent closed + 3 next future sprints)
- Interactive sunburst chart aggregating selected sprints
- Side-by-side target distribution comparison (configurable)
- Real-time updates as you check/uncheck sprints
- Summary stats: total story points, issues, and categories

## Development

```bash
# Run tests in watch mode
npm run test:watch

# Build
npm run build
```

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
      output-target.ts             Output interface
      local-file-output.ts         Writes to local filesystem
config/
  schema.ts                   Zod validation schema
  config.yaml                 Base config template
  config.local.yaml          Local overrides (committed, no secrets)
test/
  *.test.ts                   Unit tests with vitest (47 tests)
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

## License

MIT
