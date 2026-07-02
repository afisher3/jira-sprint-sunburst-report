import { describe, it, expect, beforeEach } from 'vitest';
import { HtmlReportRenderer } from '../src/report/html-report-renderer.js';
import { LoggerFactory } from '../src/logging/logger-factory.js';
import type { ReportModel } from '../src/report/report-model.js';

describe('HtmlReportRenderer', () => {
  let renderer: HtmlReportRenderer;

  beforeEach(() => {
    LoggerFactory.reset();
    LoggerFactory.init('silent');
    renderer = new HtmlReportRenderer(LoggerFactory.child('HtmlReportRenderer'));
  });

  it('should render HTML with title and sprint checkboxes', () => {
    const model: ReportModel = {
      title: 'Test Report',
      generatedAt: '2025-01-15T10:30:00Z',
      boardId: 42,
      sprints: [
        { id: 1, name: 'Sprint 1', state: 'active', startDate: '2025-01-01', endDate: '2025-01-14' },
        { id: 2, name: 'Sprint 2', state: 'closed', startDate: '2024-12-01', endDate: '2024-12-14', completeDate: '2024-12-14' }
      ],
      datasets: new Map(),
      metricDatasets: new Map()
    };

    const html = renderer.render(model);

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<title>Test Report</title>');
    expect(html).toContain('Sprint 1');
    expect(html).toContain('Sprint 2');
    expect(html).toContain('Board 42');
    expect(html).toContain('sprint-checkbox');
    expect(html).toContain('type="checkbox"');
  });

  it('should display sprint states with emoji indicators', () => {
    const model: ReportModel = {
      title: 'Test Report',
      generatedAt: '2025-01-15T10:30:00Z',
      boardId: 1,
      sprints: [
        { id: 1, name: 'Active Sprint', state: 'active', startDate: '2025-01-01' },
        { id: 2, name: 'Closed Sprint', state: 'closed', startDate: '2024-12-01', completeDate: '2024-12-14' },
        { id: 3, name: 'Future Sprint', state: 'future', startDate: '2025-02-01' }
      ],
      datasets: new Map(),
      metricDatasets: new Map()
    };

    const html = renderer.render(model);

    // Emoji indicators: 🟢 active, ⚫ closed, 🔵 future
    expect(html).toContain('🟢 Active Sprint');
    expect(html).toContain('⚫ Closed Sprint');
    expect(html).toContain('🔵 Future Sprint');
  });

  it('should display info panel with stats', () => {
    const model: ReportModel = {
      title: 'Test Report',
      generatedAt: '2025-01-15T10:30:00Z',
      boardId: 1,
      sprints: [
        { id: 1, name: 'Sprint 1', state: 'active', startDate: '2025-01-01' },
        { id: 2, name: 'Sprint 2', state: 'active', startDate: '2025-01-15' },
        { id: 3, name: 'Sprint 3', state: 'closed', startDate: '2024-12-01', completeDate: '2024-12-14' },
        { id: 4, name: 'Sprint 4', state: 'future', startDate: '2025-02-01' }
      ],
      datasets: new Map(),
      metricDatasets: new Map()
    };

    const html = renderer.render(model);

    // Check for info panel with stats (Milestone 3 structure)
    expect(html).toContain('Sprint Details');
    expect(html).toContain('Total Story Points');
    expect(html).toContain('Issues');
    expect(html).toContain('Categories');
  });

  it('should escape HTML special characters in sprint names', () => {
    const model: ReportModel = {
      title: 'Test Report',
      generatedAt: '2025-01-15T10:30:00Z',
      boardId: 1,
      sprints: [
        { id: 1, name: 'Sprint <script>alert("xss")</script>', state: 'active', startDate: '2025-01-01' }
      ],
      datasets: new Map(),
      metricDatasets: new Map()
    };

    const html = renderer.render(model);

    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&lt;/script&gt;');
    expect(html).not.toContain('<script>alert');
  });

  it('should handle sprints with missing dates', () => {
    const model: ReportModel = {
      title: 'Test Report',
      generatedAt: '2025-01-15T10:30:00Z',
      boardId: 1,
      sprints: [
        { id: 1, name: 'Sprint 1', state: 'future' }
      ],
      datasets: new Map(),
      metricDatasets: new Map()
    };

    const html = renderer.render(model);

    // Should render sprint checkbox even without dates
    expect(html).toContain('Sprint 1');
    expect(html).toContain('sprint-checkbox');
  });

  it('should be valid HTML structure', () => {
    const model: ReportModel = {
      title: 'Test Report',
      generatedAt: '2025-01-15T10:30:00Z',
      boardId: 1,
      sprints: [],
      datasets: new Map(),
      metricDatasets: new Map()
    };

    const html = renderer.render(model);

    expect(html).toMatch(/^<!DOCTYPE html>/);
    expect(html).toContain('<html lang="en">');
    expect(html).toContain('<head>');
    expect(html).toContain('<meta charset="UTF-8">');
    expect(html).toContain('<body>');
    expect(html).toContain('</body>');
    expect(html).toContain('</html>');
  });

  it('should handle empty sprint list', () => {
    const model: ReportModel = {
      title: 'Test Report',
      generatedAt: '2025-01-15T10:30:00Z',
      boardId: 1,
      sprints: [],
      datasets: new Map(),
      metricDatasets: new Map()
    };

    const html = renderer.render(model);

    // Should still render valid HTML with empty state
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('sprint-list');
    expect(html).toContain('sunburst');
  });
});
