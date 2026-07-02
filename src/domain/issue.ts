import type { Classification } from './classification.js';

/**
 * Issue — domain model for Jira issue with story points and classification.
 * Represents the data needed for sunburst & metrics aggregation.
 */
export interface Issue {
  key: string;                    // e.g., "PROJ-123"
  summary: string;                // Issue title
  status: string;                 // Current status (e.g., "In Progress")
  storyPoints: number;            // Story points (0 if not set)
  classification: Classification; // Parsed two-level classification
  qaFailCount: number;            // Number of QA failures (0 if not set)
  uatFailCount: number;           // Number of UAT failures (0 if not set)
}

/**
 * Get display name for an issue (key + summary)
 */
export function getIssueDisplayName(issue: Issue): string {
  return `${issue.key} ${issue.summary}`;
}
