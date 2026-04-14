import type { Result } from "../../shared/Result.js";

export interface ICommandHandler<TCommand, TResult> {
  execute(command: TCommand): Promise<Result<TResult>>;
}

