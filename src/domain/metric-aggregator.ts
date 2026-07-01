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
        let qaFailSum = 0;

        // Count of issues that failed UAT
        let uatFailSum = 0;

        //Count of issues that have been through QA/UAT
        let pastQASum = 0;
        let pastUATSum = 0;

        for (const issue of issues) {
            if (issue.qaFailCount > 0) {
                qaFailSum++;
                pastQASum++;
            }
            else if (pastQA.includes(issue.status)) {
                pastQASum++;
            }
            if (issue.uatFailCount > 0) {
                uatFailSum++;
                pastUATSum++;
            }
            else if (pastUAT.includes(issue.status)) {
                pastUATSum++;
            }

        }

        const QAReturnRate = Number(((pastQASum > 0 ? qaFailSum / pastQASum : 0)*100).toFixed(2));
        const UATReturnRate = Number(((pastUATSum > 0 ? uatFailSum / pastUATSum : 0)*100).toFixed(2));


        return {
            qaFailSum,
            uatFailSum,
            QAReturnRate,
            UATReturnRate
        };
    }
}