#!/usr/bin/env node

/**
 * CLI entry point — thin adapter over ReportGenerator.
 * Parses argv, loads config, initializes logger, wires up output, and runs the generator.
 * No business logic here — everything stays in ReportGenerator for Lambda reuse.
 */

import { join } from 'path';
import { ConfigLoader } from './config/config-loader.js';
import { LoggerFactory } from './logging/logger-factory.js';
import { LocalFileOutput } from './report/output/local-file-output.js';
import { ReportGenerator } from './app/report-generator.js';

async function main() {
  // For Milestone 1, default to config/config.local.yaml
  // Future: parse argv for custom config path
  const configPath = process.argv[2] || join(process.cwd(), 'config', 'config.local.yaml');

  let config;
  try {
    config = ConfigLoader.load(configPath);
  } catch (error) {
    // Fail fast with clear error — no logger yet
    console.error('Configuration error:', (error as Error).message);
    process.exit(1);
  }

  // Initialize logger
  LoggerFactory.init(config.logLevel);
  const logger = LoggerFactory.child('CLI');

  logger.info({ configPath, logLevel: config.logLevel }, 'Application starting');

  try {
    // Wire up output target
    if (config.output.type !== 'local') {
      throw new Error(`Output type "${config.output.type}" not yet implemented`);
    }
    if (!config.output.path) {
      throw new Error('output.path is required for local output');
    }

    const output = new LocalFileOutput(
      config.output.path,
      LoggerFactory.child('LocalFileOutput')
    );

    // Create and run generator
    const generator = new ReportGenerator(
      config,
      output,
      LoggerFactory.child('ReportGenerator')
    );

    await generator.generate();

    logger.info('Application completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error({ error }, 'Application failed');
    console.error('Error:', (error as Error).message);
    process.exit(1);
  }
}

main();
