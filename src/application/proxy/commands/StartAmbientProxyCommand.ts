import type { ProxyConfig } from "../../../domain/ports/IProxyManager.js";

export class StartAmbientProxyCommand {
  constructor(public readonly config?: ProxyConfig) {}
}

