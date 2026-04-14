import type { IMediator } from "../../domain/patterns/IMediator.js";
import type { IMongoController } from "../../application/mongo/IMongoController.js";
import { ExecuteMongoValidationCommand } from "../../application/mongo/commands/ExecuteMongoValidationCommand.js";
import { ExecuteMongoMassiveCommand } from "../../application/mongo/commands/ExecuteMongoMassiveCommand.js";
import { Result } from "../../shared/Result.js";

export class MongoController implements IMongoController {
  constructor(private readonly _mediator: IMediator) {}

  async executeValidation(
    inputFile: string, credentialsFile: string,
    onLog: (msg: string) => void, onProgress?: (remaining: number) => void,
  ): Promise<Result<{ tested: number; validated: number }>> {
    return this._mediator.send<{ tested: number; validated: number }>(
      new ExecuteMongoValidationCommand(inputFile, credentialsFile, onLog, onProgress),
    );
  }

  async executeMassive(
    keywords: string[], credentialsFile: string,
    onLog: (msg: string) => void,
    whitelist?: string[], blacklist?: string[],
    onProgress?: (remaining: number) => void,
  ): Promise<Result<{ scraped: number; validated: number }>> {
    return this._mediator.send<{ scraped: number; validated: number }>(
      new ExecuteMongoMassiveCommand(keywords, credentialsFile, whitelist, blacklist, onLog, onProgress),
    );
  }
}

