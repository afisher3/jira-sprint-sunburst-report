/**
 * MetricDataset — Plotly-compatible data structure for metrics data.
 */
export interface MetricDataset {
    qaFailCount: number;  // Total number of issues that failed QA in this sprint
    uatFailCount: number; // Total number of issues that failed UAT in this sprint
    qaReturnRate: number; // QA return rate (qaFailCount / pastQASum) * 100
    uatReturnRate: number; // UAT return rate (uatFailCount / pastUATSum) * 100
}