import type { ISupabaseValidator } from "../../src/domain/ports/ISupabaseValidator.js";

export class MockSupabaseValidator implements ISupabaseValidator {
  public calls: Array<{ url: string; key: string }> = [];
  public result = false;

  async validateCredentials(url: string, key: string): Promise<boolean> {
    this.calls.push({ url, key });
    return this.result;
  }

  reset(): void {
    this.calls = [];
    this.result = false;
  }
}
