import type { ICommandHandler } from "../../../domain/patterns/ICommandHandler.js";
import type { IProxyManager } from "../../../domain/ports/IProxyManager.js";
import type { StartAmbientProxyCommand } from "../commands/StartAmbientProxyCommand.js";
import { Result } from "../../../shared/Result.js";

export class StartAmbientProxyHandler implements ICommandHandler<StartAmbientProxyCommand, void> {
  constructor(private readonly _proxyManager: IProxyManager) {}

  async execute(command: StartAmbientProxyCommand): Promise<Result<void>> {
    await this._proxyManager.start(command.config);
    return Result.ok(undefined);
  }
}

