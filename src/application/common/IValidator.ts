import type { Result } from "../../shared/Result.js";

export interface IValidator<T> {
  validate(command: T): Result<void>;
}

