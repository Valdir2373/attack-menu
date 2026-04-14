import type { Result } from "../../shared/Result.js";

export interface ISupabaseController {
  executeValidation(inputFile: string, credentialsFile: string, onLog: (msg: string) => void): Promise<Result<{ tested: number; validated: number }>>;
  executeMassive(keywords: string[], credentialsFile: string, onLog: (msg: string) => void, whitelist?: string[], blacklist?: string[], onProgress?: (remaining: number) => void): Promise<Result<{ scraped: number; validated: number }>>;
}

