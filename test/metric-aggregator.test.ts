import { describe, it, expect } from 'vitest';
import { MetricAggregator } from '../src/domain/metric-aggregator.js';
import type { Issue } from '../src/domain/issue.js';

describe('MetricAggregator', () => {
    it('should aggregate QA fail counts correctly', () => {
        const issues: Issue[] = [
            { key: 'PROJ-1', summary: 'Task 1', status: 'Ready for UAT', storyPoints: 5, classification: { level1: 'App Dev', level2: 'New Feature' }, qaFailCount: 2, uatFailCount: 0 },
            { key: 'PROJ-2', summary: 'Task 2', status: 'In Progress', storyPoints: 3, classification: { level1: 'App Dev', level2: 'New Feature' }, qaFailCount: 1, uatFailCount: 0 },
            { key: 'PROJ-3', summary: 'Task 3', status: 'In UAT', storyPoints: 2, classification: { level1: 'App Dev', level2: 'Bug Fix' }, qaFailCount: 0, uatFailCount: 0 },
            { key: 'PROJ-4', summary: 'Task 4', status: 'In Progress', storyPoints: 4, classification: { level1: 'Infrastructure', level2: 'Maintenance' }, qaFailCount: 0, uatFailCount: 0 }
        ];

        const result = MetricAggregator.aggregate(issues).qaFailSum;

        expect(result).toBe(2); // 2 issues have failed QA
    });

    it('should aggregate UAT fail counts correctly', () => {
        const issues: Issue[] = [
            { key: 'PROJ-1', summary: 'Task 1', status: 'Ready for UAT', storyPoints: 5, classification: { level1: 'App Dev', level2: 'New Feature' }, qaFailCount: 0, uatFailCount: 1 },
            { key: 'PROJ-2', summary: 'Task 2', status: 'In Progress', storyPoints: 3, classification: { level1: 'App Dev', level2: 'New Feature' }, qaFailCount: 0, uatFailCount: 2 },
            { key: 'PROJ-3', summary: 'Task 3', status: 'In UAT', storyPoints: 2, classification: { level1: 'App Dev', level2: 'Bug Fix' }, qaFailCount: 0, uatFailCount: 0 },
            { key: 'PROJ-4', summary: 'Task 4', status: 'In Progress', storyPoints: 4, classification: { level1: 'Infrastructure', level2: 'Maintenance' }, qaFailCount: 0, uatFailCount: 3 }
        ];

        const result = MetricAggregator.aggregate(issues).uatFailSum;

        expect(result).toBe(3); //3 issues have failed UAT 
    });

    it('should return 0 for qaFailSum when issue list is empty', () => {
        const issues: Issue[] = [];
        const result = MetricAggregator.aggregate(issues).qaFailSum;
        expect(result).toBe(0);
    });

    it('should return 0 for uatFailSum when issue list is empty', () => {
        const issues: Issue[] = [];
        const result = MetricAggregator.aggregate(issues).uatFailSum;
        expect(result).toBe(0);
    });

    it('should return 0 for qaFailSum when all issues have 0 QA fail counts', () => {
        const issues: Issue[] = [
            { key: 'PROJ-1', summary: 'Task 1', status: 'Ready for UAT', storyPoints: 5, classification: { level1: 'App Dev', level2: 'New Feature' }, qaFailCount: 0, uatFailCount: 2 },
            { key: 'PROJ-2', summary: 'Task 2', status: 'In Progress', storyPoints: 3, classification: { level1: 'App Dev', level2: 'New Feature' }, qaFailCount: 0, uatFailCount: 0 }
        ];

        const result = MetricAggregator.aggregate(issues).qaFailSum;

        expect(result).toBe(0);
    }); 

    it('should return 0 for uatFailSum when all issues have 0 UAT fail counts', () => {
        const issues: Issue[] = [
            { key: 'PROJ-1', summary: 'Task 1', status: 'Ready for UAT', storyPoints: 5, classification: { level1: 'App Dev', level2: 'New Feature' }, qaFailCount: 2, uatFailCount: 0 },
            { key: 'PROJ-2', summary: 'Task 2', status: 'In Progress', storyPoints: 3, classification: { level1: 'App Dev', level2: 'New Feature' }, qaFailCount: 0, uatFailCount: 0 }
        ];

        const result = MetricAggregator.aggregate(issues).uatFailSum;

        expect(result).toBe(0);
    });

    it('should handle one issue with a QA fail count', () => {
        const issues: Issue[] = [
            { key: 'PROJ-1', summary: 'Task 1', status: 'Ready for UAT', storyPoints: 5, classification: { level1: 'App Dev', level2: 'New Feature' }, qaFailCount: 4, uatFailCount: 0 }
        ];

        const result = MetricAggregator.aggregate(issues).qaFailSum;

        expect(result).toBe(1);
    });

    it('should handle one issue with a UAT fail count', () => {
        const issues: Issue[] = [
            { key: 'PROJ-1', summary: 'Task 1', status: 'Ready for UAT', storyPoints: 5, classification: { level1: 'App Dev', level2: 'New Feature' }, qaFailCount: 0, uatFailCount: 3 }
        ];

        const result = MetricAggregator.aggregate(issues).uatFailSum;

        expect(result).toBe(1);
    });

    it('should correctly calculate QA Return Rate', () => {
        const issues: Issue[] = [
            { key: 'PROJ-1', summary: 'Task 1', status: 'Ready for UAT', storyPoints: 5, classification: { level1: 'App Dev', level2: 'New Feature' }, qaFailCount: 2, uatFailCount: 0 },
            { key: 'PROJ-2', summary: 'Task 2', status: 'Ready for UAT', storyPoints: 3, classification: { level1: 'App Dev', level2: 'New Feature' }, qaFailCount: 1, uatFailCount: 0 },
            { key: 'PROJ-3', summary: 'Task 3', status: 'In UAT', storyPoints: 2, classification: { level1: 'App Dev', level2: 'Bug Fix' }, qaFailCount: 0, uatFailCount: 0 }
        ];
        const result = MetricAggregator.aggregate(issues).QAReturnRate;
        expect(result).toBe(66.67); // 2 issues failed QA / 3 issues past QA
    });

    it('should correctly calculate UAT Return Rate', () => {
        const issues: Issue[] = [
            { key: 'PROJ-1', summary: 'Task 1', status: 'Resolved', storyPoints: 5, classification: { level1: 'App Dev', level2: 'New Feature' }, qaFailCount: 0, uatFailCount: 2 },
            { key: 'PROJ-2', summary: 'Task 2', status: 'Closed', storyPoints: 3, classification: { level1: 'App Dev', level2: 'New Feature' }, qaFailCount: 0, uatFailCount: 1 },
            { key: 'PROJ-3', summary: 'Task 3', status: 'Resolved', storyPoints: 2, classification: { level1: 'App Dev', level2: 'Bug Fix' }, qaFailCount: 0, uatFailCount: 0 }
        ];
        const result = MetricAggregator.aggregate(issues).UATReturnRate;
        expect(result).toBe(66.67); // 2 issues failed UAT / 3 issues past UAT
    });

    it('should exclude issues before QA from QA Return Rate calculation', () => {

        //3 issues past QA, 3 QA fails
        const issues: Issue[] = [
            { key: 'PROJ-1', summary: 'Task 1', status: 'In Progress', storyPoints: 5, classification: { level1: 'App Dev', level2: 'New Feature' }, qaFailCount: 2, uatFailCount: 0 },
            { key: 'PROJ-2', summary: 'Task 2', status: 'Ready for UAT', storyPoints: 3, classification: { level1: 'App Dev', level2: 'New Feature' }, qaFailCount: 1, uatFailCount: 0 },
            { key: 'PROJ-3', summary: 'Task 3', status: 'In UAT', storyPoints: 2, classification: { level1: 'App Dev', level2: 'Bug Fix' }, qaFailCount: 0, uatFailCount: 0 },
            { key: 'PROJ-4', summary: 'Task 4', status: 'In Progress', storyPoints: 4, classification: { level1: 'Infrastructure', level2: 'Maintenance' }, qaFailCount: 0, uatFailCount: 0 }
        ];

        const result = MetricAggregator.aggregate(issues);
        expect(result.qaFailSum).toBe(2);
        expect(result.QAReturnRate).toBe(66.67); // 2 issues failed QA / 3 issues past QA
    });

    it('should return 0 for QA Return Rate when no issues are past QA', () => {
        const issues: Issue[] = [
            { key: 'PROJ-1', summary: 'Task 1', status: 'In Progress', storyPoints: 5, classification: { level1: 'App Dev', level2: 'New Feature' }, qaFailCount: 0, uatFailCount: 0 },
            { key: 'PROJ-2', summary: 'Task 2', status: 'In Progress', storyPoints: 3, classification: { level1: 'App Dev', level2: 'New Feature' }, qaFailCount: 0, uatFailCount: 0 }
        ];
        const result = MetricAggregator.aggregate(issues);
        expect(result.QAReturnRate).toBe(0);
    });

    it('should return 0 for UAT Return Rate when no issues are past UAT', () => {
        const issues: Issue[] = [
            { key: 'PROJ-1', summary: 'Task 1', status: 'In Progress', storyPoints: 5, classification: { level1: 'App Dev', level2: 'New Feature' }, qaFailCount: 0, uatFailCount: 0 },
            { key: 'PROJ-2', summary: 'Task 2', status: 'In Testing', storyPoints: 3, classification: { level1: 'App Dev', level2: 'New Feature' }, qaFailCount: 0, uatFailCount: 0 }
        ];
        const result = MetricAggregator.aggregate(issues);
        expect(result.UATReturnRate).toBe(0);
    });
});