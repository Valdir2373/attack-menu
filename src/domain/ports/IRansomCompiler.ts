import type { Result } from "../../shared/Result.js";

export type RansomSO = "linux" | "windows";

export interface RansomBuildResult {
  binaryPath: string;
  buildId:    string;
  privKeyPem: string;
}

export interface IRansomCompiler {
  compile(so: RansomSO): Promise<Result<RansomBuildResult>>;
}

