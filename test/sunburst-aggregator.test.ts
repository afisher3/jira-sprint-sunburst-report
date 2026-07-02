import { describe, it, expect } from 'vitest';
import { SunburstAggregator } from '../src/domain/sunburst-aggregator.js';
import type { Issue } from '../src/domain/issue.js';

describe('SunburstAggregator', () => {
  it('should aggregate issues by classification and sum story points', () => {
    const issues: Issue[] = [
      { key: 'PROJ-1', summary: 'Task 1', status: 'ready for dev', storyPoints: 5, classification: { level1: 'App Dev', level2: 'New Feature' }, qaFailCount: 0, uatFailCount: 0 },
      { key: 'PROJ-2', summary: 'Task 2', status: 'In UAT', storyPoints: 3, classification: { level1: 'App Dev', level2: 'New Feature' }, qaFailCount: 0, uatFailCount: 0 },
      { key: 'PROJ-3', summary: 'Task 3', status: 'Ready for Peer Review', storyPoints: 2, classification: { level1: 'App Dev', level2: 'Bug Fix' }, qaFailCount: 0, uatFailCount: 0 },
      { key: 'PROJ-4', summary: 'Task 4', status: 'In Progress', storyPoints: 4, classification: { level1: 'Infrastructure', level2: 'Maintenance' }, qaFailCount: 0, uatFailCount: 0 }
    ];

    const dataset = SunburstAggregator.aggregate(issues);

    // Should have 2 level1 + 3 level2 nodes = 5 total
    expect(dataset.ids.length).toBe(5);

    // Level 1 nodes
    expect(dataset.ids).toContain('App Dev');
    expect(dataset.ids).toContain('Infrastructure');

    // Level 2 nodes
    expect(dataset.ids).toContain('App Dev|New Feature');
    expect(dataset.ids).toContain('App Dev|Bug Fix');
    expect(dataset.ids).toContain('Infrastructure|Maintenance');

    // Check story point totals
    const appDevIndex = dataset.ids.indexOf('App Dev');
    expect(dataset.values[appDevIndex]).toBe(10); // 5 + 3 + 2

    const newFeatureIndex = dataset.ids.indexOf('App Dev|New Feature');
    expect(dataset.values[newFeatureIndex]).toBe(8); // 5 + 3

    const bugFixIndex = dataset.ids.indexOf('App Dev|Bug Fix');
    expect(dataset.values[bugFixIndex]).toBe(2);

    const infraIndex = dataset.ids.indexOf('Infrastructure');
    expect(dataset.values[infraIndex]).toBe(4);
  });

  it('should create correct parent-child relationships', () => {
    const issues: Issue[] = [
      { key: 'PROJ-1', summary: 'Task', status: 'In Progress', storyPoints: 5, classification: { level1: 'Security', level2: 'Audit' }, qaFailCount: 0, uatFailCount: 0 }
    ];

    const dataset = SunburstAggregator.aggregate(issues);

    // Level 1 should have empty parent (root)
    const securityIndex = dataset.ids.indexOf('Security');
    expect(dataset.parents[securityIndex]).toBe('');

    // Level 2 should have level1 as parent
    const auditIndex = dataset.ids.indexOf('Security|Audit');
    expect(dataset.parents[auditIndex]).toBe('Security');
  });

  it('should handle empty issue list', () => {
    const dataset = SunburstAggregator.aggregate([]);

    expect(dataset.ids.length).toBe(0);
    expect(dataset.labels.length).toBe(0);
    expect(dataset.parents.length).toBe(0);
    expect(dataset.values.length).toBe(0);
  });

  it('should handle issues with zero story points', () => {
    const issues: Issue[] = [
      { key: 'PROJ-1', summary: 'Task 1', status: 'In Progress', storyPoints: 0, classification: { level1: 'App Dev', level2: 'New Feature' }, qaFailCount: 0, uatFailCount: 0 },
      { key: 'PROJ-2', summary: 'Task 2', status: 'In UAT', storyPoints: 5, classification: { level1: 'App Dev', level2: 'New Feature' }, qaFailCount: 0, uatFailCount: 0 }
    ];

    const dataset = SunburstAggregator.aggregate(issues);

    const newFeatureIndex = dataset.ids.indexOf('App Dev|New Feature');
    expect(dataset.values[newFeatureIndex]).toBe(5); // 0 + 5
  });

  it('should handle unclassified issues', () => {
    const issues: Issue[] = [
      { key: 'PROJ-1', summary: 'Task', status: 'In Progress', storyPoints: 3, classification: { level1: 'Unclassified', level2: 'Unspecified' }, qaFailCount: 0, uatFailCount: 0 }
    ];

    const dataset = SunburstAggregator.aggregate(issues);

    expect(dataset.ids).toContain('Unclassified');
    expect(dataset.ids).toContain('Unclassified|Unspecified');

    const unclassifiedIndex = dataset.ids.indexOf('Unclassified');
    expect(dataset.values[unclassifiedIndex]).toBe(3);
  });

  it('should aggregate multiple issues with same classification', () => {
    const issues: Issue[] = [
      { key: 'PROJ-1', summary: 'Task 1', status: 'In Progress', storyPoints: 2, classification: { level1: 'Test', level2: 'Unit Test' }, qaFailCount: 0, uatFailCount: 0 },
      { key: 'PROJ-2', summary: 'Task 2', status: 'In Peer Review', storyPoints: 3, classification: { level1: 'Test', level2: 'Unit Test' }, qaFailCount: 0, uatFailCount: 0 },
      { key: 'PROJ-3', summary: 'Task 3', status: 'In Testing', storyPoints: 1, classification: { level1: 'Test', level2: 'Unit Test' }, qaFailCount: 0, uatFailCount: 0 }
    ];

    const dataset = SunburstAggregator.aggregate(issues);

    expect(dataset.ids.length).toBe(2); // 1 level1 + 1 level2

    const testIndex = dataset.ids.indexOf('Test');
    expect(dataset.values[testIndex]).toBe(6); // 2 + 3 + 1

    const unitTestIndex = dataset.ids.indexOf('Test|Unit Test');
    expect(dataset.values[unitTestIndex]).toBe(6);
  });

  it('should use correct labels (level2 name, not full path)', () => {
    const issues: Issue[] = [
      { key: 'PROJ-1', summary: 'Task', status: 'In Progress', storyPoints: 5, classification: { level1: 'App Dev', level2: 'New Feature' }, qaFailCount: 0, uatFailCount: 0 }
    ];

    const dataset = SunburstAggregator.aggregate(issues);

    // Level 1 label should be level1
    const appDevIndex = dataset.ids.indexOf('App Dev');
    expect(dataset.labels[appDevIndex]).toBe('App Dev');

    // Level 2 label should be level2 only (not "App Dev|New Feature")
    const newFeatureIndex = dataset.ids.indexOf('App Dev|New Feature');
    expect(dataset.labels[newFeatureIndex]).toBe('New Feature');
  });

  it('should handle multiple level1 categories with subcategories', () => {
    const issues: Issue[] = [
      { key: 'PROJ-1', summary: 'T1', status: 'In Progress', storyPoints: 5, classification: { level1: 'A', level2: 'A1' }, qaFailCount: 0, uatFailCount: 0 },
      { key: 'PROJ-2', summary: 'T2', status: 'In UAT', storyPoints: 3, classification: { level1: 'A', level2: 'A2' }, qaFailCount: 0, uatFailCount: 0 },
      { key: 'PROJ-3', summary: 'T3', status: 'Ready for UAT', storyPoints: 2, classification: { level1: 'B', level2: 'B1' }, qaFailCount: 0, uatFailCount: 0 },
      { key: 'PROJ-4', summary: 'T4', status: 'Resolved', storyPoints: 4, classification: { level1: 'B', level2: 'B2' }, qaFailCount: 0, uatFailCount: 0 },
      { key: 'PROJ-5', summary: 'T5', status: 'In Progress', storyPoints: 1, classification: { level1: 'C', level2: 'C1' }, qaFailCount: 0, uatFailCount: 0 }
    ];

    const dataset = SunburstAggregator.aggregate(issues);

    // 3 level1 + 5 level2 = 8 total
    expect(dataset.ids.length).toBe(8);

    // Check level1 totals
    const aIndex = dataset.ids.indexOf('A');
    expect(dataset.values[aIndex]).toBe(8); // 5 + 3

    const bIndex = dataset.ids.indexOf('B');
    expect(dataset.values[bIndex]).toBe(6); // 2 + 4

    const cIndex = dataset.ids.indexOf('C');
    expect(dataset.values[cIndex]).toBe(1);
  });
});
