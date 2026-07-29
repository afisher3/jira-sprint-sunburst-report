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
    const fields = ['key', 'summary', 'status', this.storyPointsFieldId, this.classificationFieldId];

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
          classificationValueJson: JSON.stringify(classValue),
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
    // Fetch the count of issues that transitioned to a specific status for a given sprint
    const jql = `sprint = ${sprintId} AND Status changed to "${toStatus}"`;
    let nextPageToken: string | undefined = undefined;
    //let throughputCount = 0;
    const allIssues: Issue[] = [];

    while (true) {

      const response = await this.client.searchJql<JiraSearchResponse>(
        jql,
        ['key', 'status', this.storyPointsFieldId],
        nextPageToken
      );

      const mappedIssues = response.issues.map(issue => this.mapIssue(issue));
      allIssues.push(...mappedIssues);

      if (!response.nextPageToken) {
        break;
      }

      nextPageToken = response.nextPageToken;
    }
    return allIssues.reduce((sum, i) => sum + i.storyPoints, 0);
  }

    async fetchStatusCountLast30Days(projectKey: string, status: string): Promise<number> {
    // Count of issues in the project that were in the given status at some point in the
    // last 30 days (i.e. transitioned into it), not just issues currently in it. Not scoped
    // to any particular sprint — this is a rolling window, independent of sprint selection.
    const jql = `project = ${projectKey} AND Status changed to "${status}" after -30d`;
    let nextPageToken: string | undefined = undefined;
    let issueCount = 0;

    while (true) {
      const response = await this.client.searchJql<JiraSearchResponse>(
        jql,
        ['key'],
        nextPageToken
      );

      issueCount += response.issues.length;

      if (!response.nextPageToken) {
        break;
      }
      nextPageToken = response.nextPageToken;
    }

    this.logger.info({ projectKey, status, issueCount }, 'Issue count by status change in last 30 days');
    return issueCount;
  }

    async fetchTotalCountLast30Days(projectKey: string): Promise<number> {
    // Count of all issues in the project updated within the last 30 days. A single
    // `updated >= -30d` query can return 500+ issues on a busy project and gets slow, so this
    // is split into three non-overlapping 10-day windows, each fetched separately, then
    // unioned into a set of issue keys (a given issue's `updated` timestamp can only fall into
    // exactly one of these windows, but de-duplicating by key keeps this correct regardless).
    const dayBoundaries = [-30, -20, -10, 0];
    const issueKeys = new Set<string>();

    for (let i = 0; i < dayBoundaries.length - 1; i++) {
      const windowStart = dayBoundaries[i];
      const windowEnd = dayBoundaries[i + 1];
      const jql = windowEnd === 0
        ? `project = ${projectKey} AND updated >= ${windowStart}d`
        : `project = ${projectKey} AND updated >= ${windowStart}d AND updated < ${windowEnd}d`;

      let nextPageToken: string | undefined = undefined;

      while (true) {
        const response = await this.client.searchJql<JiraSearchResponse>(
          jql,
          ['key'],
          nextPageToken
        );

        for (const issue of response.issues) {
          issueKeys.add(issue.key);
        }

        if (!response.nextPageToken) {
          break;
        }
        nextPageToken = response.nextPageToken;
      }
    }

    this.logger.info({ projectKey, issueCount: issueKeys.size }, 'Total issue count in last 30 days');
    return issueKeys.size;
  }

    async fetchDevThroughput(sprintId: number): Promise<number> {
    // Fetch the count of issues that transitioned to a specific status for a given sprint
    const jql = `sprint = ${sprintId} AND status CHANGED FROM ("In Peer Review") TO ("Ready for Testing", "Ready for UAT")`;
    let nextPageToken: string | undefined = undefined;
    //let throughputCount = 0;
    const allIssues: Issue[] = [];

    while (true) {

      const response = await this.client.searchJql<JiraSearchResponse>(
        jql,
        ['key', 'status', this.storyPointsFieldId],
        nextPageToken
      );

      const mappedIssues = response.issues.map(issue => this.mapIssue(issue));
      allIssues.push(...mappedIssues);

      if (!response.nextPageToken) {
        break;
      }

      nextPageToken = response.nextPageToken;
    }

    this.logger.info(`Dev Throughput is ${allIssues.length} issues for sprint ${sprintId}`);
    return allIssues.reduce((sum, i) => sum + i.storyPoints, 0);
  }

  async fetchCountPastQA(sprintId: number): Promise<number>{
    // Fetch the count of issues that have passed testing for a given sprint

    const jql = `sprint = ${sprintId} AND Status CHANGED FROM ("Ready for Testing", "In Testing") TO ("Ready for UAT", "Reopened")`;
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

      this.logger.info({sprintId,issueCount}, "Issues past QA");
      return issueCount;
    }

    async fetchCountPastUAT(sprintId: number): Promise<number>{
      // Fetch the count of issues that have passed UAT in a given sprint
      const jql = `sprint = ${sprintId} AND status CHANGED FROM ("Ready for UAT") TO ("Resolved", "Closed", "Reopened")`;
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

        this.logger.info({sprintId,issueCount}, "Issues past UAT");
        return issueCount;
    }

    async fetchReturnCountQA(sprintId: number, qaFailCountFieldId: string): Promise<number>{
      //Fetch the count of issues that have been reopened
      const jql = `sprint = ${sprintId} AND "QA Fail Count[Number]" > 0`;
      let nextPageToken: string | undefined = undefined;
      let issueCount = 0;
      while (true){
        const response = await this.client.searchJql<JiraSearchResponse>(
          jql,
          ['key',qaFailCountFieldId],
          nextPageToken
        );

        issueCount += response.issues.length;
        
        if (!response.nextPageToken){
          break;
        }
        nextPageToken = response.nextPageToken;
      }
      this.logger.info(`${issueCount} issues found that were reopened after QA in sprint ${sprintId}`)
      
      return issueCount;
    }

    async fetchReturnCountUAT(sprintId: number, uatFailCountFieldId: string): Promise<number>{
      //Fetch the count of issues that have been reopened
      const jql = `sprint = ${sprintId} AND "UAT Fail Count[Number]" > 0`;
      let nextPageToken: string | undefined = undefined;
      let issueCount = 0;
      while (true){
        const response = await this.client.searchJql<JiraSearchResponse>(
          jql,
          ['key',uatFailCountFieldId],
          nextPageToken
        );

        issueCount += response.issues.length;
        
        if (!response.nextPageToken){
          break;
        }
        nextPageToken = response.nextPageToken;
      }
      this.logger.info(`${issueCount} issues found that were reopened after UAT in sprint ${sprintId}`)
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
