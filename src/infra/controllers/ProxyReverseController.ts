import type { IMediator } from "../../domain/patterns/IMediator.js";
import { StartReverseProxyCommand, type ReverseProxyConfig } from "../../application/proxy/commands/StartReverseProxyCommand.js";
import { StopReverseProxyCommand } from "../../application/proxy/commands/StopReverseProxyCommand.js";
import { Result } from "../../shared/Result.js";
import type { IProxyReverseController, ProxyReverseStatus } from "../../application/proxy/IProxyReverseController.js";

export type { ProxyReverseStatus };

export class ProxyReverseController implements IProxyReverseController {
  private _running = false;
  private _targetUrl: string | null = null;
  private _port: number | null = null;

  constructor(private readonly _mediator: IMediator) {}

  get status(): ProxyReverseStatus {
    return {
      running:   this._running,
      targetUrl: this._targetUrl,
      port:      this._port,
      localUrl:  this._port ? `http://localhost:${this._port}` : null,
    };
  }

  async start(
    targetUrl: string,
    port = 1212,
    onLog: (line: string) => void,
    onExit: (code: number | null) => void,
  ): Promise<Result<void>> {
    if (this._running) return Result.ok(undefined);

    this._targetUrl = targetUrl;
    this._port = port;
    this._running = true;

    const command = new StartReverseProxyCommand({ targetUrl, port }) as any;
    command.onLog = (raw: string) => {
      raw.split("\n").map((l: string) => l.trim()).filter((l: string) => l.length > 0).forEach((l: string) => onLog(l));
    };
    command.onExit = (code: number | null) => {
      this._cleanup();
      onExit(code);
    };

    return this._mediator.send<void>(command);
  }

  async stop(): Promise<Result<void>> {
    if (!this._running) return Result.ok(undefined);
    const result = await this._mediator.send<void>(new StopReverseProxyCommand());
    this._cleanup();
    return result;
  }

  private _cleanup(): void {
    this._running = false;
    this._targetUrl = null;
    this._port = null;
  }
}

