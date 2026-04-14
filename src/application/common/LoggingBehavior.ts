import type { ILogger } from "./ILogger.js";

export class LoggingBehavior {
  constructor(private readonly logger: ILogger) {}

  async handle<T>(commandName: string, next: () => Promise<T>): Promise<T> {
    this.logger.info(`[→] ${commandName} iniciado`);
    const start = Date.now();
    try {
      const result = await next();
      this.logger.info(`[✓] ${commandName} concluído em ${Date.now() - start}ms`);
      return result;
    } catch (error) {
      this.logger.error(
        `[✗] ${commandName} falhou em ${Date.now() - start}ms`,
        error as Error,
      );
      throw error;
    }
  }
}

