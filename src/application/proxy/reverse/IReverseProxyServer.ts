import { ReverseProxyConfig } from "../commands/StartReverseProxyCommand.js";

export interface IReverseProxyServer {
  start(config: ReverseProxyConfig, onError?: (err: Error) => void): void;
  stop(): void;
}

