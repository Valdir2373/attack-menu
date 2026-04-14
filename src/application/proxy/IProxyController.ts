import type { Result } from "../../shared/Result.js";
import type { Observable } from "../../shared/Observable.js";
import type { ProxyStatusDTO } from "./dto/ProxyStatusDTO.js";
import type { ProxyConfig } from "../../domain/ports/IProxyManager.js";

export interface IProxyController {
  readonly status$: Observable<ProxyStatusDTO>;
  startAmbient(config?: ProxyConfig): Promise<Result<void>>;
  stopAmbient(): Promise<Result<void>>;
  refreshStatus(): Promise<ProxyStatusDTO>;
}

