import { readFileSync } from 'fs';
import { parse as parseYaml } from 'yaml';
import { ConfigSchema, type ConfigType } from '../../config/schema.js';
import {type JiraKeys} from '../handlers/lambda-handler.js'
import type { AppConfig } from './app-config.js';

/**
 * ConfigLoader — loads and validates YAML config, resolves secrets from environment.
 * Fails loudly with clear messages on validation errors or missing secrets.
 */
export class ConfigLoader {
  /**
   * Load configuration from a YAML file path.
   * @param filePath - Absolute or relative path to the YAML config file
   * @returns Validated AppConfig with secrets resolved from environment
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

    // Resolve OAuth credentials from environment
    const clientId = jiraKeys.client_id;
    if (!clientId || clientId.trim() === '') {
      throw new Error('JIRA_CLIENT_ID is required but not set or empty');
    }

    const clientSecret = jiraKeys.client_secret;
    if (!clientSecret || clientSecret.trim() === '') {
      throw new Error('JIRA_CLIENT_SECRET is required but not set or empty');
    }

    if (!jiraKeys.base_url || jiraKeys.base_url.trim()===''){
      throw new Error ('Jira Base URL Missing in Config')
    }

    // Build AppConfig
    const appConfig: AppConfig = {
      jira: {
        baseUrl: jiraKeys.base_url,
        boardId: validatedConfig.jira.boardId,
        storyPointsFieldId: validatedConfig.jira.storyPointsFieldId,
        classificationFieldId: validatedConfig.jira.classificationFieldId,
        qaFailCountFieldId: validatedConfig.jira.qaFailCountFieldId,
        uatFailCountFieldId: validatedConfig.jira.uatFailCountFieldId,
        authType: validatedConfig.jira.authType,
        clientId: clientId.trim(),
        clientSecret: clientSecret.trim()
      },
      window: {
        closed: validatedConfig.window.closed,
        future: validatedConfig.window.future
      },
      report: {
        showEmptyCategories: validatedConfig.report.showEmptyCategories,
        targetClassifications: validatedConfig.report.targetClassifications
      },
      output: {
        type: validatedConfig.output.type,
        path: validatedConfig.output.path
      },
      logLevel: validatedConfig.logLevel
    };

    return appConfig;
  }
}
