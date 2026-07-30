import type { Sprint } from '../domain/sprint.js';
import type { SunburstDataset } from '../domain/sunburst-dataset.js';
import type { MetricDataset } from '../domain/metric-dataset.js';
import type { StageSummaryDataset } from '../domain/stage-summary-dataset.js';
import type { ThroughputIssueKeys } from '../domain/throughput-issue-keys.js';
import type { Issue } from '../domain/issue.js';

/**
 * ReportModel — the data structure passed to HtmlReportRenderer.
 * Milestone 3: includes sprint window list and sunburst datasets per sprint.
 * Enhancement: includes target sunburst for side-by-side comparison.
 */
export interface ReportModel {
  title: string;
  generatedAt: string;
  boardId: number;
  baseUrl: string;                                 // Jira Cloud base URL, for linking issue keys to their Jira page
  sprints: Sprint[];                               // Windowed sprint list for menu
  datasets: Map<number, SunburstDataset>;          // Sunburst data per sprint ID
  metricDatasets: Map<number, MetricDataset>;       // Metric data per sprint ID
  issuesBySprint: Map<number, Issue[]>;             // Full issue list per sprint ID (for the tickets table)
  throughputIssueKeysBySprint: Map<number, ThroughputIssueKeys>; // Issue keys backing each throughput card, per sprint ID
  stageSummaryDataset: StageSummaryDataset;        // Rolling 30-day stage ticket counts (not sprint-scoped)
  targetDataset?: SunburstDataset;                 // Target/ideal distribution
}
