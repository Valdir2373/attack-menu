import type { Result } from "../../shared/Result.js";
import type { RansomSO } from "../../domain/ports/IRansomCompiler.js";

export interface RansomBuildDTO {
  binaryPath: string;
  buildId:    string;
  privKeyPem: string;
}

export interface RansomDbDTO {
  encrypted: number;
  db: string;
}

export interface RansomExampleDTO {
  filePath: string;
  db: string;
}

export type DbTarget = "Supabase" | "MongoDB" | "MySQL" | "PostgreSQL" | "Redis";

export interface IRansomController {
  compile(
    so: RansomSO,
    onLog: (msg: string) => void,
  ): Promise<Result<RansomBuildDTO>>;

  encryptDb(
    db: DbTarget,
    mode: "single" | "file",
    source: string,
    onLog: (msg: string) => void,
  ): Promise<Result<RansomDbDTO>>;

  generateExample(
    db: DbTarget,
    outputPath: string,
  ): Promise<Result<RansomExampleDTO>>;
}

