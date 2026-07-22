import { readFileSync } from 'fs';
import { parse as parseYaml } from 'yaml';
import { ConfigSchema, type ConfigType } from '../../config/schema.js';
import type { JiraKeys } from '../handlers/lambda-handler.js';
import type { AppConfig } from './app-config.js';

/**
 * ConfigLoader — loads and validates YAML config, merges with Jira credentials.
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
    const validatedKeys = validateCredentials(jiraKeys);

    // Build AppConfig
    const appConfig: AppConfig = {
      jira: {
        baseUrl: validatedKeys.base_url,
        boardId: validatedConfig.jira.boardId,
        storyPointsFieldId: validatedConfig.jira.storyPointsFieldId,
        classificationFieldId: validatedConfig.jira.classificationFieldId,
        lastStatusOfRefinement: validatedConfig.jira.lastStatusOfRefinement,
        lastStatusOfDev: validatedConfig.jira.lastStatusOfDev,
        lastStatusOfQA: validatedConfig.jira.lastStatusOfQA,
        lastStatusOfUAT: validatedConfig.jira.lastStatusOfUAT,
        authType: validatedConfig.jira.authType,
        clientId: validatedKeys.client_id,
        clientSecret: validatedKeys.client_secret
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

function validateCredentials(jiraKeys: JiraKeys): JiraKeys {
    // Resolve OAuth credentials from Secrets Manager
    const clientId = jiraKeys.client_id.trim();
    if (!clientId) {
      throw new Error('JIRA_CLIENT_ID not set or not pulled from Secrets Manager');
    }

    const clientSecret = jiraKeys.client_secret.trim();
    if (!clientSecret) {
      throw new Error('JIRA_CLIENT_SECRET not set or not pulled from Secrets Manager');
    }

    const baseUrl = jiraKeys.base_url.trim();
    if (!baseUrl){
      throw new Error('BASE_URL not set or not pulled from Secrets Manager');
    }

    
    if (!URL.canParse(baseUrl)){
      throw new Error('BASE_URL must be a valid URL');
    }

    return {
      client_id: clientId,
      client_secret: clientSecret,
      base_url: baseUrl
    }
  }