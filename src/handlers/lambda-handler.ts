import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";

import { ConfigLoader } from '../config/config-loader.js';
import { Logger } from 'pino';
import { ReportGenerator } from '../app/report-generator.js';
import { LoggerFactory } from '../logging/logger-factory.js';

const secret_name = process.env.JIRA_SECRET_NAME;

const client = new SecretsManagerClient({
  region: "us-east-1",
});


export type JiraKeys = {
    client_id: string,
    client_secret: string,
    base_url: string
}

export const getJiraKeys = async (logger: Logger): Promise<JiraKeys> => {
    const response = await client.send(
        new GetSecretValueCommand({
        SecretId: secret_name,
        })
    );
    const secret = response.SecretString;

    if (!secret) {
        throw new Error(`Secret ${secret_name} has no SecretString`);
    }
    const parsed = JSON.parse(secret);
    if (!parsed.JIRA_CLIENT_ID || parsed.JIRA_CLIENT_ID == ""){
        throw new Error("Could not load Jira Client ID");
    }

    if (!parsed.JIRA_CLIENT_SECRET || parsed.JIRA_CLIENT_SECRET == ""){
        throw new Error("Could not load Jira Client Secret");
    }

    if (!parsed.JIRA_BASE_URL || parsed.JIRA_BASE_URL == ""){
        throw new Error("Could not load Jira Base URL");
    }

    return {
        client_id: parsed.JIRA_CLIENT_ID,
        client_secret: parsed.JIRA_CLIENT_SECRET,
        base_url: parsed.JIRA_BASE_URL
    }
}

export const handler = async (): Promise<string | void> => {
    LoggerFactory.init('info');
    const logger = LoggerFactory.child('LambdaHandler');
    logger.info("Getting Jira Keys");
    const jiraKeys = getJiraKeys(logger);
    const config = ConfigLoader.load('config/config.local.yaml', await jiraKeys);
    const reportGenerator = new ReportGenerator(config, logger);
    return await reportGenerator.generate();
}
