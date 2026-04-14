import { Result } from "../../shared/Result.js";
import { randomUUID } from "crypto";

export class ScrapingResult {
  private constructor(
    public readonly id: string,
    public readonly keyword: string,
    public readonly repository: string,
    public readonly createdAt: Date,
  ) {}

  static criar(keyword: string, repository: string): Result<ScrapingResult> {
    if (!keyword) return Result.fail("Keyword não pode ser vazia");
    if (!repository) return Result.fail("Repository não pode ser vazio");
    return Result.ok(new ScrapingResult(randomUUID(), keyword, repository, new Date()));
  }
}

