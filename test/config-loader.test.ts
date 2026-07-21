import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { ConfigLoader } from '../src/config/config-loader.js';
import { JiraKeys } from '../src/handlers/lambda-handler.js';

const TEST_DIR = join(process.cwd(), 'test', 'tmp');

const testJiraKeys: JiraKeys = {
  client_id: "test_client_id",
  client_secret: "test_client_secret",
  base_url: "https://testbaseurl.com"
}

function writeConfig(contents: string){
  const configPath = join(TEST_DIR, 'config.yaml');
  writeFileSync(configPath, contents);
  return configPath;
}

const validConfig = `
jira:
  boardId: 123
  storyPointsFieldId: customfield_10016
  classificationFieldId: customfield_10100
  lastStatusOfRefinement: test_status
  lastStatusOfDev: test_status
  lastStatusOfQA: test_status
  lastStatusOfUAT: test_status
window:
  closed: 3
  future: 3
report:
  showEmptyCategories: false
logLevel: info
`;

describe('ConfigLoader', () => {
  beforeEach(() => {
    // Clean and create test directory
    try {
      rmSync(TEST_DIR, { recursive: true, force: true });
    } catch {}
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    // Clean up test files
    try {
      rmSync(TEST_DIR, { recursive: true, force: true });
    } catch {}
  });

  it('should load valid config with all required fields', () => {
    const configPath = writeConfig(validConfig);

    const config = ConfigLoader.load(configPath,testJiraKeys);

    expect(config.jira.baseUrl).toBe('https://testbaseurl.com');
    expect(config.jira.clientId).toBe('test_client_id');
    expect(config.jira.clientSecret).toBe('test_client_secret');
    expect(config.jira.authType).toBe('oauth');
    expect(config.jira.boardId).toBe(123);
    expect(config.window.closed).toBe(3);
    expect(config.window.future).toBe(3);
    expect(config.report.showEmptyCategories).toBe(false);
    expect(config.logLevel).toBe('info');
  });

  it('should fail when boardId is missing', () => {
    const invalidConfig = `
jira:
  storyPointsFieldId: customfield_10016
  classificationFieldId: customfield_10100
  lastStatusOfRefinement: test_status
  lastStatusOfDev: test_status
  lastStatusOfQA: test_status
  lastStatusOfUAT: test_status
window:
  closed: 3
  future: 3
report:
  showEmptyCategories: false
output:
  type: local
  path: ./out/report.html
logLevel: info
`;
    const configPath = writeConfig(invalidConfig);

    expect(() => ConfigLoader.load(configPath,testJiraKeys)).toThrow('Configuration validation failed');
    expect(() => ConfigLoader.load(configPath,testJiraKeys)).toThrow('jira.boardId');
  });

  it('should fail when baseUrl is not a valid URL', () => {
    const invalidJiraKeys : JiraKeys = {
      client_id: "test_client_id",
      client_secret: "test_client_secret",
      base_url: "notaurl"
    }

    const configPath = writeConfig(validConfig);

    expect(() => ConfigLoader.load(configPath,invalidJiraKeys)).toThrow('BASE_URL must be a valid URL');
  });

  it('should apply defaults for optional fields', () => {
    const minimalConfig = `
jira:
  boardId: 123
  storyPointsFieldId: customfield_10016
  classificationFieldId: customfield_10100
  lastStatusOfRefinement: test_status
  lastStatusOfDev: test_status
  lastStatusOfQA: test_status
  lastStatusOfUAT: test_status
`;
    const configPath = writeConfig(minimalConfig);

    const config = ConfigLoader.load(configPath,testJiraKeys);

    expect(config.jira.authType).toBe('oauth');
    expect(config.window.closed).toBe(3);
    expect(config.window.future).toBe(3);
    expect(config.report.showEmptyCategories).toBe(false);
    expect(config.logLevel).toBe('info');
  });

  it('should fail when client_id is missing', () => {
    const jiraKeysMissingClientID = {
      client_id: " ",
      client_secret: "test-secret",
      base_url: "https://testurl.com"
    }
    const configPath = join(TEST_DIR, 'validConfig.yaml');
    writeFileSync(configPath, validConfig);

    expect(() => ConfigLoader.load(configPath, jiraKeysMissingClientID)).toThrow('JIRA_CLIENT_ID not set or not pulled from Secrets Manager');
  });

    it('should fail when client_secret is missing', () => {
    const jiraKeysMissingClientSecret = {
      client_id: "test-client-id",
      client_secret: " ",
      base_url: "https://testurl.com"
    }
    const configPath = writeConfig(validConfig)

    expect(() => ConfigLoader.load(configPath, jiraKeysMissingClientSecret)).toThrow('JIRA_CLIENT_SECRET not set or not pulled from Secrets Manager');
  });

    it('should fail when base_url is missing', () => {
    const jiraKeysMissingBaseURL = {
      client_id: "test-client-id",
      client_secret: "test-client-secret",
      base_url: " "
    }
    const configPath = join(TEST_DIR, 'validConfig.yaml');
    writeFileSync(configPath, validConfig);

    expect(() => ConfigLoader.load(configPath, jiraKeysMissingBaseURL)).toThrow('BASE_URL not set or not pulled from Secrets Manager');
  });

  it('should fail when the config file does not exist', () =>{
    const configPath = join(TEST_DIR, 'missing.yaml');
    expect(() => ConfigLoader.load(configPath,testJiraKeys)).toThrow(`Failed to read config file at ${configPath}`);
  });

  it('should fail when the config file is malformed', () => {
    const malformedConfig = `
        jira:
          storyPointsFieldId:customfield_10016
          classificationFieldId:customfield_10100
          lastStatusOfRefinement:test_status
          lastStatusOfDev:test_status
          lastStatusOfQA:test_status
          lastStatusOfUAT:test_status
        window:
          closed:3
          future:3
        report:
          showEmptyCategories:false
        logLevel:info
        `;
    const configPath = writeConfig(malformedConfig);
    expect(() => ConfigLoader.load(configPath,testJiraKeys)).toThrow(`Failed to parse YAML in ${configPath}`)
  });

  it('should fail when the config file does not match the schema', () => {
    const nonSchemaConfig = `
jira:

  storyPointsFieldId: customfield_10016
  classificationFieldId: customfield_10100
  lastStatusOfRefinement: test_status
  lastStatusOfDev: test_status
  lastStatusOfQA: test_status
  lastStatusOfUAT: test_status
window:
  closed: -1
  future: 3
report:
  showEmptyCategories: false
logLevel: info
    `
    const configPath = writeConfig(nonSchemaConfig);
    expect(()=> ConfigLoader.load(configPath,testJiraKeys)).toThrow('Configuration validation failed');
  });

  it('should trim Jira credentials', () => {
    const jiraKeysWithSpaces: JiraKeys = {
      client_id: " test_client_id ",
      client_secret: " test_client_secret ",
      base_url: " https://testurl.com "
    }
    const configPath = join(TEST_DIR, 'validConfig.yaml');
    writeFileSync(configPath, validConfig);
    const config = ConfigLoader.load(configPath,jiraKeysWithSpaces);
    expect(config.jira.baseUrl).toBe('https://testurl.com');
    expect(config.jira.clientId).toBe("test_client_id");
    expect(config.jira.clientSecret).toBe("test_client_secret");
  })
});
