import type { ICommandHandler } from "../../../domain/patterns/ICommandHandler.js";
import type { IGitHubScraper } from "../../../domain/ports/IGitHubScraper.js";
import type { ValidateGitHubBotCommand } from "../commands/ValidateGitHubBotCommand.js";
import type { ValidationResultDTO } from "../../dtos/ValidationResultDTO.js";
import { GithubConfig } from "../../../config/github.config.js";
import { Result } from "../../../shared/Result.js";

export class ValidateGitHubBotHandler implements ICommandHandler<ValidateGitHubBotCommand, ValidationResultDTO> {
  constructor(private readonly _scraper: IGitHubScraper) {}

  async execute(command: ValidateGitHubBotCommand): Promise<Result<ValidationResultDTO>> {
    let cookie: string;
    try { cookie = GithubConfig.getCookie(command.botIndex); } catch { return Result.ok({ isValid: false }); }
    const isValid = await this._scraper.validateCookie(cookie);
    return Result.ok({ isValid });
  }
}

