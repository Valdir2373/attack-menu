export interface ICredentialEngine {
  runFromFile(filePath: string): Promise<void>;
  countUnique(filePath: string): Promise<number>;
}

export interface ICredentialEngineFactory {
  create(
    patterns: RegExp[],
    validate: (...args: string[]) => Promise<boolean>,
    outputFilePath: string,
    saveFn?: (creds: string[]) => Promise<void>,
  ): ICredentialEngine;
}

