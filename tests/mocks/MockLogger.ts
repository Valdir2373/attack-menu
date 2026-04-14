import type { ILogger } from "../../src/application/common/ILogger.js";

export class MockLogger implements ILogger {
  public messages: Array<{ level: string; message: string }> = [];

  info(message: string): void {
    this.messages.push({ level: "info", message });
  }
  warn(message: string): void {
    this.messages.push({ level: "warn", message });
  }
  error(message: string): void {
    this.messages.push({ level: "error", message });
  }
  debug(message: string): void {
    this.messages.push({ level: "debug", message });
  }
}
