import type { ICommandHandler } from "../../../domain/patterns/ICommandHandler.js";
import type { IImapListener } from "../../../domain/ports/IImapListener.js";
import type { ImapStartListenCommand } from "../commands/ImapStartListenCommand.js";
import { Result } from "../../../shared/Result.js";

export class ImapStartListenHandler implements ICommandHandler<ImapStartListenCommand, void> {
  constructor(private readonly _listenerFactory: () => IImapListener) {}

  private _listener: IImapListener | null = null;

  get listener(): IImapListener | null { return this._listener; }

  async execute(command: ImapStartListenCommand): Promise<Result<void>> {
    this._listener = this._listenerFactory();
    await this._listener.connect(command.email, command.password, command.onEvent);
    return Result.ok(undefined);
  }
}

