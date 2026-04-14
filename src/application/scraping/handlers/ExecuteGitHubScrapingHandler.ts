import type { ICommandHandler } from "../../../domain/patterns/ICommandHandler.js";
import type { IGitHubScraper } from "../../../domain/ports/IGitHubScraper.js";
import type { ExecuteGitHubScrapingCommand } from "../commands/ExecuteGitHubScrapingCommand.js";
import { Result } from "../../../shared/Result.js";

export class ExecuteGitHubScrapingHandler implements ICommandHandler<ExecuteGitHubScrapingCommand, number> {
  constructor(private readonly _scraper: IGitHubScraper) {}

  async execute(command: ExecuteGitHubScrapingCommand): Promise<Result<number>> {
    const result = await this._scraper.execute({
      keywords: command.keywords,
      tempFile: command.tempFile,
      whitelist: command.whitelist,
      blacklist: command.blacklist,
      onLog: command.onLog,
      onProgress: command.onProgress,
    });
    return Result.ok(result.scraped);
  }
}

