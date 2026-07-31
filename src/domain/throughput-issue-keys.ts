/**
 * ThroughputIssueKeys — issue keys backing each Throughput stat card for a sprint,
 * used to filter the tickets table when a throughput card is clicked.
 */
export interface ThroughputIssueKeys {
  refinement: string[];
  dev: string[];
  qa: string[];
  uatSignoff: string[];
  qaReturn: string[];
  uatReturn: string[];
  stale: string[];
  rollover: string[];
}
