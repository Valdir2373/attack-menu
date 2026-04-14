import type { IMediator } from "../../domain/patterns/IMediator.js";
import type { IScraperController } from "../../application/scraping/IScraperController.js";
import type { ValidationResultDTO } from "../../application/dtos/ValidationResultDTO.js";
import { ExecuteGitHubScrapingCommand } from "../../application/scraping/commands/ExecuteGitHubScrapingCommand.js";
import { ValidateGitHubBotCommand } from "../../application/scraping/commands/ValidateGitHubBotCommand.js";
import { ReadKeywordsCommand } from "../../application/scraping/commands/ReadKeywordsCommand.js";
import { GithubConfig } from "../../config/github.config.js";
import { Result } from "../../shared/Result.js";

export class ScraperController implements IScraperController {
  constructor(private readonly _mediator: IMediator) {}

  getMaxBots(): number {
    return GithubConfig.getAvailableBots().length;
  }

  async execute(
    keywords: string[], tempFile: string,
    whitelist?: string[], blacklist?: string[],
    onLog?: (msg: string) => void,
    onProgress?: (keywordsRemaining: number) => void,
  ): Promise<Result<number>> {
    return this._mediator.send<number>(
      new ExecuteGitHubScrapingCommand(keywords, tempFile, whitelist, blacklist, onLog, onProgress),
    );
  }

  async validateBot(botIndex: number): Promise<Result<ValidationResultDTO>> {
    return this._mediator.send<ValidationResultDTO>(new ValidateGitHubBotCommand(botIndex));
  }

  async readKeywords(filePath: string): Promise<Result<string[]>> {
    return this._mediator.send<string[]>(new ReadKeywordsCommand(filePath));
  }
}

