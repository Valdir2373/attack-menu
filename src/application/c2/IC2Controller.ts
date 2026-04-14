import type { Result } from "../../shared/Result.js";
import type { C2BuildResult } from "../../domain/ports/IC2Compiler.js";
import type { IC2RelayClient, C2Event } from "../../domain/ports/IC2RelayClient.js";
import type { C2ServerInfo } from "../../domain/ports/IC2ServerManager.js";

export interface C2BuildDTO {
  binaryPath: string;
  buildId:    string;
}

export interface IC2Controller {
  compile(serverUrl: string, onLog: (msg: string) => void): Promise<Result<C2BuildDTO>>;

  startServer(onLog: (msg: string) => void): Promise<Result<C2ServerInfo>>;
  stopServer(): Promise<void>;

  readonly relay: IC2RelayClient;
}

