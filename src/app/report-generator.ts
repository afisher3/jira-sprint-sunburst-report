import type { Logger } from 'pino';
import type { AppConfig } from '../config/app-config.js';
import { HtmlReportRenderer } from '../report/html-report-renderer.js';
import type { ReportModel } from '../report/report-model.js';
import { JiraClient } from '../jira/jira-client.js';
import { SprintRepository } from '../jira/sprint-repository.js';
import { IssueRepository } from '../jira/issue-repository.js';
import { SunburstAggregator } from '../domain/sunburst-aggregator.js';
import { MetricDataset } from '../domain/metric-dataset.js';
import { TargetSunburstGenerator } from '../domain/target-sunburst-generator.js';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

/**
 * ReportGenerator — orchestrates the entire report generation flow.
 * Milestone 3: full flow with issues, classification, aggregation, and sunburst rendering.
 */
export class ReportGenerator {
  private readonly renderer: HtmlReportRenderer;
  private readonly jiraClient: JiraClient;
  private readonly sprintRepo: SprintRepository;
  private readonly issueRepo: IssueRepository;

  constructor(
    private readonly config: AppConfig,
    private readonly logger: Logger
  ) {
    this.renderer = new HtmlReportRenderer(logger.child({ component: 'HtmlReportRenderer' }));

    // Validate configuration
    if (!config.jira.baseUrl){
      throw new Error("Jira URL not loaded into config");
    }
    if (!config.jira.clientId){
      throw new Error("Jira Client ID not loaded into config");
    }
    if (!config.jira.clientSecret){
      throw new Error("Jira Client Secret not loaded into config");
    }
    // Wire up Jira client and repositories
    this.jiraClient = new JiraClient(
      config.jira.baseUrl.trim(),
      config.jira.clientId.trim(),
      config.jira.clientSecret.trim(),
      logger.child({ component: 'JiraClient' })
    );

    this.sprintRepo = new SprintRepository(
      this.jiraClient,
      config.jira.boardId,
      logger.child({ component: 'SprintRepository' })
    );

    this.issueRepo = new IssueRepository(
      this.jiraClient,
      config.jira.storyPointsFieldId,
      config.jira.classificationFieldId,
      logger.child({ component: 'IssueRepository' })
    );
  }

  /**
   * Generate and write the report.
   * Milestone 3: full flow with issues, classification, aggregation, and sunburst rendering.
   */
  async generate(): Promise<void> {
    this.logger.info('Starting report generation');

    // Discover all sprints on the board
    const allSprints = await this.sprintRepo.discoverSprints();

    // Select the window
    const windowedSprints = this.sprintRepo.selectWindow(
      allSprints,
      this.config.window.closed,
      this.config.window.future
    );

    this.logger.info({ sprintCount: windowedSprints.length }, 'Fetching issues for windowed sprints');

    // Fetch issues for each sprint and build sunburst datasets
    const datasets = new Map();
    const metricDatasets = new Map<number,MetricDataset>();

    for (const sprint of windowedSprints) {
      const issues = await this.issueRepo.fetchBySprint(sprint.id);
      const dataset = SunburstAggregator.aggregate(
        issues,
        this.config.report.showEmptyCategories
      );
  
      // Fetch data for metrics
      const [qaFailCount,
        uatFailCount,
        pastQACount,
        pastUATCount,
        refinementThroughput,
        devThroughput,
        testingThroughput,
        uatSignoffThroughput] = await Promise.all([
        this.issueRepo.fetchReturnCountQA(sprint.id, this.config.jira.qaFailCountFieldId),
        this.issueRepo.fetchReturnCountUAT(sprint.id, this.config.jira.uatFailCountFieldId),
        this.issueRepo.fetchCountPastQA(sprint.id),
        this.issueRepo.fetchCountPastUAT(sprint.id),
        this.issueRepo.fetchThroughputBySprintStage(sprint.id, this.config.jira.lastStatusOfRefinement),
        this.issueRepo.fetchDevThroughput(sprint.id),
        this.issueRepo.fetchThroughputBySprintStage(sprint.id,this.config.jira.lastStatusOfQA),
        this.issueRepo.fetchThroughputBySprintStage(sprint.id, this.config.jira.lastStatusOfUAT)
      ]);

      const metricDataset = new MetricDataset(
        qaFailCount,
        uatFailCount,
        pastQACount,
        pastUATCount,
        refinementThroughput,
        devThroughput,
        testingThroughput,
        uatSignoffThroughput
      );

      datasets.set(sprint.id, dataset);
      metricDatasets.set(sprint.id, metricDataset);

      this.logger.info({
        sprintId: sprint.id,
        sprintName: sprint.name,
        issueCount: issues.length,
        totalStoryPoints: dataset.values.reduce((sum, v) => sum + v, 0),
        categoriesCount: dataset.ids.length
      }, 'Sprint data aggregated');
    }

    // Generate target sunburst if configured
    const targetDataset = this.config.report.targetClassifications.length > 0
      ? TargetSunburstGenerator.generate(this.config.report.targetClassifications)
      : undefined;

    if (targetDataset) {
      this.logger.info({
        targetCategories: targetDataset.ids.length,
        totalPercentage: targetDataset.values.reduce((sum, v) => sum + v, 0)
      }, 'Target sunburst generated');
    }

    // Build report model
    const model: ReportModel = {
      title: 'Jira Sprint Sunburst Report',
      generatedAt: new Date().toISOString(),
      boardId: this.config.jira.boardId,
      sprints: windowedSprints,
      datasets,
      metricDatasets,
      targetDataset
    };

    this.logger.debug({ sprintCount: windowedSprints.length }, 'Report model created');

    // Render to HTML
    const html = this.renderer.render(model);

    // Write to S3
    const s3Client = new S3Client({});
    const bucketName = process.env.BUCKET_NAME;

    if (!bucketName){
      throw new Error("BUCKET_NAME environment variable not set");
    }

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: "metrics-report",
      Body:html,
      ContentType:"text/html",
      ContentDisposition:"inline"
    })

    try{
      await s3Client.send(command);
      this.logger.info("Uploaded to S3");
    } catch(error){
      throw new Error("Failed to upload report to S3")
    }

    this.logger.info('Report generation complete');
  }
}
