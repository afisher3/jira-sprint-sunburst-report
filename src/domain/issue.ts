import type { Classification } from './classification.js';

/**
 * Issue — domain model for Jira issue with story points and classification.
 * Represents the data needed for sunburst aggregation.
 */
export interface Issue {
  key: string;                    // e.g., "PROJ-123"
  summary: string;                // Issue title
  storyPoints: number;            // Story points (0 if not set)
  classification: Classification; // Parsed two-level classification
}

/**
 * Get display name for an issue (key + summary)
 */
export function getIssueDisplayName(issue: Issue): string {
  return `${issue.key} ${issue.summary}`;
}
