/**
 * StageSummaryDataset — per-sprint ticket counts by workflow stage.
 * Each count (except totalIssues) is the number of issues that transitioned
 * into that status at some point during the sprint, not just issues
 * currently sitting in it.
 */
export interface StageSummaryDataset {
  totalIssues: number;
  refinedCount: number;
  readyForDevCount: number;
  readyForTestingCount: number;
  readyForUatCount: number;
  resolvedCount: number;
  closedCount: number;
  reopenedCount: number;
}
