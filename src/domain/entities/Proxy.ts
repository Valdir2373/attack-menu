import { Result } from "../../shared/Result.js";

export type ProxyStatusType = "stopped" | "starting" | "running" | "stopping" | "error";

export class Proxy {
  private _status: ProxyStatusType = "stopped";
  private _port: number = 0;
  private _containerName: string = "";

  private constructor() {}

  static criar(): Proxy {
    return new Proxy();
  }

  get status(): ProxyStatusType { return this._status; }
  get port(): number { return this._port; }
  get containerName(): string { return this._containerName; }

  transitionTo(status: ProxyStatusType, info?: { port?: number; containerName?: string }): Result<void> {
    const validTransitions: Record<ProxyStatusType, ProxyStatusType[]> = {
      stopped: ["starting"],
      starting: ["running", "error"],
      running: ["stopping", "error"],
      stopping: ["stopped", "error"],
      error: ["starting", "stopped"],
    };
    if (!validTransitions[this._status]?.includes(status)) {
      return Result.fail(`Transição inválida: ${this._status} → ${status}`);
    }
    this._status = status;
    if (info?.port) this._port = info.port;
    if (info?.containerName) this._containerName = info.containerName;
    return Result.ok(undefined);
  }
}

