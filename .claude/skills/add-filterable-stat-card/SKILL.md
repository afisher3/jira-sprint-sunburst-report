---
name: add-filterable-stat-card
description: Add a new clickable stat card (in the Throughput panel, Return Rates panel, or a new info-panel) that filters the tickets table down to the issue keys behind that number — the exact pattern already used for Throughput (refinement/dev/qa/uatSignoff) and Return Rate (qaReturn/uatReturn) cards in jira-sprint-sunburst-report.
---

# Add a filterable stat card

The tickets table filters by issue **key**, never by an issue's current status (see CLAUDE.md's "Ticket-table filtering model") — a stat card's number and its filtered-table view must both come from the same JQL-returned key list, not from re-deriving membership off the issue's live status field.

The client-side filtering mechanism is already fully generic over any card with class `stat-card-clickable` and a `data-throughput-key` attribute — adding a new card requires **no new client-JS logic**, only wiring new data through. Steps:

1. **`src/jira/issue-repository.ts`** — add (or reuse) a `fetch*` method that runs a JQL query and returns `{ totalStoryPoints, issueKeys }` (the existing `ThroughputResult` interface). Follow the pagination pattern already used by every method here: loop on `nextPageToken` until it's undefined, push `key`s into an array as you go.
2. **`src/domain/throughput-issue-keys.ts`** — add a new `string[]` field to `ThroughputIssueKeys` for this card's key list.
3. **`src/app/report-generator.ts`** — inside the per-sprint `Promise.all` in `doGenerate()`, call the new repository method alongside the existing ones, then thread `.issueKeys` into the `throughputIssueKeys` object built each loop iteration. If the card also displays a count/points number, feed `.issueKeys.length`/`.totalStoryPoints` into `MetricDataset` too.
4. **`src/report/html-report-renderer.ts` (HTML)** — add a `<div class="stat-card stat-card-clickable" data-throughput-key="yourKey">...</div>` inside whichever `.info-panel` makes sense. Reuse the `stat-card-clickable` class and `data-throughput-key` attribute name exactly as-is — every card sharing that attribute is picked up automatically by the existing `querySelectorAll('.stat-card-clickable')` click handler.
5. **`src/report/html-report-renderer.ts` (client JS)** — add one entry to the `throughputLabels` map (`yourKey: 'Human-Readable Label'`) so the "Tickets — filtered by X" subtitle reads correctly. That's the only client-JS change needed — `getThroughputKeySet()`, `updateIssuesTable()`, and the click handler already operate generically off `data-throughput-key` against `throughputIssueKeys[sprintId]`.
6. Run the `build-and-test` skill.

This is exactly how QA/UAT Return Rate card filtering was added on top of the pre-existing Throughput card filtering in this codebase — same mechanism, one new key each.
