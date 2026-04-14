import type { ICommandHandler } from "../../../domain/patterns/ICommandHandler.js";
import type { IProxyManager } from "../../../domain/ports/IProxyManager.js";
import type { StopAmbientProxyCommand } from "../commands/StopAmbientProxyCommand.js";
import { Result } from "../../../shared/Result.js";

export class StopAmbientProxyHandler implements ICommandHandler<StopAmbientProxyCommand, void> {
  constructor(private readonly _proxyManager: IProxyManager) {}

  async execute(_command: StopAmbientProxyCommand): Promise<Result<void>> {
    await this._proxyManager.stop();
    return Result.ok(undefined);
  }
}

