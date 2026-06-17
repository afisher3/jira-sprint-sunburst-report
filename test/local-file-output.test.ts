import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { LocalFileOutput } from '../src/report/output/local-file-output.js';
import { LoggerFactory } from '../src/logging/logger-factory.js';

const TEST_DIR = join(process.cwd(), 'test', 'tmp', 'output');

describe('LocalFileOutput', () => {
  beforeEach(() => {
    LoggerFactory.reset();
    LoggerFactory.init('silent');
    // Clean test directory
    try {
      rmSync(TEST_DIR, { recursive: true, force: true });
    } catch {}
  });

  afterEach(() => {
    try {
      rmSync(TEST_DIR, { recursive: true, force: true });
    } catch {}
  });

  it('should write HTML to file', async () => {
    const filePath = join(TEST_DIR, 'test-report.html');
    const output = new LocalFileOutput(filePath, LoggerFactory.child('LocalFileOutput'));
    const html = '<html><body>Test Report</body></html>';

    await output.write(html, 'test-report');

    expect(existsSync(filePath)).toBe(true);
    const content = readFileSync(filePath, 'utf-8');
    expect(content).toBe(html);
  });

  it('should create parent directories if they do not exist', async () => {
    const filePath = join(TEST_DIR, 'nested', 'deep', 'report.html');
    const output = new LocalFileOutput(filePath, LoggerFactory.child('LocalFileOutput'));
    const html = '<html><body>Nested Report</body></html>';

    await output.write(html, 'nested-report');

    expect(existsSync(filePath)).toBe(true);
    const content = readFileSync(filePath, 'utf-8');
    expect(content).toBe(html);
  });

  it('should overwrite existing file', async () => {
    const filePath = join(TEST_DIR, 'overwrite.html');
    const output = new LocalFileOutput(filePath, LoggerFactory.child('LocalFileOutput'));

    await output.write('<html><body>First</body></html>', 'first');
    await output.write('<html><body>Second</body></html>', 'second');

    const content = readFileSync(filePath, 'utf-8');
    expect(content).toBe('<html><body>Second</body></html>');
  });

  it('should throw error with clear message on write failure', async () => {
    // Use an invalid path (null character not allowed in Windows paths)
    const invalidPath = join(TEST_DIR, 'invalid\x00name.html');
    const output = new LocalFileOutput(invalidPath, LoggerFactory.child('LocalFileOutput'));

    await expect(output.write('<html></html>', 'test')).rejects.toThrow('Failed to write report');
  });
});
