import type { ICommandHandler } from "../../../domain/patterns/ICommandHandler.js";
import type { IMediator } from "../../../domain/patterns/IMediator.js";
import type { IFileStorage } from "../../common/IFileStorage.js";
import type { ExecuteSupabaseMassiveCommand } from "../commands/ExecuteSupabaseMassiveCommand.js";
import type { ValidationResultDTO } from "../../dtos/ValidationResultDTO.js";
import { ValidateSupabaseCommand } from "../commands/ValidateSupabaseCommand.js";
import { MassiveValidationUseCase } from "../../scraping/use-cases/MassiveValidationUseCase.js";
import { FilesConfig } from "../../../config/files.config.js";
import { Result } from "../../../shared/Result.js";

const REGEX_SUPABASE_URL = /(https?:\/\/[a-z0-9-]+\.supabase\.co)/i;
const REGEX_SUPABASE_KEY = /(eyJ[A-Za-z0-9._-]{80,})/;

export class ExecuteSupabaseMassiveHandler
  implements ICommandHandler<ExecuteSupabaseMassiveCommand, { scraped: number; validated: number }>
{
  constructor(
    private readonly _getMediator: () => IMediator,
    private readonly _massiveValidation: MassiveValidationUseCase,
    private readonly _fileStorage: IFileStorage,
  ) {}

  async execute(command: ExecuteSupabaseMassiveCommand): Promise<Result<{ scraped: number; validated: number }>> {
    const onLog = command.onLog ?? (() => {});
    onLog("[>] Iniciando pipeline Supabase: scrape -> validacao...");

    const existingCreds = await this._loadExistingCredentials(command.credentialsFile, onLog);

    const result = await this._massiveValidation.execute({
      keywords: command.keywords,
      whitelist: command.whitelist,
      blacklist: command.blacklist,
      tempFile: FilesConfig.supabaseResults,
      patterns: [REGEX_SUPABASE_URL, REGEX_SUPABASE_KEY],
      validate: (url, key) => this._doValidate(url, key, existingCreds, onLog),
      outputFile: FilesConfig.supabaseCredentials,
      saveFn: async (creds) => {
        await this._fileStorage.appendFile(FilesConfig.supabaseCredentials, `\n${creds[0]}|${creds[1]}`);
      },
      onLog,
      onProgress: command.onProgress,
    });
    if (result.isFailure) {
      onLog(`[ERROR] ${result.error}`);
      return Result.ok({ scraped: 0, validated: 0 });
    }
    return Result.ok(result.value!);
  }

  private async _loadExistingCredentials(credFilePath: string, onLog: (msg: string) => void): Promise<Set<string>> {
    try {
      const content = await this._fileStorage.readFile(credFilePath);
      const creds = new Set(content.trim().split("\n").filter(Boolean).map((l) => l.toLowerCase().trim()));
      onLog(`[*] ${creds.size} credencial(is) ja no banco`);
      return creds;
    } catch {
      onLog("[*] Banco vazio -- iniciando do zero");
      return new Set();
    }
  }

  private async _doValidate(url: string, key: string, existingCreds: Set<string>, onLog: (msg: string) => void): Promise<boolean> {
    const credKey = `${url.toLowerCase()}|${key.toLowerCase()}`;
    if (existingCreds.has(credKey)) { onLog(`[>] Credencial ja existe...`); return false; }

    const projectRef = url.match(/([a-z0-9-]+)\.supabase\.co/i)?.[1] ?? url;
    onLog(`[*] Testando: ${projectRef}`);

    try {
      const result = await this._getMediator().send<ValidationResultDTO>(new ValidateSupabaseCommand(url, key));
      const isValid = result.isSuccess && result.value!.isValid;
      onLog(isValid ? `[OK] ${projectRef}` : `[x] ${projectRef}`);
      if (isValid) existingCreds.add(credKey);
      return isValid;
    } catch (err: any) {
      onLog(`[x] ${projectRef} - ${err.message.slice(0, 50)}`);
      return false;
    }
  }
}

