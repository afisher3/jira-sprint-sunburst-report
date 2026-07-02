import type { Sprint } from '../domain/sprint.js';
import type { SunburstDataset } from '../domain/sunburst-dataset.js';
import type { MetricDataset } from '../domain/metric-dataset.js';

/**
 * ReportModel — the data structure passed to HtmlReportRenderer.
 * Milestone 3: includes sprint window list and sunburst datasets per sprint.
 * Enhancement: includes target sunburst for side-by-side comparison.
 */
export interface ReportModel {
  title: string;
  generatedAt: string;
  boardId: number;
  sprints: Sprint[];                               // Windowed sprint list for menu
  datasets: Map<number, SunburstDataset>;          // Sunburst data per sprint ID
  metricDatasets: Map<number, MetricDataset>;       // Metric data per sprint ID
  targetDataset?: SunburstDataset;                 // Target/ideal distribution
}
