import type { IMediator } from "../../domain/patterns/IMediator.js";
import type { ProxyConfig } from "../../domain/ports/IProxyManager.js";
import type { ProxyStatusDTO } from "../../application/proxy/dto/ProxyStatusDTO.js";
import type { IProxyController } from "../../application/proxy/IProxyController.js";
import { StartAmbientProxyCommand } from "../../application/proxy/commands/StartAmbientProxyCommand.js";
import { StopAmbientProxyCommand } from "../../application/proxy/commands/StopAmbientProxyCommand.js";
import { RefreshProxyStatusCommand } from "../../application/proxy/commands/RefreshProxyStatusCommand.js";
import { Observable } from "../../shared/Observable.js";
import { Result } from "../../shared/Result.js";

const IDLE_STATUS: ProxyStatusDTO = { running: false, port: 0, containerName: "" };

export class ProxyController implements IProxyController {
  private readonly _status$: Observable<ProxyStatusDTO>;

  constructor(private readonly _mediator: IMediator) {
    this._status$ = new Observable<ProxyStatusDTO>(IDLE_STATUS);
  }

  get status$(): Observable<ProxyStatusDTO> {
    return this._status$;
  }

  async startAmbient(config?: ProxyConfig): Promise<Result<void>> {
    const result = await this._mediator.send<void>(new StartAmbientProxyCommand(config));
    if (result.isSuccess) await this.refreshStatus();
    return result;
  }

  async stopAmbient(): Promise<Result<void>> {
    const result = await this._mediator.send<void>(new StopAmbientProxyCommand());
    if (result.isSuccess) await this.refreshStatus();
    return result;
  }

  async refreshStatus(): Promise<ProxyStatusDTO> {
    const result = await this._mediator.send<ProxyStatusDTO>(new RefreshProxyStatusCommand());
    const status = result.isSuccess ? result.value! : IDLE_STATUS;
    this._status$.emit(status);
    return status;
  }
}

