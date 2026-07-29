import pino, { type Logger } from 'pino';
import { Writable } from 'stream';

/**
 * LoggerFactory — creates and manages structured JSON loggers with Pino.
 * One root logger configured at startup; components get child loggers tagged with their name.
 * No console.log anywhere — always use the logger.
 */
export class LoggerFactory {
  private static rootLogger: Logger | null = null;
  private static logChunks: string[] = [];

  /**
   * Initialize the root logger with the specified level.
   * Must be called once at application startup before any child() calls.
   *
   * Under `sam local invoke` (AWS_SAM_LOCAL=true, set automatically by the SAM CLI), logs
   * are written to stdout as usual, matching the local dev workflow that streams/saves them.
   * In a real deployed Lambda, logs are instead buffered in memory and never written to
   * stdout/CloudWatch — ReportGenerator uploads the buffered content to S3 as report.log
   * alongside the report, via getLogs().
   *
   * @param level - Log level: trace, debug, info, warn, error, fatal
   */
  static init(level: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal'): void {
    if (this.rootLogger) {
      return;
    }

    const destination = process.env.AWS_SAM_LOCAL === 'true'
      ? pino.destination(1)
      : new Writable({
          write: (chunk: Buffer, _encoding, callback) => {
            LoggerFactory.logChunks.push(chunk.toString());
            callback();
          }
        });

    this.rootLogger = pino({
      level,
      formatters: {
        level: (label) => {
          return { level: label };
        }
      },
      timestamp: pino.stdTimeFunctions.isoTime
    }, destination);
  }

  /**
   * Returns everything logged so far when running outside `sam local invoke`
   * (empty string otherwise, since logs go straight to stdout in that case).
   */
  static getLogs(): string {
    return this.logChunks.join('');
  }

  /**
   * Get a child logger tagged with the specified component name.
   * @param component - Component name (e.g., 'ConfigLoader', 'JiraClient')
   * @returns Child logger with component tag
   */
  static child(component: string): Logger {
    if (!this.rootLogger) {
      throw new Error('LoggerFactory not initialized. Call init(level) before creating child loggers.');
    }

    return this.rootLogger.child({ component });
  }

  /**
   * Reset the factory (primarily for testing).
   * Clears the root logger so init() can be called again.
   */
  static reset(): void {
    this.rootLogger = null;
    this.logChunks = [];
  }
}
