import type { Result } from "../../shared/Result.js";

export interface C2BuildResult {
  binaryPath: string;
  buildId:    string;
}

export interface IC2Compiler {
  compile(serverUrl: string): Promise<Result<C2BuildResult>>;
}

