/**
 * SunburstDataset — Plotly-compatible data structure for sunburst chart.
 * Two-level hierarchy: Level 1 (parent = "") and Level 2 (parent = Level 1 id).
 */
export interface SunburstDataset {
  ids: string[];      // Stable IDs (e.g., "AppDev", "AppDev|NewFeature")
  labels: string[];   // Display labels
  parents: string[];  // Parent IDs ("" for level 1, level1 ID for level 2)
  values: number[];   // Story point sums
  issueCount: number; // Total number of issues in this sprint
}
