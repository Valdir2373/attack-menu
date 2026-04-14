import type { Result } from "../../shared/Result.js";
import type { ValidationResultDTO } from "../dtos/ValidationResultDTO.js";

export interface IScraperController {
  getMaxBots(): number;
  execute(keywords: string[], tempFile: string, whitelist?: string[], blacklist?: string[], onLog?: (msg: string) => void, onProgress?: (keywordsRemaining: number) => void): Promise<Result<number>>;
  validateBot(botIndex: number): Promise<Result<ValidationResultDTO>>;
  readKeywords(filePath: string): Promise<Result<string[]>>;
}

