import pino, { type Logger } from 'pino';

/**
 * LoggerFactory — creates and manages structured JSON loggers with Pino.
 * One root logger configured at startup; components get child loggers tagged with their name.
 * No console.log anywhere — always use the logger.
 */
export class LoggerFactory {
  private static rootLogger: Logger | null = null;

  /**
   * Initialize the root logger with the specified level.
   * Must be called once at application startup before any child() calls.
   * @param level - Log level: trace, debug, info, warn, error, fatal
   */
  static init(level: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal'): void {
    if (this.rootLogger) {
      return;
    }

    this.rootLogger = pino({
      level,
      formatters: {
        level: (label) => {
          return { level: label };
        }
      },
      timestamp: pino.stdTimeFunctions.isoTime
    });
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
  }
}
