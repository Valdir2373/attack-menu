import type { IMongoValidator } from "../../src/domain/ports/IMongoValidator.js";

export class MockMongoValidator implements IMongoValidator {
  public calls: string[] = [];
  public result = false;

  async validateCredentials(uri: string): Promise<boolean> {
    this.calls.push(uri);
    return this.result;
  }

  reset(): void {
    this.calls = [];
    this.result = false;
  }
}
