import type { Issue } from './issue.js';
import type { MetricDataset } from './metric-dataset.js';

export class MetricAggregator {
    /**
     * Aggregate issues into a metric dataset.
     * @param issues - Issues with classifications and story points
     * @returns Plotly metric dataset
     */
    static aggregate(issues: Issue[]): MetricDataset {
        let qaFailSum = 0;
        for (const issue of issues) {
            qaFailSum+= issue.qaFailCount;
        }
        return {
            qaFailSum
        }
    }
}