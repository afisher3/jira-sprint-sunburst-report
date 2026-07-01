import { describe, it, expect } from 'vitest';
import { MetricAggregator } from '../src/domain/metric-aggregator.js';
import type { Issue } from '../src/domain/issue.js';

describe('MetricAggregator', () => {
    it('should aggregate QA fail counts correctly', () => {
        const issues: Issue[] = [
            { key: 'PROJ-1', summary: 'Task 1', storyPoints: 5, classification: { level1: 'App Dev', level2: 'New Feature' }, qaFailCount: 2 },
            { key: 'PROJ-2', summary: 'Task 2', storyPoints: 3, classification: { level1: 'App Dev', level2: 'New Feature' }, qaFailCount: 1 },
            { key: 'PROJ-3', summary: 'Task 3', storyPoints: 2, classification: { level1: 'App Dev', level2: 'Bug Fix' }, qaFailCount: 0 },
            { key: 'PROJ-4', summary: 'Task 4', storyPoints: 4, classification: { level1: 'Infrastructure', level2: 'Maintenance' }, qaFailCount: 3 }
        ];

        const result = MetricAggregator.aggregate(issues).qaFailSum;

        expect(result).toBe(6); // 2 + 1 + 0 + 3
    });
    it('should return 0 for empty issue list', () => {
        const issues: Issue[] = [];

        const result = MetricAggregator.aggregate(issues).qaFailSum;

        expect(result).toBe(0);
    });
    it('should return 0 when all issues have 0 QA fail counts', () => {
        const issues: Issue[] = [
            { key: 'PROJ-1', summary: 'Task 1', storyPoints: 5, classification: { level1: 'App Dev', level2: 'New Feature' }, qaFailCount: 0 },
            { key: 'PROJ-2', summary: 'Task 2', storyPoints: 3, classification: { level1: 'App Dev', level2: 'New Feature' }, qaFailCount: 0 }
        ];

        const result = MetricAggregator.aggregate(issues).qaFailSum;

        expect(result).toBe(0);
    });
    it('should handle one issue with a QA fail count', () => {
        const issues: Issue[] = [
            { key: 'PROJ-1', summary: 'Task 1', storyPoints: 5, classification: { level1: 'App Dev', level2: 'New Feature' }, qaFailCount: 4 }
        ];

        const result = MetricAggregator.aggregate(issues).qaFailSum;

        expect(result).toBe(4);
    });
});