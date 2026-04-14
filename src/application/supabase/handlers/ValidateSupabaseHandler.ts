import type { ICommandHandler } from "../../../domain/patterns/ICommandHandler.js";
import type { ISupabaseValidator } from "../../../domain/ports/ISupabaseValidator.js";
import type { ValidateSupabaseCommand } from "../commands/ValidateSupabaseCommand.js";
import type { ValidationResultDTO } from "../../dtos/ValidationResultDTO.js";
import { SupabaseCredential } from "../../../domain/entities/SupabaseCredential.js";
import { Result } from "../../../shared/Result.js";

export class ValidateSupabaseHandler
  implements ICommandHandler<ValidateSupabaseCommand, ValidationResultDTO>
{
  constructor(private readonly validator: ISupabaseValidator) {}

  async execute(command: ValidateSupabaseCommand): Promise<Result<ValidationResultDTO>> {
    const credential = SupabaseCredential.criar(command.url, command.key);
    if (credential.isFailure) return Result.fail(credential.error!);
    const isValid = await this.validator.validateCredentials(command.url, command.key);
    return Result.ok({ isValid });
  }
}

