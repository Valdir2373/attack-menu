import { Result } from "../../../shared/Result.js";
import type { IValidator } from "../../common/IValidator.js";
import type { ValidateMongoCommand } from "../commands/ValidateMongoCommand.js";

export class ValidateMongoCommandValidator implements IValidator<ValidateMongoCommand> {
  validate(command: ValidateMongoCommand): Result<void> {
    if (!command.uri || command.uri.trim().length === 0) {
      return Result.fail("URI MongoDB não pode ser vazia");
    }
    if (!command.uri.startsWith("mongodb://") && !command.uri.startsWith("mongodb+srv://")) {
      return Result.fail("URI MongoDB deve começar com mongodb:// ou mongodb+srv://");
    }
    return Result.ok(undefined);
  }
}

