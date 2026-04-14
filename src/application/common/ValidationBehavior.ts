import { Result } from "../../shared/Result.js";
import type { IValidator } from "./IValidator.js";

export class ValidationBehavior<T> {
  constructor(private readonly validators: IValidator<T>[]) {}

  validate(command: T): Result<void> {
    for (const v of this.validators) {
      const r = v.validate(command);
      if (r.isFailure) return r;
    }
    return Result.ok(undefined);
  }

  async handle<R>(command: T, next: () => Promise<Result<R>>): Promise<Result<R>> {
    const validation = this.validate(command);
    if (validation.isFailure) return Result.fail(validation.error!);
    return next();
  }
}

