import type { ICommandHandler } from "../../../domain/patterns/ICommandHandler.js";
import type { IProxyManager } from "../../../domain/ports/IProxyManager.js";
import type { RefreshProxyStatusCommand } from "../commands/RefreshProxyStatusCommand.js";
import type { ProxyStatusDTO } from "../dto/ProxyStatusDTO.js";
import { Result } from "../../../shared/Result.js";

export class RefreshProxyStatusHandler implements ICommandHandler<RefreshProxyStatusCommand, ProxyStatusDTO> {
  constructor(private readonly _proxyManager: IProxyManager) {}

  async execute(_command: RefreshProxyStatusCommand): Promise<Result<ProxyStatusDTO>> {
    const status = await this._proxyManager.status();
    return Result.ok({ running: status.running, port: status.port, containerName: status.containerName });
  }
}

