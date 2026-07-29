#!/usr/bin/env node
// Reads a `sam local invoke` JSON response (the report HTML as a JSON string)
// from the given file and writes the decoded HTML to the given output path.
import { readFileSync, writeFileSync } from 'fs';

const [, , responsePath, outputPath] = process.argv;

if (!responsePath || !outputPath) {
  console.error('Usage: extract-report-response.mjs <response-file> <output-file>');
  process.exit(1);
}

const raw = readFileSync(responsePath, 'utf-8').trim();

let parsed;
try {
  parsed = JSON.parse(raw);
} catch (error) {
  console.error('Could not parse invoke response as JSON:');
  console.error(raw);
  process.exit(1);
}

if (typeof parsed !== 'string') {
  console.error('Lambda did not return an HTML string. Response was:');
  console.error(JSON.stringify(parsed, null, 2));
  process.exit(1);
}

writeFileSync(outputPath, parsed, 'utf-8');
console.log(`Report written to ${outputPath}`);
