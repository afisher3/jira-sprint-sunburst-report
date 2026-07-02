import { describe, it, expect } from 'vitest';
import { MetricAggregator } from '../src/domain/metric-aggregator.js';
import type { Issue } from '../src/domain/issue.js';

describe('MetricAggregator', () => {
    it('should correctly count issues that failed QA', () => {
        const issues: Issue[] = [
            { key: 'PROJ-1', summary: 'Task 1', status: 'Ready for UAT', storyPoints: 5, classification: { level1: 'App Dev', level2: 'New Feature' }, qaFailCount: 2, uatFailCount: 0 },
            { key: 'PROJ-2', summary: 'Task 2', status: 'In Progress', storyPoints: 3, classification: { level1: 'App Dev', level2: 'New Feature' }, qaFailCount: 1, uatFailCount: 0 },
            { key: 'PROJ-3', summary: 'Task 3', status: 'In UAT', storyPoints: 2, classification: { level1: 'App Dev', level2: 'Bug Fix' }, qaFailCount: 0, uatFailCount: 0 },
            { key: 'PROJ-4', summary: 'Task 4', status: 'In Progress', storyPoints: 4, classification: { level1: 'Infrastructure', level2: 'Maintenance' }, qaFailCount: 0, uatFailCount: 0 }
        ];

        const result = MetricAggregator.aggregate(issues).qaFailCount;

        expect(result).toBe(2); // 2 issues have failed QA
    });

    it('should correctly count issues that failed UAT', () => {
        const issues: Issue[] = [
            { key: 'PROJ-1', summary: 'Task 1', status: 'Ready for UAT', storyPoints: 5, classification: { level1: 'App Dev', level2: 'New Feature' }, qaFailCount: 0, uatFailCount: 1 },
            { key: 'PROJ-2', summary: 'Task 2', status: 'In Progress', storyPoints: 3, classification: { level1: 'App Dev', level2: 'New Feature' }, qaFailCount: 0, uatFailCount: 2 },
            { key: 'PROJ-3', summary: 'Task 3', status: 'In UAT', storyPoints: 2, classification: { level1: 'App Dev', level2: 'Bug Fix' }, qaFailCount: 0, uatFailCount: 0 },
            { key: 'PROJ-4', summary: 'Task 4', status: 'In Progress', storyPoints: 4, classification: { level1: 'Infrastructure', level2: 'Maintenance' }, qaFailCount: 0, uatFailCount: 3 }
        ];

        const result = MetricAggregator.aggregate(issues).uatFailCount;

        expect(result).toBe(3); //3 issues have failed UAT 
    });

    it('should not double count repeated QA failures for the same issue', () => {
        const issues: Issue[] = [
            { key: 'PROJ-1', summary: 'Task 1', status: 'Ready for UAT', storyPoints: 5, classification: { level1: 'App Dev', level2: 'New Feature' }, qaFailCount: 3, uatFailCount: 0 },
            { key: 'PROJ-2', summary: 'Task 2', status: 'In Progress', storyPoints: 3, classification: { level1: 'App Dev', level2: 'New Feature' }, qaFailCount: 0, uatFailCount: 0 }
        ];

        const result = MetricAggregator.aggregate(issues).qaFailCount;

        expect(result).toBe(1); // Only one issue has failed QA, even though it failed multiple times
    });

    it('should not double count repeated UAT failures for the same issue', () => {
        const issues: Issue[] = [
            { key: 'PROJ-1', summary: 'Task 1', status: 'Ready for UAT', storyPoints: 5, classification: { level1: 'App Dev', level2: 'New Feature' }, qaFailCount: 0, uatFailCount: 4 },
            { key: 'PROJ-2', summary: 'Task 2', status: 'In Progress', storyPoints: 3, classification: { level1: 'App Dev', level2: 'New Feature' }, qaFailCount: 0, uatFailCount: 0 }
        ];

        const result = MetricAggregator.aggregate(issues).uatFailCount;

        expect(result).toBe(1); // Only one issue has failed UAT, even though it failed multiple times
    });

    it('should return 0 for qaFailCount when issue list is empty', () => {
        const issues: Issue[] = [];
        const result = MetricAggregator.aggregate(issues).qaFailCount;
        expect(result).toBe(0);
    });

    it('should return 0 for uatFailCount when issue list is empty', () => {
        const issues: Issue[] = [];
        const result = MetricAggregator.aggregate(issues).uatFailCount;
        expect(result).toBe(0);
    });

    it('should return 0 for qaFailCount when all issues have 0 QA fail counts', () => {
        const issues: Issue[] = [
            { key: 'PROJ-1', summary: 'Task 1', status: 'Ready for UAT', storyPoints: 5, classification: { level1: 'App Dev', level2: 'New Feature' }, qaFailCount: 0, uatFailCount: 2 },
            { key: 'PROJ-2', summary: 'Task 2', status: 'In Progress', storyPoints: 3, classification: { level1: 'App Dev', level2: 'New Feature' }, qaFailCount: 0, uatFailCount: 0 }
        ];

        const result = MetricAggregator.aggregate(issues).qaFailCount;

        expect(result).toBe(0);
    }); 

    it('should return 0 for uatFailCount when all issues have 0 UAT fail counts', () => {
        const issues: Issue[] = [
            { key: 'PROJ-1', summary: 'Task 1', status: 'Ready for UAT', storyPoints: 5, classification: { level1: 'App Dev', level2: 'New Feature' }, qaFailCount: 2, uatFailCount: 0 },
            { key: 'PROJ-2', summary: 'Task 2', status: 'In Progress', storyPoints: 3, classification: { level1: 'App Dev', level2: 'New Feature' }, qaFailCount: 0, uatFailCount: 0 }
        ];

        const result = MetricAggregator.aggregate(issues).uatFailCount;

        expect(result).toBe(0);
    });

    it('should handle one issue with a QA fail count', () => {
        const issues: Issue[] = [
            { key: 'PROJ-1', summary: 'Task 1', status: 'Ready for UAT', storyPoints: 5, classification: { level1: 'App Dev', level2: 'New Feature' }, qaFailCount: 4, uatFailCount: 0 }
        ];

        const result = MetricAggregator.aggregate(issues).qaFailCount;

        expect(result).toBe(1);
    });

    it('should handle one issue with a UAT fail count', () => {
        const issues: Issue[] = [
            { key: 'PROJ-1', summary: 'Task 1', status: 'Ready for UAT', storyPoints: 5, classification: { level1: 'App Dev', level2: 'New Feature' }, qaFailCount: 0, uatFailCount: 3 }
        ];

        const result = MetricAggregator.aggregate(issues).uatFailCount;

        expect(result).toBe(1);
    });

    it('should correctly calculate QA Return Rate', () => {
        const issues: Issue[] = [
            { key: 'PROJ-1', summary: 'Task 1', status: 'Ready for UAT', storyPoints: 5, classification: { level1: 'App Dev', level2: 'New Feature' }, qaFailCount: 2, uatFailCount: 0 },
            { key: 'PROJ-2', summary: 'Task 2', status: 'Ready for UAT', storyPoints: 3, classification: { level1: 'App Dev', level2: 'New Feature' }, qaFailCount: 1, uatFailCount: 0 },
            { key: 'PROJ-3', summary: 'Task 3', status: 'In UAT', storyPoints: 2, classification: { level1: 'App Dev', level2: 'Bug Fix' }, qaFailCount: 0, uatFailCount: 0 }
        ];
        const result = MetricAggregator.aggregate(issues).qaReturnRate;
        expect(result).toBe(66.67); // 2 issues failed QA / 3 issues past QA
    });

    it('should correctly calculate UAT Return Rate', () => {
        const issues: Issue[] = [
            { key: 'PROJ-1', summary: 'Task 1', status: 'Resolved', storyPoints: 5, classification: { level1: 'App Dev', level2: 'New Feature' }, qaFailCount: 0, uatFailCount: 2 },
            { key: 'PROJ-2', summary: 'Task 2', status: 'Closed', storyPoints: 3, classification: { level1: 'App Dev', level2: 'New Feature' }, qaFailCount: 0, uatFailCount: 1 },
            { key: 'PROJ-3', summary: 'Task 3', status: 'Resolved', storyPoints: 2, classification: { level1: 'App Dev', level2: 'Bug Fix' }, qaFailCount: 0, uatFailCount: 0 }
        ];
        const result = MetricAggregator.aggregate(issues).uatReturnRate;
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
        expect(result.qaFailCount).toBe(2);
        expect(result.qaReturnRate).toBe(66.67); // 2 issues failed QA / 3 issues past QA
    });

    it('should return 0 for QA Return Rate when no issues are past QA', () => {
        const issues: Issue[] = [
            { key: 'PROJ-1', summary: 'Task 1', status: 'In Progress', storyPoints: 5, classification: { level1: 'App Dev', level2: 'New Feature' }, qaFailCount: 0, uatFailCount: 0 },
            { key: 'PROJ-2', summary: 'Task 2', status: 'In Progress', storyPoints: 3, classification: { level1: 'App Dev', level2: 'New Feature' }, qaFailCount: 0, uatFailCount: 0 }
        ];
        const result = MetricAggregator.aggregate(issues);
        expect(result.qaReturnRate).toBe(0);
    });

    it('should return 0 for UAT Return Rate when no issues are past UAT', () => {
        const issues: Issue[] = [
            { key: 'PROJ-1', summary: 'Task 1', status: 'In Progress', storyPoints: 5, classification: { level1: 'App Dev', level2: 'New Feature' }, qaFailCount: 0, uatFailCount: 0 },
            { key: 'PROJ-2', summary: 'Task 2', status: 'In Testing', storyPoints: 3, classification: { level1: 'App Dev', level2: 'New Feature' }, qaFailCount: 0, uatFailCount: 0 }
        ];
        const result = MetricAggregator.aggregate(issues);
        expect(result.uatReturnRate).toBe(0);
    });

    it('should round correctly to two decimal places for QA Return Rate', () => {
        const issues: Issue[] = [
            { key: 'PROJ-1', summary: 'Task 1', status: 'Ready for UAT', storyPoints: 5, classification: { level1: 'App Dev', level2: 'New Feature' }, qaFailCount: 1, uatFailCount: 0 },
            { key: 'PROJ-2', summary: 'Task 2', status: 'In UAT', storyPoints: 3, classification: { level1: 'App Dev', level2: 'New Feature' }, qaFailCount: 0, uatFailCount: 0 },
            { key: 'PROJ-3', summary: 'Task 3', status: 'Resolved', storyPoints: 2, classification: { level1: 'App Dev', level2: 'Bug Fix' }, qaFailCount: 0, uatFailCount: 0 }
        ];

        const result = MetricAggregator.aggregate(issues);
        expect(result.qaReturnRate).toBe(33.33); // 1 issue failed QA / 3 issues past QA
    });
});