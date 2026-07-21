import type { Logger } from 'pino';
import type { ReportModel } from './report-model.js';

/**
 * HtmlReportRenderer — generates the HTML report from a ReportModel.
 * Milestone 3: full Plotly sunburst with sprint menu and client-side switching.
 */
export class HtmlReportRenderer {
  constructor(private readonly logger: Logger) {}

  render(model: ReportModel): string {
    this.logger.debug({ title: model.title }, 'Rendering HTML report');

    // Serialize datasets to JSON for client-side use
    const datasetsJson = this.serializeDatasets(model);
    const targetDatasetJson = model.targetDataset ? JSON.stringify(model.targetDataset) : 'null';
    const metricDatasetsJson = this.serializeMetricsDatasets(model);

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
    }
    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 15px;
      margin-top: 15px;
    }
    .stat-card {
      background: #f4f5f7;
      padding: 15px;
      border-radius: 4px;
      border-left: 4px solid #0052cc;
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

    <div class="controls">
      <h3>Select Sprints to Include:</h3>
      <div class="sprint-list">
        ${sprintCheckboxes}
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
      <h3>Throughput (Past 30 Days)</h3>
      <div class="stats">
        <div class="stat-card">
          <div class="stat-label">Refinement Throughput</div>
          <div class="stat-value" id="refinement-throughput">0</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Dev Throughput</div>
          <div class="stat-value" id="dev-throughput">0</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">QA Throughput</div>
          <div class="stat-value" id="qa-throughput">0</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">UAT Signoff Throughput</div>
          <div class="stat-value" id="uat-throughput">0</div>
        </div>
      </div>
    </div>
    <div class="info-panel">
      <h3>Return Rates (Past 30 Days)</h3>
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
  </div>

  <script>
    // Sprint datasets embedded from server
    const datasets = ${datasetsJson};
    const targetDataset = ${targetDatasetJson};
    const metricDatasets = ${metricDatasetsJson};

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
        qaReturnRate: qaReturnRate,
        uatReturnRate: uatReturnRate
        };
    }

    // Render sunburst chart for aggregated data
    function renderSunburst(aggregatedDataset) {
      if (!aggregatedDataset || aggregatedDataset.ids.length === 0) {
        document.getElementById('sunburst').style.display = 'none';
        document.getElementById('empty-state').style.display = 'block';
        document.getElementById('total-points').textContent = '0';
        document.getElementById('issue-count').textContent = '0';
        document.getElementById('category-count').textContent = '0';
        document.getElementById('dev-throughput').textContent = '0';
        document.getElementById('refinement-throughput').textContent = '0';
        document.getElementById('qa-throughput').textContent = '0';
        document.getElementById('uat-throughput').textContent = '0';
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
      document.getElementById('dev-throughput').textContent = aggregatedDataset.devThroughput;
      document.getElementById('refinement-throughput').textContent = aggregatedDataset.refinementThroughput;
      document.getElementById('qa-throughput').textContent = aggregatedDataset.qaThroughput;
      document.getElementById('uat-throughput').textContent = aggregatedDataset.uatThroughput;
      document.getElementById('qa-return-rate').textContent = aggregatedDataset.qaReturnRate + '%';
      document.getElementById('uat-return-rate').textContent = aggregatedDataset.uatReturnRate + '%';

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

      const colors = generateColors(aggregatedDataset, colorPalette, colorMap);

      // Plotly sunburst
      const data = [{
        type: 'sunburst',
        ids: aggregatedDataset.ids,
        labels: aggregatedDataset.labels,
        parents: aggregatedDataset.parents,
        values: aggregatedDataset.values,
        branchvalues: 'total',
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

      const colorPalette = [
        '#0052cc', '#36b37e', '#ff5630', '#ffab00', '#6554c0',
        '#00b8d9', '#ff8b00', '#00875a', '#5243aa', '#bf2600'
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

      const colors = generateColors(targetDataset, colorPalette, colorMap);

      const data = [{
        type: 'sunburst',
        ids: targetDataset.ids,
        labels: targetDataset.labels,
        parents: targetDataset.parents,
        values: targetDataset.values,
        branchvalues: 'total',
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
        if (colorMap.has(cat)){
          level1ColorMap.set(cat,colorMap.get(cat));
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

    // Handle checkbox changes
    function handleCheckboxChange() {
      const selectedIds = getSelectedSprintIds();
      const aggregatedDataset = aggregateDatasets(selectedIds);
      renderSunburst(aggregatedDataset);
    }

    // Attach event listeners to all checkboxes
    document.querySelectorAll('.sprint-checkbox input[type="checkbox"]').forEach(checkbox => {
      checkbox.addEventListener('change', handleCheckboxChange);
    });

    // Initial render
    const initialSelectedIds = getSelectedSprintIds();
    const initialAggregated = aggregateDatasets(initialSelectedIds);
    renderSunburst(initialAggregated);

    // Render target sunburst (if present)
    if (targetDataset) {
      renderTargetSunburst();
    }
  </script>
</body>
</html>`;

    this.logger.info({ htmlLength: html.length }, 'HTML report rendered');
    return html;
  }

  private serializeDatasets(model: ReportModel): string {
    const datasetsObj: Record<number, unknown> = {};
    for (const [sprintId, dataset] of model.datasets.entries()) {
      datasetsObj[sprintId] = dataset;
    }
    return JSON.stringify(datasetsObj);
  }

  private serializeMetricsDatasets(model: ReportModel): string {
    const datasetsObj: Record<number, unknown> = {};
    for (const [sprintId, dataset] of model.metricDatasets.entries()){
      datasetsObj[sprintId] = dataset;
    }
    return JSON.stringify(datasetsObj);
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
