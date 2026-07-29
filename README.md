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
- Summary stats: total story points, issues, and categories

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

## License

MIT