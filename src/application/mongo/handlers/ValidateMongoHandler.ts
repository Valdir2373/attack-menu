import type { ICommandHandler } from "../../../domain/patterns/ICommandHandler.js";
import type { IMongoValidator } from "../../../domain/ports/IMongoValidator.js";
import type { ValidateMongoCommand } from "../commands/ValidateMongoCommand.js";
import type { ValidationResultDTO } from "../../dtos/ValidationResultDTO.js";
import { MongoCredential } from "../../../domain/entities/MongoCredential.js";
import { Result } from "../../../shared/Result.js";

export class ValidateMongoHandler
  implements ICommandHandler<ValidateMongoCommand, ValidationResultDTO>
{
  constructor(private readonly validator: IMongoValidator) {}

  async execute(command: ValidateMongoCommand): Promise<Result<ValidationResultDTO>> {
    const credential = MongoCredential.criar(command.uri);
    if (credential.isFailure) return Result.fail(credential.error!);
    const isValid = await this.validator.validateCredentials(command.uri);
    return Result.ok({ isValid });
  }
}

