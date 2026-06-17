import { readFileSync } from 'fs';
import { parse as parseYaml } from 'yaml';
import { ConfigSchema, type ConfigType } from '../../config/schema.js';
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
  static load(filePath: string): AppConfig {
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
    const clientId = process.env.JIRA_CLIENT_ID;
    if (!clientId || clientId.trim() === '') {
      throw new Error('JIRA_CLIENT_ID environment variable is required but not set or empty');
    }

    const clientSecret = process.env.JIRA_CLIENT_SECRET;
    if (!clientSecret || clientSecret.trim() === '') {
      throw new Error('JIRA_CLIENT_SECRET environment variable is required but not set or empty');
    }

    // Build AppConfig
    const appConfig: AppConfig = {
      jira: {
        baseUrl: validatedConfig.jira.baseUrl,
        boardId: validatedConfig.jira.boardId,
        storyPointsFieldId: validatedConfig.jira.storyPointsFieldId,
        classificationFieldId: validatedConfig.jira.classificationFieldId,
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
