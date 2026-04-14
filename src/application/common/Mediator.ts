import type { IMediator } from "../../domain/patterns/IMediator.js";
import type { ICommandHandler } from "../../domain/patterns/ICommandHandler.js";
import type { LoggingBehavior } from "./LoggingBehavior.js";
import type { ValidationBehavior } from "./ValidationBehavior.js";
import { InvalidCommandError } from "../../errors/index.js";
import { Result } from "../../shared/Result.js";

export class Mediator implements IMediator {
  constructor(
    private readonly _handlers: Map<string, ICommandHandler<any, any>>,
    private readonly _logging: LoggingBehavior,
    private readonly _validators: Map<string, ValidationBehavior<any>>,
  ) {}

  async send<TResult>(command: object): Promise<Result<TResult>> {
    const name = command.constructor.name;
    const handler = this._handlers.get(name);
    if (!handler) {
      throw new InvalidCommandError(`Handler não encontrado: ${name}`);
    }

    const execute = (): Promise<Result<TResult>> =>
      handler.execute(command) as Promise<Result<TResult>>;

    const logged = (): Promise<Result<TResult>> =>
      this._logging.handle(name, execute);

    const validator = this._validators.get(name);
    if (validator) {
      return validator.handle(command, logged);
    }
    return logged();
  }
}

