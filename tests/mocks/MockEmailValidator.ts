import type { IEmailValidator } from "../../src/domain/ports/IEmailValidator.js";

export class MockEmailValidator implements IEmailValidator {
  public calls: Array<{ email: string; password: string }> = [];
  public result = false;

  async validateCredentials(email: string, password: string): Promise<boolean> {
    this.calls.push({ email, password });
    return this.result;
  }

  reset(): void {
    this.calls = [];
    this.result = false;
  }
}
