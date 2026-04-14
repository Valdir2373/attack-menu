import type { Result } from "../../shared/Result.js";

export interface ProxyReverseStatus {
  running: boolean;
  targetUrl: string | null;
  port: number | null;
  localUrl: string | null;
}

export interface IProxyReverseController {
  readonly status: ProxyReverseStatus;
  start(targetUrl: string, port: number, onLog: (line: string) => void, onExit: (code: number | null) => void): Promise<Result<void>>;
  stop(): Promise<Result<void>>;
}

