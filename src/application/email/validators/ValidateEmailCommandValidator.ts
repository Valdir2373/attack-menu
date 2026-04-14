import { Result } from "../../../shared/Result.js";
import type { IValidator } from "../../common/IValidator.js";
import type { ValidateEmailCommand } from "../commands/ValidateEmailCommand.js";

export class ValidateEmailCommandValidator implements IValidator<ValidateEmailCommand> {
  validate(command: ValidateEmailCommand): Result<void> {
    if (!command.email || !command.email.includes("@")) {
      return Result.fail("Email inválido");
    }
    if (!command.password || command.password.trim().length === 0) {
      return Result.fail("Senha não pode ser vazia");
    }
    return Result.ok(undefined);
  }
}

