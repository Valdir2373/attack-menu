import { ICredentialEngine, ICredentialEngineFactory } from '../../application/common/ICredentialEngine.js';
import type { ILogger } from "../../application/common/ILogger.js";
import { CredentialEngine } from './CredentialEngine.js';

export class CredentialEngineFactory implements ICredentialEngineFactory {
  constructor(private readonly logger: ILogger) {}

  create(
    patterns: RegExp[],
    validate: (...args: string[]) => Promise<boolean>,
    outputFilePath: string,
    saveFn?: (creds: string[]) => Promise<void>,
  ): ICredentialEngine {
    return new CredentialEngine(patterns, validate, outputFilePath, saveFn, this.logger);
  }
}

