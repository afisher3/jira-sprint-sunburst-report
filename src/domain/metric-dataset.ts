/**
 * MetricDataset — Plotly-compatible data structure for metrics data.
 */
export interface MetricDataset {
    qaFailCount: number;  // Total number of issues that failed QA in this sprint
    uatFailCount: number; // Total number of issues that failed UAT in this sprint
    pastQACount: number; // Number of issues that are past QA
    pastUATCount: number; // Number of issues that are past UAT
    refinementThroughput: number; // Total number of issues that have moved to ready for dev Stage in the past 30 days
    devThroughput: number; // Total number of issues that have moved to Ready for Testing Stage in the past 30 days
    testingThroughput: number; // Total number of issues that have moved to Ready for UAT Stage in the past 30 days
    uatSignoffThroughput: number; // Total number of issues that have moved to Resolved Stage in the past 30 days
}