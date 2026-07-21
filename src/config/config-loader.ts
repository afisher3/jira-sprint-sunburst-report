import { readFileSync } from 'fs';
import { parse as parseYaml } from 'yaml';
import { ConfigSchema, type ConfigType } from '../../config/schema.js';
import { type JiraKeys } from '../handlers/lambda-handler.js'
import type { AppConfig } from './app-config.js';

/**
 * ConfigLoader — loads and validates YAML config, resolves secrets from the Lambda handler.
 * Fails loudly with clear messages on validation errors or missing secrets.
 */
export class ConfigLoader {
  /**
   * Load configuration from a YAML file path.
   * @param filePath - Absolute or relative path to the YAML config file
   * @returns Validated AppConfig with credentials resolved from jiraKeys
   * @throws Error if file not found, YAML invalid, schema validation fails, or secrets missing
   */
  static load(filePath: string, jiraKeys: JiraKeys): AppConfig {
    let fileContent: string;
    try {
      fileContent = readFileSync(filePath, 'utf-8');
    } catch (error) {
      throw new Error(`Failed to read config file at ${filePath}: ${(error as Error).message}`);
    }

    let rawConfig: unknown;
    try {
      rawConfig = parseYaml(fileContent);
    } catch (error) {
      throw new Error(`Failed to parse YAML in ${filePath}: ${(error as Error).message}`);
    }

    // Validate against Zod schema
    const parseResult = ConfigSchema.safeParse(rawConfig);
    if (!parseResult.success) {
      const errors = parseResult.error.errors.map(e => `  - ${e.path.join('.')}: ${e.message}`).join('\n');
      throw new Error(`Configuration validation failed:\n${errors}`);
    }

    const validatedConfig: ConfigType = parseResult.data;
    validateCredentials(jiraKeys);

    // Build AppConfig
    const appConfig: AppConfig = {
      jira: {
        baseUrl: jiraKeys.base_url.trim(),
        boardId: validatedConfig.jira.boardId,
        storyPointsFieldId: validatedConfig.jira.storyPointsFieldId,
        classificationFieldId: validatedConfig.jira.classificationFieldId,
        lastStatusOfRefinement: validatedConfig.jira.lastStatusOfRefinement,
        lastStatusOfDev: validatedConfig.jira.lastStatusOfDev,
        lastStatusOfQA: validatedConfig.jira.lastStatusOfQA,
        lastStatusOfUAT: validatedConfig.jira.lastStatusOfUAT,
        authType: validatedConfig.jira.authType,
        clientId: jiraKeys.client_id.trim(),
        clientSecret: jiraKeys.client_secret.trim()
      },
      window: {
        closed: validatedConfig.window.closed,
        future: validatedConfig.window.future
      },
      report: {
        showEmptyCategories: validatedConfig.report.showEmptyCategories,
        targetClassifications: validatedConfig.report.targetClassifications
      },
      logLevel: validatedConfig.logLevel
    };

    return appConfig;
  }
}

  function validateCredentials(jiraKeys: JiraKeys): void {
    // Resolve OAuth credentials from Secrets Manager
    const clientId = jiraKeys.client_id;
    if (!clientId || clientId.trim() === '') {
      throw new Error('JIRA_CLIENT_ID not set or not pulled from Secrets Manager');
    }

    const clientSecret = jiraKeys.client_secret;
    if (!clientSecret || clientSecret.trim() === '') {
      throw new Error('JIRA_CLIENT_SECRET not set or not pulled from Secrets Manager');
    }

    if (!jiraKeys.base_url || jiraKeys.base_url.trim()===''){
      throw new Error ('BASE_URL not set or not pulled from Secrets Manager');
    }

    if (!URL.canParse(jiraKeys.base_url)){
      throw new Error('BASE_URL must be a valid URL');
    }
  }
