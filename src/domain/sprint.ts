/**
 * Sprint — domain model for Jira sprint metadata.
 * Minimal data needed for window selection and display.
 */
export interface Sprint {
  id: number;
  name: string;
  state: 'active' | 'closed' | 'future';
  startDate?: string; // ISO 8601 date string
  endDate?: string;   // ISO 8601 date string
  completeDate?: string; // ISO 8601 date string (only for closed sprints)
}
