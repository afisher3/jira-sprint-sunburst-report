/**
 * Field Discovery Script
 *
 * This script fetches issues from a sprint and logs ALL fields to help identify
 * the correct field IDs for Story Points and Classification.
 *
 * Usage:
 *   1. Set JIRA_CLIENT_ID and JIRA_CLIENT_SECRET in environment
 *   2. npm run build
 *   3. node dist/discover-fields.js
 *
 * Expected output:
 *   - Classification field should contain " -> " strings like "App Dev -> Fix"
 *   - Story Points field should be a number (e.g., 1.0, 2.0, 3.0)
 */

import { ConfigLoader } from './config/config-loader.js';
import { LoggerFactory } from './logging/logger-factory.js';
import { JiraClient } from './jira/jira-client.js';

async function main() {
  LoggerFactory.init('info'); // Initialize logger factory
  const logger = LoggerFactory.child('FieldDiscovery');
  const config = ConfigLoader.load('config/config.local.yaml');

  const jiraClient = new JiraClient(
    config.jira.baseUrl,
    config.jira.clientId,
    config.jira.clientSecret,
    logger
  );

  console.log('\n=== DISCOVERING JIRA FIELD IDS ===\n');
  console.log(`Board ID: ${config.jira.boardId}`);
  console.log(`Fetching issues from sprint 208 (Lamington)...\n`);

  // Fetch first 3 issues from sprint 287 (Lamington) with ALL fields
  // Note: Using search API because agileGet has scope issues
  const response = await jiraClient.searchJql<any>(
    'sprint = 287',
    ['*all'], // Request all fields
    undefined
  );

  // Limit to first 3 for analysis
  if (response.issues && response.issues.length > 3) {
    response.issues = response.issues.slice(0, 3);
  }

  if (!response.issues || response.issues.length === 0) {
    console.log('❌ No issues found in sprint');
    return;
  }

  console.log(`Found ${response.issues.length} issue(s)\n`);

  // Analyze first issue in detail
  const issue = response.issues[0];
  const fields = issue.fields;

  console.log('=== SAMPLE ISSUE ===');
  console.log(`Key: ${issue.key}`);
  console.log(`Summary: ${fields.summary}`);
  console.log();

  // Find custom fields
  const customFields = Object.keys(fields)
    .filter(key => key.startsWith('customfield_'))
    .sort();

  console.log(`=== ALL CUSTOM FIELDS (${customFields.length} total) ===\n`);

  const storyPointCandidates: string[] = [];
  const classificationCandidates: string[] = [];

  for (const fieldId of customFields) {
    const value = fields[fieldId];

    // Check for story points (numeric values 0-100)
    if (typeof value === 'number' && value >= 0 && value <= 100) {
      storyPointCandidates.push(fieldId);
      console.log(`${fieldId}: ${value} ← CANDIDATE: Story Points (numeric)`);
    }
    // Check for classification (string with ->)
    else if (typeof value === 'string' && value.includes(' -> ')) {
      classificationCandidates.push(fieldId);
      console.log(`${fieldId}: "${value}" ← CANDIDATE: Classification (has ->)`);
    }
    // Show all other fields truncated
    else {
      let valueStr = JSON.stringify(value);
      if (valueStr.length > 80) {
        valueStr = valueStr.substring(0, 80) + '...';
      }
      console.log(`${fieldId}: ${valueStr}`);
    }
  }

  // Summary
  console.log('\n=== RECOMMENDATIONS ===\n');

  if (classificationCandidates.length > 0) {
    console.log(`✅ Classification field found: ${classificationCandidates[0]}`);
    console.log(`   Update config: classificationFieldId: ${classificationCandidates[0]}`);
  } else {
    console.log('❌ No classification field found with " -> " pattern');
  }

  if (storyPointCandidates.length > 0) {
    console.log(`✅ Story Points field found: ${storyPointCandidates[0]}`);
    console.log(`   Update config: storyPointsFieldId: ${storyPointCandidates[0]}`);
  } else {
    console.log('❌ No story points field found (expected numeric value)');
  }

  // Verify across multiple issues
  if (response.issues.length > 1) {
    console.log('\n=== VERIFICATION (checking other issues) ===\n');

    for (let i = 1; i < response.issues.length; i++) {
      const verifyIssue = response.issues[i];
      const verifyFields = verifyIssue.fields;

      console.log(`${verifyIssue.key}:`);

      for (const fieldId of classificationCandidates) {
        console.log(`  Classification (${fieldId}): "${verifyFields[fieldId]}"`);
      }

      for (const fieldId of storyPointCandidates) {
        console.log(`  Story Points (${fieldId}): ${verifyFields[fieldId]}`);
      }
    }
  }

  console.log('\n=== CURRENT CONFIG ===\n');
  console.log(`classificationFieldId: ${config.jira.classificationFieldId}`);
  console.log(`storyPointsFieldId: ${config.jira.storyPointsFieldId}`);
  console.log();
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  if (err.stack) {
    console.error(err.stack);
  }
  process.exit(1);
});
