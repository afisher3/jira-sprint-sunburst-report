import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { ConfigLoader } from '../src/config/config-loader.js';

const TEST_DIR = join(process.cwd(), 'test', 'tmp');

describe('ConfigLoader', () => {
  beforeEach(() => {
    // Clean and create test directory
    try {
      rmSync(TEST_DIR, { recursive: true, force: true });
    } catch {}
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    // Clean up env
    delete process.env.JIRA_CLIENT_ID;
    delete process.env.JIRA_CLIENT_SECRET;
    // Clean up test files
    try {
      rmSync(TEST_DIR, { recursive: true, force: true });
    } catch {}
  });

  it('should load valid config with all required fields', () => {
    const validConfig = `
jira:
  baseUrl: https://test.atlassian.net
  boardId: 123
  storyPointsFieldId: customfield_10016
  classificationFieldId: customfield_10100
  authType: oauth
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
    const configPath = join(TEST_DIR, 'valid-config.yaml');
    writeFileSync(configPath, validConfig);
    process.env.JIRA_CLIENT_ID = 'test-client-id';
    process.env.JIRA_CLIENT_SECRET = 'test-client-secret';

    const config = ConfigLoader.load(configPath);

    expect(config.jira.baseUrl).toBe('https://test.atlassian.net');
    expect(config.jira.clientId).toBe('test-client-id');
    expect(config.jira.clientSecret).toBe('test-client-secret');
    expect(config.jira.authType).toBe('oauth');
    expect(config.jira.boardId).toBe(123);
    expect(config.window.closed).toBe(3);
    expect(config.window.future).toBe(3);
    expect(config.report.showEmptyCategories).toBe(false);
    expect(config.output.type).toBe('local');
    expect(config.output.path).toBe('./out/report.html');
    expect(config.logLevel).toBe('info');
  });

  it('should fail when JIRA_CLIENT_ID is missing', () => {
    const validConfig = `
jira:
  baseUrl: https://test.atlassian.net
  boardId: 123
  storyPointsFieldId: customfield_10016
  classificationFieldId: customfield_10100
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
    const configPath = join(TEST_DIR, 'config.yaml');
    writeFileSync(configPath, validConfig);
    delete process.env.JIRA_CLIENT_ID;
    process.env.JIRA_CLIENT_SECRET = 'test-client-secret';

    expect(() => ConfigLoader.load(configPath)).toThrow('JIRA_CLIENT_ID environment variable is required');
  });

  it('should fail when JIRA_CLIENT_SECRET is missing', () => {
    const validConfig = `
jira:
  baseUrl: https://test.atlassian.net
  boardId: 123
  storyPointsFieldId: customfield_10016
  classificationFieldId: customfield_10100
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
    const configPath = join(TEST_DIR, 'config.yaml');
    writeFileSync(configPath, validConfig);
    process.env.JIRA_CLIENT_ID = 'test-client-id';
    delete process.env.JIRA_CLIENT_SECRET;

    expect(() => ConfigLoader.load(configPath)).toThrow('JIRA_CLIENT_SECRET environment variable is required');
  });

  it('should fail when boardId is missing', () => {
    const invalidConfig = `
jira:
  baseUrl: https://test.atlassian.net
  storyPointsFieldId: customfield_10016
  classificationFieldId: customfield_10100
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
    const configPath = join(TEST_DIR, 'invalid-config.yaml');
    writeFileSync(configPath, invalidConfig);
    process.env.JIRA_CLIENT_ID = 'test-client-id';
    process.env.JIRA_CLIENT_SECRET = 'test-client-secret';

    expect(() => ConfigLoader.load(configPath)).toThrow('Configuration validation failed');
    expect(() => ConfigLoader.load(configPath)).toThrow('jira.boardId');
  });

  it('should fail when baseUrl is not a valid URL', () => {
    const invalidConfig = `
jira:
  baseUrl: not-a-url
  boardId: 123
  storyPointsFieldId: customfield_10016
  classificationFieldId: customfield_10100
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
    const configPath = join(TEST_DIR, 'invalid-url.yaml');
    writeFileSync(configPath, invalidConfig);
    process.env.JIRA_CLIENT_ID = 'test-client-id';
    process.env.JIRA_CLIENT_SECRET = 'test-client-secret';

    expect(() => ConfigLoader.load(configPath)).toThrow('baseUrl must be a valid URL');
  });

  it('should fail when output.path is missing for local output', () => {
    const invalidConfig = `
jira:
  baseUrl: https://test.atlassian.net
  boardId: 123
  storyPointsFieldId: customfield_10016
  classificationFieldId: customfield_10100
window:
  closed: 3
  future: 3
report:
  showEmptyCategories: false
output:
  type: local
logLevel: info
`;
    const configPath = join(TEST_DIR, 'missing-path.yaml');
    writeFileSync(configPath, invalidConfig);
    process.env.JIRA_CLIENT_ID = 'test-client-id';
    process.env.JIRA_CLIENT_SECRET = 'test-client-secret';

    expect(() => ConfigLoader.load(configPath)).toThrow('output.path is required when output.type is "local"');
  });

  it('should apply defaults for optional fields', () => {
    const minimalConfig = `
jira:
  baseUrl: https://test.atlassian.net
  boardId: 123
  storyPointsFieldId: customfield_10016
  classificationFieldId: customfield_10100
output:
  type: local
  path: ./out/report.html
`;
    const configPath = join(TEST_DIR, 'minimal-config.yaml');
    writeFileSync(configPath, minimalConfig);
    process.env.JIRA_CLIENT_ID = 'test-client-id';
    process.env.JIRA_CLIENT_SECRET = 'test-client-secret';

    const config = ConfigLoader.load(configPath);

    expect(config.jira.authType).toBe('oauth');
    expect(config.window.closed).toBe(3);
    expect(config.window.future).toBe(3);
    expect(config.report.showEmptyCategories).toBe(false);
    expect(config.logLevel).toBe('info');
  });
});
