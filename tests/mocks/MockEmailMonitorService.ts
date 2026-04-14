import type { IEmailMonitorService } from "../../src/domain/ports/IEmailMonitorService.js";
import type { Email } from "../../src/domain/entities/Email.js";

export class MockEmailMonitorService implements IEmailMonitorService {
  private _running = false;
  public emails: Email[] = [];

  get isRunning(): boolean {
    return this._running;
  }

  async start(_email: string, _password: string): Promise<void> {
    this._running = true;
  }

  async stop(): Promise<Email[]> {
    this._running = false;
    return this.emails;
  }
}
