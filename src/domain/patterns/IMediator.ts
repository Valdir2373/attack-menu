import type { Result } from "../../shared/Result.js";

export interface IMediator {
  send<TResult>(command: object): Promise<Result<TResult>>;
}

