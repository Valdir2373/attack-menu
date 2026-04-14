import type {
  ICredentialEngine,
  ICredentialEngineFactory,
} from "../../src/application/common/ICredentialEngine.js";

export class MockCredentialEngine implements ICredentialEngine {
  public runFromFileCalls: string[] = [];
  public countUniqueResult = 0;
  public validateFn?: (...args: string[]) => Promise<boolean>;
  public validateCallArgs: string[][] = [];
  public shouldThrow: Error | null = null;

  async runFromFile(filePath: string): Promise<void> {
    if (this.shouldThrow) throw this.shouldThrow;
    this.runFromFileCalls.push(filePath);
    if (this.validateFn) {
      for (const args of this.validateCallArgs) {
        await this.validateFn(...args);
      }
    }
  }

  async countUnique(_filePath: string): Promise<number> {
    return this.countUniqueResult;
  }

  reset(): void {
    this.runFromFileCalls = [];
    this.countUniqueResult = 0;
    this.validateFn = undefined;
    this.validateCallArgs = [];
    this.shouldThrow = null;
  }
}

export class MockCredentialEngineFactory implements ICredentialEngineFactory {
  public createCalls: Array<{
    patterns: RegExp[];
    validate: (...args: string[]) => Promise<boolean>;
    outputFilePath: string;
    saveFn?: (creds: string[]) => Promise<void>;
  }> = [];
  public engine = new MockCredentialEngine();

  create(
    patterns: RegExp[],
    validate: (...args: string[]) => Promise<boolean>,
    outputFilePath: string,
    saveFn?: (creds: string[]) => Promise<void>,
  ): ICredentialEngine {
    this.createCalls.push({ patterns, validate, outputFilePath, saveFn });
    this.engine.validateFn = validate;
    return this.engine;
  }

  reset(): void {
    this.createCalls = [];
    this.engine.reset();
  }
}
