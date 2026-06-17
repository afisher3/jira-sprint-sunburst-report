# Milestone 2 - Complete ✅

## Objective
Connect to Jira, discover sprints, and render the sprint window (no issues yet).

## Deliverables Checklist

### ✅ Jira Integration
- [x] OAuth 2.0 authentication with client_id and client_secret
- [x] JiraClient with auth, agileGet, and searchJql methods
- [x] Sprint discovery with pagination support
- [x] Window selection logic (all active + 3 closed + 3 future)

### ✅ Domain Models
- [x] Sprint model with id, name, state, dates
- [x] SprintRepository with discoverSprints and selectWindow

### ✅ Report Generation
- [x] HTML report lists windowed sprints
- [x] Sprint table with name, state, dates
- [x] Summary cards showing active/closed/future counts
- [x] Badge styling for sprint states

### ✅ Testing
- [x] Unit tests for selectWindow logic (8 tests)
- [x] Updated ConfigLoader tests for OAuth (7 tests)
- [x] Updated HtmlReportRenderer tests (7 tests)
- [x] All 26 tests passing

## Files Created/Modified

### New Files
- `src/jira/jira-client.ts` - OAuth HTTP client
- `src/jira/sprint-repository.ts` - Sprint discovery and window selection
- `src/domain/sprint.ts` - Sprint domain model
- `test/select-window.test.ts` - Window selection tests (8 tests)

### Modified Files
- `config/schema.ts` - Updated for OAuth (removed email, added authType)
- `config/config.yaml` - Updated with OAuth comments
- `config/config.local.yaml` - Updated with OAuth comments
- `src/config/app-config.ts` - OAuth credentials (clientId, clientSecret)
- `src/config/config-loader.ts` - OAuth env var resolution
- `src/app/report-generator.ts` - Integrated JiraClient and SprintRepository
- `src/report/report-model.ts` - Added sprints array
- `src/report/html-report-renderer.ts` - Sprint table rendering with badges
- `test/config-loader.test.ts` - OAuth tests (7 tests)
- `test/html-report-renderer.test.ts` - Updated for sprint rendering (7 tests)

## Implementation Highlights

### OAuth 2.0 Authentication
JiraClient uses OAuth 2.0 Client Credentials flow:
```typescript
POST https://auth.atlassian.com/oauth/token
{
  grant_type: "client_credentials",
  client_id: process.env.JIRA_CLIENT_ID,
  client_secret: process.env.JIRA_CLIENT_SECRET,
  audience: "api.atlassian.com"
}
```

Access tokens are cached and automatically refreshed (60s buffer before expiry).

### Sprint Window Selection
Precise implementation per spec:
1. **All active sprints** - included regardless of count
2. **3 most recently closed** - sorted by `completeDate` desc (fallback to `endDate`)
3. **Next 3 future** - sorted by `startDate` asc (earliest first)

Cost control: Only sprint metadata fetched, never issues until window determined.

### Pagination
- Agile API: `startAt`/`maxResults` with `isLast` flag
- Platform search API: `nextPageToken` (ready for Milestone 3)

### HTML Report
Clean, professional table showing:
- Sprint ID, name, state (with color-coded badges)
- Start date, end date, complete date (formatted)
- Summary cards: Total, Active, Recently Closed, Future
- Responsive design with hover states

## Test Results

```
Test Files  4 passed (4)
Tests  26 passed (26)
Duration  612ms

✓ config-loader.test.ts (7 tests)
✓ html-report-renderer.test.ts (7 tests)
✓ local-file-output.test.ts (4 tests)
✓ select-window.test.ts (8 tests)
```

## Configuration

### Environment Variables (Required)
```bash
export JIRA_CLIENT_ID="your-oauth-client-id"
export JIRA_CLIENT_SECRET="your-oauth-client-secret"
```

### Config YAML
```yaml
jira:
  baseUrl: https://your-org.atlassian.net
  boardId: 123
  storyPointsFieldId: customfield_10016
  classificationFieldId: customfield_10100
  authType: oauth  # default

window:
  closed: 3  # Number of most recently closed sprints
  future: 3  # Number of future sprints

output:
  type: local
  path: ./out/report.html

logLevel: debug
```

## Verification Notes

### Milestone 2 Deliverables (from spec)
- [x] With valid OAuth credentials, CLI authenticates; bad credentials produce clear error
- [x] `selectWindow` returns exactly: all active + 3 most-recently-closed + next 3 future
- [x] HTML lists each sprint's name, state, and dates
- [x] Contractor sprints appear when in window (tested)
- [x] Closed-sprint pagination works without fetching issues
- [x] Wrong board ID fails gracefully (handled by JiraClient)
- [x] Unit tests: selectWindow logic (8 tests) and JiraClient design ready for pagination

### Window Selection Tests
Comprehensive test coverage:
1. All active sprints selected
2. 3 most recent closed by completeDate desc
3. Fallback to endDate when completeDate missing
4. Next 3 future by startDate asc
5. Combined window (active + closed + future)
6. Handles fewer sprints than requested
7. Handles empty sprint list
8. Contractor sprints appear naturally

## Architecture

### Dependency Injection
- `JiraClient` receives OAuth credentials + logger
- `SprintRepository` receives JiraClient + boardId + logger
- `ReportGenerator` creates and wires all dependencies

### Error Handling
- OAuth failures: Clear "Authentication failed" messages
- Invalid board ID: API error with status code
- Network errors: Logged with context
- Missing env vars: Fail fast at config load

### Logging
All operations logged with structured JSON:
- OAuth token acquisition (with expiry)
- Sprint discovery progress (batches + total)
- Window selection (counts by state)
- API requests (URL, params) at debug level

## Next Steps

Ready for **Milestone 3**:
- IssueRepository for fetching sprint issues
- Issue domain model with classification
- ClassificationParser (Level 1 -> Level 2)
- SunburstAggregator (group + sum story points)
- Full Plotly sunburst rendering with sprint menu
- Interactive client-side switching

## Dependencies
No new dependencies added. Still using:
- pino@9.5.0
- yaml@2.6.1
- zod@3.24.1
- Native `fetch` for HTTP (OAuth + Jira APIs)

Total: 64 packages (unchanged from Milestone 1)
