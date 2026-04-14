import type { ICommandHandler } from "../../../domain/patterns/ICommandHandler.js";
import type { IFileStorage } from "../../common/IFileStorage.js";
import type { ReadCredentialsCommand } from "../commands/ReadCredentialsCommand.js";
import type { EmailCredentialDTO } from "../dto/EmailCredentialDTO.js";
import { Result } from "../../../shared/Result.js";

export class ReadCredentialsHandler implements ICommandHandler<ReadCredentialsCommand, EmailCredentialDTO[]> {
  constructor(private readonly _fileStorage: IFileStorage) {}

  async execute(command: ReadCredentialsCommand): Promise<Result<EmailCredentialDTO[]>> {
    const exists = await this._fileStorage.exists(command.filePath);
    if (!exists) return Result.ok([]);
    const content = await this._fileStorage.readFile(command.filePath);
    const credentials = content
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const sep = line.indexOf(":");
        if (sep === -1) return null;
        return { email: line.slice(0, sep).trim(), password: line.slice(sep + 1).trim() };
      })
      .filter(Boolean) as EmailCredentialDTO[];
    return Result.ok(credentials);
  }
}

