import type { ReportModel } from './report-model.js';

/**
 * ReportDataSerializer — shapes ReportModel data into the JSON blobs embedded in the
 * generated report's inline <script> tag. Kept separate from HtmlReportRenderer so the
 * renderer stays focused on HTML/CSS/client-JS construction.
 */
export class ReportDataSerializer {
  /**
   * JSON.stringify never escapes "<", so free-text values sourced from Jira (issue summaries,
   * sprint names, classification labels) could contain a literal "</script>" that would
   * prematurely close the report's inline <script> tag when embedded. Escaping "<" to its
   * unicode form neutralizes that while still parsing back to the original string via
   * JSON.parse/a JS literal.
   */
  private static toScriptSafeJson(value: unknown): string {
    return JSON.stringify(value).replace(/</g, '\\u003c');
  }

  static serializeDatasets(model: ReportModel): string {
    const datasetsObj: Record<number, unknown> = {};
    for (const [sprintId, dataset] of model.datasets.entries()) {
      datasetsObj[sprintId] = dataset;
    }
    return this.toScriptSafeJson(datasetsObj);
  }

  static serializeTargetDataset(model: ReportModel): string {
    return model.targetDataset ? this.toScriptSafeJson(model.targetDataset) : 'null';
  }

  static serializeMetricsDatasets(model: ReportModel): string {
    const datasetsObj: Record<number, unknown> = {};
    for (const [sprintId, dataset] of model.metricDatasets.entries()) {
      datasetsObj[sprintId] = dataset;
    }
    return this.toScriptSafeJson(datasetsObj);
  }

  static serializeStageSummaryDataset(model: ReportModel): string {
    return this.toScriptSafeJson(model.stageSummaryDataset);
  }

  static serializeIssuesBySprint(model: ReportModel): string {
    const issuesObj: Record<number, unknown> = {};
    for (const [sprintId, issues] of model.issuesBySprint.entries()) {
      issuesObj[sprintId] = issues;
    }
    return this.toScriptSafeJson(issuesObj);
  }

  static serializeThroughputIssueKeys(model: ReportModel): string {
    const keysObj: Record<number, unknown> = {};
    for (const [sprintId, keys] of model.throughputIssueKeysBySprint.entries()) {
      keysObj[sprintId] = keys;
    }
    return this.toScriptSafeJson(keysObj);
  }

  static serializeSprintNames(model: ReportModel): string {
    const namesObj: Record<number, string> = {};
    for (const sprint of model.sprints) {
      namesObj[sprint.id] = sprint.name;
    }
    return this.toScriptSafeJson(namesObj);
  }
}
