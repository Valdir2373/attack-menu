import type { ICommandHandler } from "../../../domain/patterns/ICommandHandler.js";
import type { IReverseProxyModuleFactory } from "../reverse/IReverseProxyModuleFactory.js";
import type { IReverseProxyServer } from "../reverse/IReverseProxyServer.js";
import type { StartReverseProxyCommand } from "../commands/StartReverseProxyCommand.js";
import { Result } from "../../../shared/Result.js";

export class StartReverseProxyHandler implements ICommandHandler<StartReverseProxyCommand, void> {
  constructor(private readonly _factory: IReverseProxyModuleFactory) {}

  private _module: IReverseProxyServer | null = null;
  private _onExit: ((code: number | null) => void) | null = null;

  get module(): IReverseProxyServer | null { return this._module; }

  async execute(command: StartReverseProxyCommand): Promise<Result<void>> {
    if (this._module) return Result.ok(undefined);

    const logger = (raw: string) => {
      raw.split("\n").map((l) => l.trim()).filter((l) => l.length > 0).forEach((l) => {
        (command as any).onLog?.(l);
      });
    };

    this._module = this._factory.create(logger);
    this._onExit = (command as any).onExit ?? null;

    this._module.start(command.config, (err) => {
      logger(`[ERRO] ${err.message}`);
      this._cleanup();
      this._onExit?.(1);
    });

    return Result.ok(undefined);
  }

  stop(): void {
    if (!this._module) return;
    this._module.stop();
    const onExit = this._onExit;
    this._cleanup();
    onExit?.(0);
  }

  private _cleanup(): void {
    this._module = null;
    this._onExit = null;
  }
}

