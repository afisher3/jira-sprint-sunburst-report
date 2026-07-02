import type { Logger } from 'pino';
import type { AppConfig } from '../config/app-config.js';
import { HtmlReportRenderer } from '../report/html-report-renderer.js';
import type { ReportModel } from '../report/report-model.js';
import type { OutputTarget } from '../report/output/output-target.js';
import { JiraClient } from '../jira/jira-client.js';
import { SprintRepository } from '../jira/sprint-repository.js';
import { IssueRepository } from '../jira/issue-repository.js';
import { SunburstAggregator } from '../domain/sunburst-aggregator.js';
import { MetricAggregator } from '../domain/metric-aggregator.js';
import { TargetSunburstGenerator } from '../domain/target-sunburst-generator.js';

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
    private readonly output: OutputTarget,
    private readonly logger: Logger
  ) {
    this.renderer = new HtmlReportRenderer(logger.child({ component: 'HtmlReportRenderer' }));

    // Wire up Jira client and repositories
    this.jiraClient = new JiraClient(
      config.jira.baseUrl,
      config.jira.clientId,
      config.jira.clientSecret,
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
      config.jira.qaFailCountFieldId,
      config.jira.uatFailCountFieldId,
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
    const metricDatasets = new Map();

    for (const sprint of windowedSprints) {
      const issues = await this.issueRepo.fetchBySprint(sprint.id);
      const dataset = SunburstAggregator.aggregate(
        issues,
        this.config.report.showEmptyCategories
      );
      const metricDataset = MetricAggregator.aggregate(issues)

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

    // Write to output
    await this.output.write(html, 'jira-sunburst-report');

    this.logger.info('Report generation complete');
  }
}
