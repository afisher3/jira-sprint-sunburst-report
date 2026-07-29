/**
 * StageSummaryDataset — ticket counts by workflow stage for a sprint.
 */
export interface StageSummaryDataset {
  totalIssues: number;      // Total number of issues in this sprint
  refinedCount: number;     // Number of issues currently in the "Refined" status
  readyForDevCount: number; // Number of issues currently in the "Ready for Dev" status
}
