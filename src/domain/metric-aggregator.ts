import type { Issue } from './issue.js';
import type { MetricDataset } from './metric-dataset.js';

const pastQA = ["Ready for UAT", "In UAT", "Resolved", "Closed"]
const pastUAT = ["Resolved", "Closed"]

export class MetricAggregator {
    /**
     * Aggregate issues into a metric dataset.
     * @param issues - Issues with classifications and story points
     * @returns Plotly metric dataset
     */
    static aggregate(issues: Issue[]): MetricDataset {

        //Count of issues that failed QA
        let qaFailCount = 0;

        // Count of issues that failed UAT
        let uatFailCount = 0;

        //Count of issues that have been through QA/UAT
        let pastQASum = 0;
        let pastUATSum = 0;

        for (const issue of issues) {
            if (issue.qaFailCount > 0) {
                qaFailCount++;
                pastQASum++;
            }
            else if (pastQA.includes(issue.status)) {
                pastQASum++;
            }
            if (issue.uatFailCount > 0) {
                uatFailCount++;
                pastUATSum++;
            }
            else if (pastUAT.includes(issue.status)) {
                pastUATSum++;
            }

        }

        return {
            qaFailCount: qaFailCount,
            uatFailCount: uatFailCount,
            pastQACount: pastQASum,
            pastUATCount: pastUATSum,
            refinementThroughput: -1, //flags if throughput has not been calculated yet, will be updated in report-generator.ts
            devThroughput: -1,
            testingThroughput: -1,
            uatSignoffThroughput: -1  
        };
    }
}