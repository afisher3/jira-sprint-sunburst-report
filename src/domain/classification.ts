/**
 * Classification — two-level taxonomy for issue categorization.
 * Parsed from Jira cascading select field formatted as "Level 1 -> Level 2".
 */
export interface Classification {
  level1: string;  // Top-level category (e.g., "App Dev")
  level2: string;  // Sub-category (e.g., "New Feature")
}
