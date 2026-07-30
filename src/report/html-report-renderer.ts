import type { Logger } from 'pino';
import type { ReportModel } from './report-model.js';
import { ReportDataSerializer } from './report-data-serializer.js';

/**
 * HtmlReportRenderer — generates the HTML report from a ReportModel.
 * Milestone 3: full Plotly sunburst with sprint menu and client-side switching.
 */
export class HtmlReportRenderer {
  constructor(private readonly logger: Logger) {}

  render(model: ReportModel): string {
    this.logger.debug({ title: model.title }, 'Rendering HTML report');

    // Serialize datasets to JSON for client-side use
    const datasetsJson = ReportDataSerializer.serializeDatasets(model);
    const targetDatasetJson = ReportDataSerializer.serializeTargetDataset(model);
    const metricsDatasetsJson = ReportDataSerializer.serializeMetricsDatasets(model);
    const stageSummaryDatasetJson = ReportDataSerializer.serializeStageSummaryDataset(model);
    const issuesBySprintJson = ReportDataSerializer.serializeIssuesBySprint(model);
    const throughputIssueKeysJson = ReportDataSerializer.serializeThroughputIssueKeys(model);
    const sprintNamesJson = ReportDataSerializer.serializeSprintNames(model);
    const baseUrlJson = ReportDataSerializer.serializeBaseUrl(model);

    // Generate sprint checkboxes
    const sprintCheckboxes = model.sprints.map((sprint, index) => {
      const stateBadge = sprint.state === 'active' ? '🟢' : sprint.state === 'closed' ? '⚫' : '🔵';
      const checked = index === 0 ? 'checked' : ''; // Check first sprint by default
      return `
        <div class="sprint-checkbox">
          <input type="checkbox" id="sprint-${sprint.id}" value="${sprint.id}" ${checked}>
          <label for="sprint-${sprint.id}">${stateBadge} ${this.escapeHtml(sprint.name)}</label>
        </div>`;
    }).join('\n        ');

    // Determine if we have target data
    const hasTarget = model.targetDataset !== undefined && model.targetDataset.ids.length > 0;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.escapeHtml(model.title)}</title>
  <script src="https://cdn.plot.ly/plotly-2.27.0.min.js"></script>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: #fafbfc;
      color: #333;
      padding: 20px;
    }
    .container {
      max-width: 1400px;
      margin: 0 auto;
    }
    header {
      background: #fff;
      padding: 20px 30px;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      margin-bottom: 20px;
    }
    h1 {
      color: #0052cc;
      font-size: 28px;
      margin-bottom: 8px;
    }
    .subtitle {
      color: #6b778c;
      font-size: 14px;
    }
    .controls {
      background: #fff;
      padding: 20px 30px;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      margin-bottom: 20px;
    }
    .controls h3 {
      margin-bottom: 15px;
      color: #172b4d;
      font-size: 16px;
    }
    .sprint-list {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 10px;
    }
    .sprint-checkbox {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .sprint-checkbox input[type="checkbox"] {
      width: 18px;
      height: 18px;
      cursor: pointer;
    }
    .sprint-checkbox label {
      font-size: 14px;
      color: #172b4d;
      cursor: pointer;
      user-select: none;
    }
    .charts-grid {
      display: grid;
      grid-template-columns: ${hasTarget ? '1fr 1fr' : '1fr'};
      gap: 20px;
      margin-bottom: 20px;
    }
    .chart-container {
      background: #fff;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      min-height: 600px;
    }
    .chart-container h3 {
      margin-bottom: 15px;
      color: #172b4d;
      font-size: 16px;
      text-align: center;
    }
    .sunburst-chart {
      width: 100%;
      height: 700px;
    }
    .info-panel {
      background: #fff;
      padding: 20px 30px;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      margin-top: 20px;
      margin-bottom: 20px;
    }
    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 15px;
      margin-top: 15px;
    }
    .stats-4col {
      grid-template-columns: repeat(4, 1fr);
    }
    .stat-card {
      background: #f4f5f7;
      padding: 15px;
      border-radius: 4px;
      border-left: 4px solid #0052cc;
    }
    .stat-card-clickable {
      cursor: pointer;
      transition: background 0.15s ease;
    }
    .stat-card-clickable:hover {
      background: #eaecf0;
    }
    .stat-card-clickable.active {
      background: #dfe8fc;
      border-left-color: #172b4d;
    }
    .table-container {
      margin-top: 15px;
      border: 1px solid #dfe1e6;
      border-radius: 8px;
      overflow: hidden;
      overflow-x: auto;
    }
    .issues-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
    }
    .issues-table th,
    .issues-table td {
      text-align: left;
      padding: 10px 16px;
      white-space: nowrap;
    }
    .issues-table thead th {
      background: #f4f5f7;
      color: #44546f;
      text-transform: uppercase;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.03em;
      border-bottom: 2px solid #dfe1e6;
    }
    .issues-table tbody td {
      border-bottom: 1px solid #ebecf0;
      color: #172b4d;
    }
    .issues-table tbody tr:last-child td {
      border-bottom: none;
    }
    .issues-table tbody tr:nth-child(even) {
      background: #fafbfc;
    }
    .issues-table tbody tr:hover {
      background: #eef4ff;
    }
    .issues-table td.summary-cell {
      white-space: normal;
      max-width: 480px;
    }
    .issues-table td.key-cell {
      font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', monospace;
      font-weight: 600;
    }
    .issues-table td.key-cell a {
      color: #0052cc;
      text-decoration: none;
    }
    .issues-table td.key-cell a:hover {
      text-decoration: underline;
    }
    .issues-table th.points-col,
    .issues-table td.points-cell {
      text-align: right;
      font-variant-numeric: tabular-nums;
      font-weight: 600;
    }
    .issues-table th[data-sort-key] {
      cursor: pointer;
      user-select: none;
    }
    .issues-table th[data-sort-key]:hover {
      background: #eaecf0;
    }
    .issues-table th.sort-active {
      color: #0052cc;
    }
    .sort-indicator {
      display: inline-block;
      width: 10px;
      margin-left: 4px;
      font-size: 10px;
      color: #0052cc;
    }
    .accordion-toggle {
      display: flex;
      align-items: center;
      gap: 8px;
      background: none;
      border: none;
      padding: 0;
      margin: 0 0 12px 0;
      font-size: 16px;
      font-weight: 600;
      color: #172b4d;
      cursor: pointer;
      font-family: inherit;
    }
    .accordion-toggle:hover {
      color: #0052cc;
    }
    .accordion-chevron {
      display: inline-block;
      color: #6b778c;
      font-size: 30px;
      transition: transform 0.15s ease;
    }
    .accordion-toggle[aria-expanded="false"] .accordion-chevron {
      transform: rotate(-90deg);
    }
    .status-badge {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
      white-space: nowrap;
    }
    .status-badge-done {
      background: #e3fcef;
      color: #006644;
    }
    .status-badge-blocked {
      background: #ffebe6;
      color: #bf2600;
    }
    .status-badge-progress {
      background: #deebff;
      color: #0052cc;
    }
    .status-badge-neutral {
      background: #f4f5f7;
      color: #42526e;
    }
    .stat-label {
      font-size: 12px;
      color: #6b778c;
      text-transform: uppercase;
      font-weight: 600;
      margin-bottom: 5px;
    }
    .stat-value {
      font-size: 24px;
      font-weight: 700;
      color: #172b4d;
    }
    .stat-value-unit {
      font-size: 12px;
      font-weight: 400;
      color: #6b778c;
    }
    .stats-subtitle {
      font-size: 12px;
      font-weight: 400;
      color: #6b778c;
    }
    .info-panel h4 {
      margin-top: 6px;
      font-size: 16px;
      font-weight: 400;
      color: #6b778c;
    }
    .empty-state {
      text-align: center;
      padding: 60px 20px;
      color: #6b778c;
    }
    .empty-state h2 {
      color: #172b4d;
      margin-bottom: 10px;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>${this.escapeHtml(model.title)}</h1>
      <p class="subtitle">Board ${model.boardId} • Generated ${new Date(model.generatedAt).toLocaleString("en-US",{timeZone: "America/New_York",timeZoneName:"short"})}</p>
    </header>

    <div class="info-panel">
      <h3>Last 30 Days Summary</h3>
      <h4>Ticket counts across the whole project for the rolling last 30 days: how many tickets moved into each workflow stage, plus the total number touched overall — independent of which sprints are selected below.</h4>
      <div class="stats stats-4col">
        <div class="stat-card">
          <div class="stat-label">Total Tickets</div>
          <div class="stat-value" id="stage-total-tickets">0</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Refined</div>
          <div class="stat-value" id="stage-refined-count">0</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Ready for Dev</div>
          <div class="stat-value" id="stage-ready-for-dev-count">0</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Ready for Testing</div>
          <div class="stat-value" id="stage-ready-for-testing-count">0</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Ready for UAT</div>
          <div class="stat-value" id="stage-ready-for-uat-count">0</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Resolved</div>
          <div class="stat-value" id="stage-resolved-count">0</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Closed</div>
          <div class="stat-value" id="stage-closed-count">0</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Reopened</div>
          <div class="stat-value" id="stage-reopened-count">0</div>
        </div>
      </div>
    </div>

    <div class="controls">
      <h3>Select Sprints to Include:</h3>
      <div class="sprint-list">
        ${sprintCheckboxes}
      </div>
    </div>

    <div class="info-panel">
      <h3>Sprint Details</h3>
      <div class="stats">
        <div class="stat-card">
          <div class="stat-label">Total Story Points</div>
          <div class="stat-value" id="total-points">0</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Issues</div>
          <div class="stat-value" id="issue-count">0</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Categories</div>
          <div class="stat-value" id="category-count">0</div>
        </div>
      </div>
    </div>

    <div class="info-panel">
      <h3>Throughput</h3>
      <h4>Ticket count (sum of story points). Click a card to filter the ticket table below to the issues behind that number.</h4>
      <div class="stats">
        <div class="stat-card stat-card-clickable" data-throughput-key="refinement">
          <div class="stat-label">Refinement Throughput</div>
          <div class="stat-value" id="refinement-throughput">0</div>
        </div>
        <div class="stat-card stat-card-clickable" data-throughput-key="dev">
          <div class="stat-label">Dev Throughput</div>
          <div class="stat-value" id="dev-throughput">0</div>
        </div>
        <div class="stat-card stat-card-clickable" data-throughput-key="qa">
          <div class="stat-label">QA Throughput</div>
          <div class="stat-value" id="qa-throughput">0</div>
        </div>
        <div class="stat-card stat-card-clickable" data-throughput-key="uatSignoff">
          <div class="stat-label">UAT Signoff Throughput</div>
          <div class="stat-value" id="uat-throughput">0</div>
        </div>
      </div>
    </div>

    <div class="info-panel">
      <button type="button" class="accordion-toggle" id="tickets-toggle" aria-expanded="true" aria-controls="tickets-body">
        <span class="accordion-chevron">&#9662;</span>
        <span id="tickets-toggle-expanded-text">Tickets<span id="tickets-count-label"></span></span>
        <span id="tickets-toggle-collapsed-text" style="display: none;">Table of issues</span>
      </button>
      <div id="tickets-body">
        <h4 class="stats-subtitle" id="tickets-filter-label"></h4>
        <div class="table-container">
          <table class="issues-table">
            <thead>
              <tr>
                <th data-sort-key="key">Issue<span class="sort-indicator"></span></th>
                <th data-sort-key="summary">Summary<span class="sort-indicator"></span></th>
                <th class="points-col" data-sort-key="storyPoints">Story Points<span class="sort-indicator"></span></th>
                <th data-sort-key="status">Status<span class="sort-indicator"></span></th>
                <th data-sort-key="sprintName">Sprint<span class="sort-indicator"></span></th>
              </tr>
            </thead>
            <tbody id="issues-table-body"></tbody>
          </table>
          <p class="empty-state" id="issues-table-empty" style="display: none;">No tickets to show.</p>
        </div>
      </div>
    </div>

    <div class="info-panel">
      <h3>Return Rates</h3>
      <div class="stats">
        <div class="stat-card">
          <div class="stat-label">QA Return Rate</div>
          <div class="stat-value" id="qa-return-rate">0</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">UAT Return Rate</div>
          <div class="stat-value" id="uat-return-rate">0</div>
        </div>
      </div>
    </div>

    <div class="charts-grid">
      <div class="chart-container">
        <h3>Actual Distribution</h3>
        <div id="sunburst" class="sunburst-chart"></div>
        <div id="empty-state" class="empty-state" style="display: none;">
          <h2>No Data Available</h2>
          <p>Select at least one sprint with story points assigned.</p>
        </div>
      </div>
      ${hasTarget ? `
      <div class="chart-container">
        <h3>Target Distribution</h3>
        <div id="target-sunburst" class="sunburst-chart"></div>
      </div>
      ` : ''}
    </div>
  </div>

  <script>
    // Sprint datasets embedded from server
    const datasets = ${datasetsJson};
    const targetDataset = ${targetDatasetJson};
    const metricDatasets = ${metricsDatasetsJson};
    // Rolling 30-day figures, independent of sprint checkbox selection — rendered once below.
    const stageSummaryDataset = ${stageSummaryDatasetJson};
    // Full issue list per sprint (key, summary, status, storyPoints) backing the tickets table.
    const issuesBySprint = ${issuesBySprintJson};
    // Issue keys behind each Throughput card, per sprint — used to filter the tickets table.
    const throughputIssueKeys = ${throughputIssueKeysJson};
    const sprintNames = ${sprintNamesJson};
    const jiraBaseUrl = ${baseUrlJson};

    // Generate colors: each level 1 category gets a distinct color, level 2 children get lighter shades
      const colorPalette = [
        '#0052cc', // Blue
        '#36b37e', // Green
        '#ff5630', // Red
        '#ffab00', // Yellow
        '#6554c0', // Purple
        '#00b8d9', // Cyan
        '#ff8b00', // Orange
        '#00875a', // Teal
        '#5243aa', // Indigo
        '#bf2600'  // Dark Red
      ];

      // Assign known categories colors
      const colorMap = new Map([
        ['App Dev', '#0052cc'],
        ['Ops', '#36b37e'],
        ['Security', '#ff5630'],
        ['Infrastructure', '#ffab00'],
        ['Knowledge Management', '#6554c0'],
        ['Documentation', '#00b8d9'],
        ['Testing', '#ff8b00']
      ]);


    // Aggregate multiple sprint datasets into one combined dataset
    function aggregateDatasets(sprintIds) {
      if (sprintIds.length === 0) {
        return null;
      }

      // Collect all datasets for selected sprints
      const selectedDatasets = sprintIds
        .map(id => datasets[id])
        .filter(ds => ds && ds.ids.length > 0);
      
      // Collect metrics datasets for selected sprints
      const selectedMetricDatasets = sprintIds
        .map(id => metricDatasets[id])
        .filter(ds => ds);

      if (selectedDatasets.length === 0) {
        return null;
      }

      // Build a map to aggregate values by (level1, level2)
      const aggregationMap = new Map();
      let totalIssueCount = 0;
      let totalDevThroughput = 0;
      let totalRefinementThroughput = 0;
      let totalQAThroughput = 0;
      let totalUATThroughput = 0;
      let totalQAFailCount = 0;
      let totalUATFailCount = 0;
      let totalPastQACount = 0;
      let totalPastUATCount = 0;
      let totalDevThroughputCount = 0;
      let totalRefinementThroughputCount = 0;
      let totalQAThroughputCount = 0;
      let totalUATThroughputCount = 0;

      for (const dataset of selectedDatasets) {
        totalIssueCount += dataset.issueCount;
        // Process each node in the dataset
        for (let i = 0; i < dataset.ids.length; i++) {
          const id = dataset.ids[i];
          const label = dataset.labels[i];
          const parent = dataset.parents[i];
          const value = dataset.values[i];

          const key = id; // IDs are already stable across sprints

          if (aggregationMap.has(key)) {
            aggregationMap.get(key).value += value;
          } else {
            aggregationMap.set(key, {
              id,
              label,
              parent,
              value
            });
          }
        }
      }
      
      for (const metricDataset of selectedMetricDatasets){
        totalDevThroughput += metricDataset.devThroughput;
        totalRefinementThroughput += metricDataset.refinementThroughput;
        totalQAThroughput += metricDataset.testingThroughput;
        totalUATThroughput += metricDataset.uatSignoffThroughput;
        totalQAFailCount += metricDataset.qaFailCount;
        totalUATFailCount += metricDataset.uatFailCount;
        totalPastQACount += metricDataset.pastQACount;
        totalPastUATCount += metricDataset.pastUATCount;
      }

      // Ticket counts behind each throughput number, sourced from the same issue-key lists
      // used to filter the tickets table when a throughput card is clicked.
      for (const sprintId of sprintIds) {
        const keys = throughputIssueKeys[sprintId];
        if (!keys) continue;
        totalRefinementThroughputCount += (keys.refinement || []).length;
        totalDevThroughputCount += (keys.dev || []).length;
        totalQAThroughputCount += (keys.qa || []).length;
        totalUATThroughputCount += (keys.uatSignoff || []).length;
      }

      // Convert map back to arrays
      const ids = [];
      const labels = [];
      const parents = [];
      const values = [];

      // Sort by parent first (level 1 first, then level 2)
      const entries = Array.from(aggregationMap.values());
      const level1Entries = entries.filter(e => e.parent === '');
      const level2Entries = entries.filter(e => e.parent !== '');

      for (const entry of level1Entries) {
        ids.push(entry.id);
        labels.push(entry.label);
        parents.push(entry.parent);
        values.push(entry.value);
      }

      for (const entry of level2Entries) {
        ids.push(entry.id);
        labels.push(entry.label);
        parents.push(entry.parent);
        values.push(entry.value);
      }

      const qaReturnRate = totalPastQACount > 0 ? Number(((totalQAFailCount / totalPastQACount) * 100).toFixed(2)) : 0;
      const uatReturnRate = totalPastUATCount > 0 ? Number(((totalUATFailCount / totalPastUATCount) * 100).toFixed(2)) : 0;

      return {
        ids,
        labels,
        parents,
        values,
        issueCount: totalIssueCount,
        devThroughput: totalDevThroughput,
        refinementThroughput: totalRefinementThroughput,
        qaThroughput: totalQAThroughput,
        uatThroughput: totalUATThroughput,
        devThroughputCount: totalDevThroughputCount,
        refinementThroughputCount: totalRefinementThroughputCount,
        qaThroughputCount: totalQAThroughputCount,
        uatThroughputCount: totalUATThroughputCount,
        qaReturnRate: qaReturnRate,
        uatReturnRate: uatReturnRate
        };
    }

    // Render sunburst chart for aggregated data
    // Renders "<count> (<points>) pts" with "pts" as smaller subtext
    function setThroughputValue(elementId, count, points) {
      document.getElementById(elementId).innerHTML =
        count + ' tickets (' + points + ' pts )';
    }

    function renderSunburst(aggregatedDataset) {
      if (!aggregatedDataset || aggregatedDataset.ids.length === 0) {
        document.getElementById('sunburst').style.display = 'none';
        document.getElementById('empty-state').style.display = 'block';
        document.getElementById('total-points').textContent = '0';
        document.getElementById('issue-count').textContent = '0';
        document.getElementById('category-count').textContent = '0';
        setThroughputValue('dev-throughput', 0, 0);
        setThroughputValue('refinement-throughput', 0, 0);
        setThroughputValue('qa-throughput', 0, 0);
        setThroughputValue('uat-throughput', 0, 0);
        document.getElementById('qa-return-rate').textContent = '0';
        document.getElementById('uat-return-rate').textContent = '0';
        return;
      }

      document.getElementById('sunburst').style.display = 'block';
      document.getElementById('empty-state').style.display = 'none';

      // Calculate total story points (sum of level 1 values)
      const totalPoints = aggregatedDataset.values
        .filter((_, i) => aggregatedDataset.parents[i] === '')
        .reduce((sum, val) => sum + val, 0);

      // Count level 2 categories (non-root nodes)
      const categoryCount = aggregatedDataset.ids.filter((_, i) => aggregatedDataset.parents[i] !== '').length;

      // Update stats
      document.getElementById('total-points').textContent = totalPoints.toFixed(1);
      document.getElementById('issue-count').textContent = aggregatedDataset.issueCount;
      document.getElementById('category-count').textContent = categoryCount;
      // innerHTML is safe here — every interpolated value is a number, never free text
      setThroughputValue('dev-throughput', aggregatedDataset.devThroughputCount, aggregatedDataset.devThroughput);
      setThroughputValue('refinement-throughput', aggregatedDataset.refinementThroughputCount, aggregatedDataset.refinementThroughput);
      setThroughputValue('qa-throughput', aggregatedDataset.qaThroughputCount, aggregatedDataset.qaThroughput);
      setThroughputValue('uat-throughput', aggregatedDataset.uatThroughputCount, aggregatedDataset.uatThroughput);
      document.getElementById('qa-return-rate').textContent = aggregatedDataset.qaReturnRate + '%';
      document.getElementById('uat-return-rate').textContent = aggregatedDataset.uatReturnRate + '%';

      const colors = generateColors(aggregatedDataset, colorPalette, colorMap);

      // Plotly sunburst
      const data = [{
        type: 'sunburst',
        ids: aggregatedDataset.ids,
        labels: aggregatedDataset.labels,
        parents: aggregatedDataset.parents,
        values: aggregatedDataset.values,
        branchvalues: 'total',
        sort: false,
        marker: {
          colors: colors,
          line: { width: 2, color: '#fff' }
        },
        hovertemplate: '<b>%{label}</b><br>Story Points: %{value}<br><extra></extra>',
        textinfo: 'label+percent parent'
      }];

      const layout = {
        margin: { t: 10, l: 10, r: 10, b: 10 },
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: {
          family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          size: 12
        }
      };

      const config = {
        responsive: true,
        displayModeBar: true,
        displaylogo: false,
        modeBarButtonsToRemove: ['lasso2d', 'select2d']
      };

      Plotly.newPlot('sunburst', data, layout, config);
    }

    // Render target sunburst (static, never changes)
    function renderTargetSunburst() {
      if (!targetDataset || targetDataset.ids.length === 0) {
        return;
      }

      const colors = generateColors(targetDataset, colorPalette, colorMap);

      const data = [{
        type: 'sunburst',
        ids: targetDataset.ids,
        labels: targetDataset.labels,
        parents: targetDataset.parents,
        values: targetDataset.values,
        branchvalues: 'total',
        sort: false,  // don't automatically sort by the largest section so both charts can be in the same order
        marker: {
          colors: colors,
          line: { width: 2, color: '#fff' }
        },
        hovertemplate: '<b>%{label}</b><br>Percentage: %{value}%<br><extra></extra>',
        textinfo: 'label+percent parent'
      }];

      const layout = {
        margin: { t: 10, l: 10, r: 10, b: 10 },
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: {
          family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          size: 12
        }
      };

      const config = {
        responsive: true,
        displayModeBar: true,
        displaylogo: false,
        modeBarButtonsToRemove: ['lasso2d', 'select2d']
      };

      Plotly.newPlot('target-sunburst', data, layout, config);
    }

    // Helper function to generate colors for a dataset
    function generateColors(dataset, colorPalette, colorMap) {
      const colors = [];
      const level1Categories = dataset.ids.filter((_, i) => dataset.parents[i] === '');
      const level1ColorMap = new Map();

      level1Categories.forEach((cat, idx) => {
        label = dataset.label;
        cat = cat.trim();
        if (colorMap.has(label)){
          level1ColorMap.set(cat,colorMap.get(label));
        } else {
          level1ColorMap.set(cat, colorPalette[idx % colorPalette.length]);
        }
      });

      // Assign colors to all nodes
      dataset.ids.forEach((id, i) => {
        const parent = dataset.parents[i];
        if (parent === '') {
          // Level 1 - use base color
          colors.push(level1ColorMap.get(id));
        } else {
          // Level 2 - use lighter shade of parent's color
          const baseColor = level1ColorMap.get(parent);
          // Convert hex to RGB and lighten
          const r = parseInt(baseColor.slice(1, 3), 16);
          const g = parseInt(baseColor.slice(3, 5), 16);
          const b = parseInt(baseColor.slice(5, 7), 16);
          // Lighten by blending with white (factor 0.4)
          const lighten = (c) => Math.round(c + (255 - c) * 0.4);
          const lightColor = \`rgb(\${lighten(r)}, \${lighten(g)}, \${lighten(b)})\`;
          colors.push(lightColor);
        }
      });

      return colors;
    }

    // Get currently selected sprint IDs
    function getSelectedSprintIds() {
      const checkboxes = document.querySelectorAll('.sprint-checkbox input[type="checkbox"]:checked');
      return Array.from(checkboxes).map(cb => parseInt(cb.value));
    }

    // Throughput card labels, used for the "Tickets — filtered by X" subtitle
    const throughputLabels = {
      refinement: 'Refinement Throughput',
      dev: 'Dev Throughput',
      qa: 'QA Throughput',
      uatSignoff: 'UAT Signoff Throughput'
    };

    let activeThroughputFilter = null;

    // Flatten issuesBySprint for the given sprint IDs, tagging each issue with its sprint name
    function getIssuesForSprints(sprintIds) {
      const rows = [];
      for (const sprintId of sprintIds) {
        const issues = issuesBySprint[sprintId];
        if (!issues) continue;
        for (const issue of issues) {
          rows.push(Object.assign({}, issue, { sprintName: sprintNames[sprintId] || sprintId }));
        }
      }
      return rows;
    }

    // Union the issue keys for a throughput stat across the given sprint IDs
    function getThroughputKeySet(sprintIds, throughputKey) {
      const keySet = new Set();
      for (const sprintId of sprintIds) {
        const keys = throughputIssueKeys[sprintId];
        if (!keys) continue;
        for (const key of keys[throughputKey] || []) {
          keySet.add(key);
        }
      }
      return keySet;
    }

    function buildJiraIssueUrl(issueKey) {
      return jiraBaseUrl + '/browse/' + issueKey;
    }

    // Bucket a Jira status string into a badge color — a heuristic since status names are
    // org-defined free text (and may be localized), not a fixed enum.
    function statusBadgeClass(status) {
      const s = (status || '').toLowerCase();
      if (/(resolved|closed|done|已解决|已关闭)/.test(s)) return 'status-badge-done';
      if (/(block|reopen)/.test(s)) return 'status-badge-blocked';
      if (/(progress|testing|review|refin|ready|正在进行)/.test(s)) return 'status-badge-progress';
      return 'status-badge-neutral';
    }

    // Column sort state for the tickets table — persists across filter/sprint-selection changes
    let sortColumn = null;
    let sortDirection = 'asc';

    function sortIssueRows(issueRows) {
      if (!sortColumn) return issueRows;
      const sorted = issueRows.slice().sort((a, b) => {
        const av = a[sortColumn];
        const bv = b[sortColumn];
        if (typeof av === 'number' && typeof bv === 'number') return av - bv;
        return String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: 'base' });
      });
      return sortDirection === 'asc' ? sorted : sorted.reverse();
    }

    function updateSortIndicators() {
      document.querySelectorAll('.issues-table th[data-sort-key]').forEach(th => {
        const isActive = th.dataset.sortKey === sortColumn;
        th.classList.toggle('sort-active', isActive);
        th.querySelector('.sort-indicator').textContent = isActive ? (sortDirection === 'asc' ? '▲' : '▼') : '';
      });
    }

    document.querySelectorAll('.issues-table th[data-sort-key]').forEach(th => {
      th.addEventListener('click', () => {
        const key = th.dataset.sortKey;
        sortDirection = sortColumn === key && sortDirection === 'asc' ? 'desc' : 'asc';
        sortColumn = key;
        updateSortIndicators();
        updateIssuesTable();
      });
    });

    // Render the tickets table body from a list of issue rows (DOM APIs, not innerHTML,
    // so issue summaries/statuses from Jira never get interpreted as markup)
    function renderIssuesTable(issueRows) {
      const tbody = document.getElementById('issues-table-body');
      const emptyState = document.getElementById('issues-table-empty');
      document.getElementById('tickets-count-label').textContent = ' - ' + issueRows.length;
      tbody.innerHTML = '';

      if (issueRows.length === 0) {
        emptyState.style.display = 'block';
        return;
      }
      emptyState.style.display = 'none';

      for (const issue of sortIssueRows(issueRows)) {
        const row = document.createElement('tr');

        const keyCell = document.createElement('td');
        keyCell.className = 'key-cell';
        const keyLink = document.createElement('a');
        keyLink.href = buildJiraIssueUrl(issue.key);
        keyLink.target = '_blank';
        keyLink.rel = 'noopener noreferrer';
        keyLink.textContent = issue.key;
        keyCell.appendChild(keyLink);
        row.appendChild(keyCell);

        const summaryCell = document.createElement('td');
        summaryCell.className = 'summary-cell';
        summaryCell.textContent = issue.summary;
        row.appendChild(summaryCell);

        const pointsCell = document.createElement('td');
        pointsCell.className = 'points-cell';
        pointsCell.textContent = issue.storyPoints;
        row.appendChild(pointsCell);

        const statusCell = document.createElement('td');
        const statusBadge = document.createElement('span');
        statusBadge.className = 'status-badge ' + statusBadgeClass(issue.status);
        statusBadge.textContent = issue.status;
        statusCell.appendChild(statusBadge);
        row.appendChild(statusCell);

        const sprintCell = document.createElement('td');
        sprintCell.textContent = issue.sprintName;
        row.appendChild(sprintCell);

        tbody.appendChild(row);
      }
    }

    // Recompute and render the tickets table based on selected sprints + active throughput filter
    function updateIssuesTable() {
      const selectedIds = getSelectedSprintIds();
      const filterLabel = document.getElementById('tickets-filter-label');

      document.querySelectorAll('.stat-card-clickable').forEach(card => {
        card.classList.toggle('active', card.dataset.throughputKey === activeThroughputFilter);
      });

      if (!activeThroughputFilter) {
        filterLabel.textContent = '';
        renderIssuesTable(getIssuesForSprints(selectedIds));
        return;
      }

      filterLabel.textContent = '— filtered by ' + throughputLabels[activeThroughputFilter];
      const keySet = getThroughputKeySet(selectedIds, activeThroughputFilter);
      const filteredRows = getIssuesForSprints(selectedIds).filter(issue => keySet.has(issue.key));
      renderIssuesTable(filteredRows);
    }

    // Handle throughput card clicks — clicking the active card again clears the filter
    document.querySelectorAll('.stat-card-clickable').forEach(card => {
      card.addEventListener('click', () => {
        const key = card.dataset.throughputKey;
        activeThroughputFilter = activeThroughputFilter === key ? null : key;
        updateIssuesTable();
      });
    });

    // Handle checkbox changes
    function handleCheckboxChange() {
      const selectedIds = getSelectedSprintIds();
      const aggregatedDataset = aggregateDatasets(selectedIds);
      renderSunburst(aggregatedDataset);
      updateIssuesTable();
    }

    // Attach event listeners to all checkboxes
    document.querySelectorAll('.sprint-checkbox input[type="checkbox"]').forEach(checkbox => {
      checkbox.addEventListener('change', handleCheckboxChange);
    });

    // Tickets section collapse/expand toggle
    const ticketsToggle = document.getElementById('tickets-toggle');
    const ticketsBody = document.getElementById('tickets-body');
    const ticketsExpandedText = document.getElementById('tickets-toggle-expanded-text');
    const ticketsCollapsedText = document.getElementById('tickets-toggle-collapsed-text');
    ticketsToggle.addEventListener('click', () => {
      const expanded = ticketsToggle.getAttribute('aria-expanded') === 'true';
      ticketsToggle.setAttribute('aria-expanded', String(!expanded));
      ticketsBody.style.display = expanded ? 'none' : '';
      ticketsExpandedText.style.display = expanded ? 'none' : '';
      ticketsCollapsedText.style.display = expanded ? '' : 'none';
    });

    // Initial render
    const initialSelectedIds = getSelectedSprintIds();
    const initialAggregated = aggregateDatasets(initialSelectedIds);
    renderSunburst(initialAggregated);
    updateIssuesTable();

    // Render target sunburst (if present)
    if (targetDataset) {
      renderTargetSunburst();
    }

    // "Sprint Summary by Stages" is a rolling 30-day figure, unrelated to sprint selection —
    // rendered once here and never touched by handleCheckboxChange.
    document.getElementById('stage-total-tickets').textContent = stageSummaryDataset.totalIssues;
    document.getElementById('stage-refined-count').textContent = stageSummaryDataset.refinedCount;
    document.getElementById('stage-ready-for-dev-count').textContent = stageSummaryDataset.readyForDevCount;
    document.getElementById('stage-ready-for-testing-count').textContent = stageSummaryDataset.readyForTestingCount;
    document.getElementById('stage-ready-for-uat-count').textContent = stageSummaryDataset.readyForUatCount;
    document.getElementById('stage-resolved-count').textContent = stageSummaryDataset.resolvedCount;
    document.getElementById('stage-closed-count').textContent = stageSummaryDataset.closedCount;
    document.getElementById('stage-reopened-count').textContent = stageSummaryDataset.reopenedCount;
  </script>
</body>
</html>`;

    this.logger.info({ htmlLength: html.length }, 'HTML report rendered');
    return html;
  }

  private escapeHtml(unsafe: string | number): string {
    const str = String(unsafe);
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
