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
    const fields = ['key', 'summary', this.storyPointsFieldId, this.classificationFieldId];

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

      // Debug: log raw response structure for first page
      if (pageCount === 1 && response.issues && response.issues.length > 0) {
        const firstIssue = response.issues[0];
        const classValue = firstIssue.fields?.[this.classificationFieldId];
        this.logger.debug({
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

    return {
      key: jiraIssue.key,
      summary,
      storyPoints,
      classification
    };
  }
}
