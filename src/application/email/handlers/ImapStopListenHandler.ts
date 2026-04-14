import type { ICommandHandler } from "../../../domain/patterns/ICommandHandler.js";
import type { IImapListener } from "../../../domain/ports/IImapListener.js";
import type { ImapStopListenCommand } from "../commands/ImapStopListenCommand.js";
import { Result } from "../../../shared/Result.js";

export class ImapStopListenHandler implements ICommandHandler<ImapStopListenCommand, void> {
  private _listener: IImapListener | null = null;

  setListener(listener: IImapListener | null): void { this._listener = listener; }

  async execute(_command: ImapStopListenCommand): Promise<Result<void>> {
    if (this._listener) {
      await this._listener.disconnect();
      this._listener = null;
    }
    return Result.ok(undefined);
  }
}

