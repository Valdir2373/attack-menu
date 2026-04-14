import type { ICommandHandler } from "../../../domain/patterns/ICommandHandler.js";
import type { IFileStorage } from "../../common/IFileStorage.js";
import type { AppendCredentialCommand } from "../commands/AppendCredentialCommand.js";
import { Result } from "../../../shared/Result.js";

export class AppendCredentialHandler implements ICommandHandler<AppendCredentialCommand, void> {
  constructor(private readonly _fileStorage: IFileStorage) {}

  async execute(command: AppendCredentialCommand): Promise<Result<void>> {
    await this._fileStorage.appendFile(command.filePath, `${command.email}:${command.password}\n`);
    return Result.ok(undefined);
  }
}

