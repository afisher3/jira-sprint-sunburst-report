/**
 * AppConfig — the typed configuration object used throughout the application.
 * Constructed by ConfigLoader after validation.
 */

export interface TargetClassification {
  level1: string;
  level2: string;
  percentage: number;
}

export interface AppConfig {
  jira: {
    baseUrl: string;
    boardId: number;
    storyPointsFieldId: string;
    classificationFieldId: string;
    qaFailCountFieldId: string;
    uatFailCountFieldId: string;
    authType: 'oauth';
    // OAuth credentials from env, never in YAML
    clientId: string;
    clientSecret: string;
  };
  window: {
    closed: number;
    future: number;
  };
  report: {
    showEmptyCategories: boolean;
    targetClassifications: TargetClassification[];
  };
  output: {
    type: 'local' | 'confluence';
    path?: string;
  };
  logLevel: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
}
