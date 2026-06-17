import { writeFile, mkdir } from 'fs/promises';
import { dirname } from 'path';
import type { Logger } from 'pino';
import type { OutputTarget } from './output-target.js';

/**
 * LocalFileOutput — writes report HTML to the local filesystem.
 * Creates parent directories if needed.
 */
export class LocalFileOutput implements OutputTarget {
  constructor(
    private readonly filePath: string,
    private readonly logger: Logger
  ) {}

  async write(html: string, name: string): Promise<void> {
    this.logger.info({ filePath: this.filePath, name }, 'Writing report to local file');

    try {
      // Ensure parent directory exists
      const dir = dirname(this.filePath);
      await mkdir(dir, { recursive: true });

      // Write the HTML file
      await writeFile(this.filePath, html, 'utf-8');

      this.logger.info({ filePath: this.filePath, size: html.length }, 'Report written successfully');
    } catch (error) {
      this.logger.error({ error, filePath: this.filePath }, 'Failed to write report file');
      throw new Error(`Failed to write report to ${this.filePath}: ${(error as Error).message}`);
    }
  }
}
