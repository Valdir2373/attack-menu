import type { ICommandHandler } from "../../../domain/patterns/ICommandHandler.js";
import type { IEmailValidator } from "../../../domain/ports/IEmailValidator.js";
import type { ValidateEmailCommand } from "../commands/ValidateEmailCommand.js";
import type { ValidationResultDTO } from "../../dtos/ValidationResultDTO.js";
import { EmailCredential } from "../../../domain/entities/EmailCredential.js";
import { Result } from "../../../shared/Result.js";

export class ValidateEmailHandler
  implements ICommandHandler<ValidateEmailCommand, ValidationResultDTO>
{
  constructor(private readonly validator: IEmailValidator) {}

  async execute(command: ValidateEmailCommand): Promise<Result<ValidationResultDTO>> {
    const credential = EmailCredential.criar(command.email, command.password);
    if (credential.isFailure) return Result.fail(credential.error!);
    const isValid = await this.validator.validateCredentials(command.email, command.password);
    return Result.ok({ isValid });
  }
}

