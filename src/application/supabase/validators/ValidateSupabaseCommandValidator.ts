import { Result } from "../../../shared/Result.js";
import type { IValidator } from "../../common/IValidator.js";
import type { ValidateSupabaseCommand } from "../commands/ValidateSupabaseCommand.js";

export class ValidateSupabaseCommandValidator implements IValidator<ValidateSupabaseCommand> {
  validate(command: ValidateSupabaseCommand): Result<void> {
    if (!command.url || !command.url.startsWith("http")) {
      return Result.fail("URL Supabase inválida — deve começar com http");
    }
    if (!command.key || command.key.trim().length === 0) {
      return Result.fail("Chave Supabase não pode ser vazia");
    }
    return Result.ok(undefined);
  }
}

