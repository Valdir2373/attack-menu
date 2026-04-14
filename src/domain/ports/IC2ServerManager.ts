import type { Result } from "../../shared/Result.js";

export interface C2ServerInfo {
  wsUrl: string;
  token: string;
}

export interface IC2ServerManager {
  start(): Promise<Result<C2ServerInfo>>;
  stop(): Promise<void>;
  isRunning(): Promise<boolean>;
}
