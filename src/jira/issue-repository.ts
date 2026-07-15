import type { Logger } from 'pino';
import type { JiraClient } from './jira-client.js';
import type { Issue } from '../domain/issue.js';
import { ClassificationParser } from '../domain/classification-parser.js';

interface JiraIssue {
  key: string;
  fields: Record<string, unknown>;
}

interface JiraSearchResponse {
  issues: JiraIssue[];
  nextPageToken?: string;
}

/**
 * IssueRepository — fetches issues for a sprint from Jira and maps to domain model.
 * Uses the platform search API with nextPageToken pagination.
 */
export class IssueRepository {
  constructor(
    private readonly client: JiraClient,
    private readonly storyPointsFieldId: string,
    private readonly classificationFieldId: string,
    private readonly logger: Logger
  ) {}

  /**
   * Fetch all issues for a specific sprint.
   * @param sprintId - The sprint ID to fetch issues for
   * @returns Array of issues with story points and classification
   */
  async fetchBySprint(sprintId: number): Promise<Issue[]> {
    this.logger.info({ sprintId }, 'Fetching issues for sprint');

    const jql = `sprint = ${sprintId}`;
    const fields = ['key', 'summary', 'status', this.storyPointsFieldId, this.classificationFieldId, this.qaFailCountFieldId, this.uatFailCountFieldId];

    const allIssues: Issue[] = [];
    let nextPageToken: string | undefined = undefined;
    let pageCount = 0;

    while (true) {
      pageCount++;

      const response = await this.client.searchJql<JiraSearchResponse>(
        jql,
        fields,
        nextPageToken
      );

      this.logger.info("Jira response has " + response.issues.length + " issues")
      // Debug: log raw response structure for first page
      if (pageCount === 1 && response.issues && response.issues.length > 0) {
        const firstIssue = response.issues[0];
        const classValue = firstIssue.fields?.[this.classificationFieldId];
        this.logger.info({
          sprintId,
          sampleKey: firstIssue.key,
          fieldKeys: Object.keys(firstIssue.fields || {}),
          storyPointsValue: firstIssue.fields?.[this.storyPointsFieldId],
          classificationValue: classValue,
          classificationValueType: typeof classValue,
          classificationValueJson: JSON.stringify(classValue)
        }, 'Sample issue structure from API');
      }

      const mappedIssues = response.issues.map(issue => this.mapIssue(issue));
      allIssues.push(...mappedIssues);

      this.logger.debug({
        sprintId,
        page: pageCount,
        retrieved: mappedIssues.length,
        total: allIssues.length,
        hasNextPage: !!response.nextPageToken
      }, 'Issue batch retrieved');

      if (!response.nextPageToken) {
        break;
      }

      nextPageToken = response.nextPageToken;
    }

    this.logger.info({
      sprintId,
      total: allIssues.length,
      totalStoryPoints: allIssues.reduce((sum, i) => sum + i.storyPoints, 0)
    }, 'Issues fetched for sprint');

    return allIssues;
  }

  async fetchThroughputBySprintStage(sprintId: number, toStatus: string): Promise<number> {
    // Fetch the count of issues that transitioned to a specific status in the last 30 days for a given sprint
    const jql = `sprint = ${sprintId} AND Status changed to "${toStatus}" after -30d`;
    let nextPageToken: string | undefined = undefined;
    let throughputCount = 0;

    while (true) {

      const response = await this.client.searchJql<JiraSearchResponse>(
        jql,
        ['key', 'status'],
        nextPageToken
      );

      // Debug: log raw response
      //this.logger.info("Throughput Count: " + response.issues.length);

      throughputCount += response.issues.length;

      if (!response.nextPageToken) {
        break;
      }

      nextPageToken = response.nextPageToken;
    }
    return throughputCount;
  }

  async fetchCountPastStatus(sprintId: number, status: string): Promise<number>{
    // Fetch the count of issues that have passed a certain status in the last 30 days for a given sprint
    const jql = `sprint = ${sprintId} AND Status WAS "${status}" AFTER -30d`;
    let nextPageToken: string | undefined = undefined;
    let issueCount = 0;

    while (true){
      const response = await this.client.searchJql<JiraSearchResponse>(
        jql,
        ['key'],
        nextPageToken
      );

      issueCount += response.issues.length;
      
      if (!response.nextPageToken){
        break;
      }
      nextPageToken = response.nextPageToken;
      }
      return issueCount;
    }

    async fetchReturnCount(sprintId: number, status: string): Promise<number>{
      //Fetch the count of issues that have been reopened in the past 30 days
      const jql = `sprint = ${sprintId} AND Status CHANGED from "${status}" TO "reopened"`
      let nextPageToken: string | undefined = undefined;
      let issueCount = 0;
      while (true){
        const response = await this.client.searchJql<JiraSearchResponse>(
          jql,
          ['key'],
          nextPageToken
        );

        issueCount += response.issues.length;
        
        if (!response.nextPageToken){
          break;
        }
        nextPageToken = response.nextPageToken;
      }
      if (issueCount == 0){
        this.logger.info(`No issues found that were reopened after ${status}`)
      }
      return issueCount;
    }
  

  private mapIssue(jiraIssue: JiraIssue): Issue {
    const fields = jiraIssue.fields;

    // Extract story points (default to 0 if not set)
    const storyPointsRaw = fields[this.storyPointsFieldId];
    const storyPoints = typeof storyPointsRaw === 'number' ? storyPointsRaw : 0;

    // Extract and parse classification
    // Can be string (CSV export) or object (cascading select from API)
    const classificationRaw = fields[this.classificationFieldId];
    const classification = ClassificationParser.parse(classificationRaw as any);

    // Extract summary
    const summary = typeof fields.summary === 'string' ? fields.summary : '';

    let status = '';
    const statusRaw = fields.status as { name?: string } | undefined;

    if (statusRaw && statusRaw.name !== undefined) {
      status = statusRaw.name;
    }

    return {
      key: jiraIssue.key,
      summary,
      status,
      storyPoints,
      classification
    };
  }
}
