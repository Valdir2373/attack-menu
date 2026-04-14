import type { ICommandHandler } from "../../../domain/patterns/ICommandHandler.js";
import type { IImapClient } from "../../../domain/ports/IImapClient.js";
import type { VerifyImapCredentialCommand } from "../commands/VerifyImapCredentialCommand.js";
import type { ValidationResultDTO } from "../../dtos/ValidationResultDTO.js";
import { Result } from "../../../shared/Result.js";

export class VerifyImapCredentialHandler implements ICommandHandler<VerifyImapCredentialCommand, ValidationResultDTO> {
  constructor(private readonly _imapClient: IImapClient) {}

  async execute(command: VerifyImapCredentialCommand): Promise<Result<ValidationResultDTO>> {
    const isValid = await this._imapClient.verifyCredential(command.email, command.password);
    return Result.ok({ isValid });
  }
}

