import type { ICommandHandler } from "../../../domain/patterns/ICommandHandler.js";
import type { IMediator } from "../../../domain/patterns/IMediator.js";
import type { IFileStorage } from "../../common/IFileStorage.js";
import type { ExecuteScrapValidatePipelineCommand } from "../commands/ExecuteScrapValidatePipelineCommand.js";
import type { ValidationResultDTO } from "../../dtos/ValidationResultDTO.js";
import { ValidateEmailCommand } from "../../email/commands/ValidateEmailCommand.js";
import { MassiveValidationUseCase } from "../use-cases/MassiveValidationUseCase.js";
import { FilesConfig } from "../../../config/files.config.js";
import { Result } from "../../../shared/Result.js";

const REGEX_EMAIL = /\b[a-zA-Z0-9._%+-]+@gmail\.com\b/i;
const REGEX_PASS  = /\b([a-z]{4}[- ]?[a-z]{4}[- ]?[a-z]{4}[- ]?[a-z]{4}|[a-z]{16})\b/;

export class ExecuteScrapValidatePipelineHandler
  implements ICommandHandler<ExecuteScrapValidatePipelineCommand, { scraped: number; validated: number }>
{
  constructor(
    private readonly _getMediator: () => IMediator,
    private readonly _massiveValidation: MassiveValidationUseCase,
    private readonly _fileStorage: IFileStorage,
  ) {}

  async execute(command: ExecuteScrapValidatePipelineCommand): Promise<Result<{ scraped: number; validated: number }>> {
    command.onLog("[>] Iniciando pipeline email: scrape -> validacao...");

    const existingEmails = await this._loadExistingEmails(command.onLog);

    const result = await this._massiveValidation.execute({
      keywords: command.keywords,
      whitelist: command.whitelist.length > 0 ? command.whitelist : undefined,
      blacklist: command.blacklist.length > 0 ? command.blacklist : undefined,
      tempFile: FilesConfig.githubResults,
      patterns: [REGEX_EMAIL, REGEX_PASS],
      validate: (email, pass) => this._validateCredential(email, pass, existingEmails, command.onLog),
      outputFile: FilesConfig.emailCredentials,
      onLog: command.onLog,
      onProgress: command.onProgress,
    });
    if (result.isFailure) {
      command.onLog(`[ERROR] ${result.error}`);
      return Result.ok({ scraped: 0, validated: 0 });
    }
    return Result.ok(result.value!);
  }

  private async _loadExistingEmails(onLog: (msg: string) => void): Promise<Set<string>> {
    try {
      const content = await this._fileStorage.readFile(FilesConfig.emailCredentials);
      const emails = new Set(
        content.trim().split("\n").filter(Boolean).map((line) => line.split(":")[0].toLowerCase().trim()),
      );
      onLog(`[*] ${emails.size} email(s) ja no banco`);
      return emails;
    } catch {
      onLog("[*] Banco vazio -- iniciando do zero");
      return new Set();
    }
  }

  private async _validateCredential(
    email: string,
    pass: string,
    existingEmails: Set<string>,
    onLog: (msg: string) => void,
  ): Promise<boolean> {
    if (existingEmails.has(email.toLowerCase())) {
      onLog(`[>] ${email} ja existe...`);
      return false;
    }
    onLog(`[*] Validando: ${email}`);
    const result = await this._getMediator().send<ValidationResultDTO>(new ValidateEmailCommand(email, pass));
    const isValid = result.isSuccess && result.value!.isValid;
    if (isValid) existingEmails.add(email.toLowerCase());
    onLog(isValid ? `[OK] ${email}` : `[x] ${email}`);
    return isValid;
  }
}

