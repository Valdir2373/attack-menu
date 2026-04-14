import type { ICommandHandler } from "../../../domain/patterns/ICommandHandler.js";
import type { StopReverseProxyCommand } from "../commands/StopReverseProxyCommand.js";
import { Result } from "../../../shared/Result.js";

export class StopReverseProxyHandler implements ICommandHandler<StopReverseProxyCommand, void> {
  async execute(_command: StopReverseProxyCommand): Promise<Result<void>> {
    return Result.ok(undefined);
  }
}

