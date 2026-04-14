import chalk from "chalk";
import type { ILogger } from "../../application/common/ILogger.js";

export class ChalkLogger implements ILogger {
  constructor(private readonly _debugEnabled: boolean = false) {}

  info(message: string, _context?: Record<string, unknown>): void {
    console.log(chalk.cyan("[INFO]"), message);
  }

  warn(message: string, _context?: Record<string, unknown>): void {
    console.warn(chalk.yellow("[WARN]"), message);
  }

  error(message: string, error?: Error, _context?: Record<string, unknown>): void {
    console.error(chalk.red("[ERROR]"), message);
    if (error?.stack) console.error(chalk.gray(error.stack));
  }

  debug(message: string, _context?: Record<string, unknown>): void {
    if (this._debugEnabled) console.debug(chalk.gray("[DEBUG]"), message);
  }
}

