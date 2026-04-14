import type { ICommandHandler } from "../../../domain/patterns/ICommandHandler.js";
import type { IMediator } from "../../../domain/patterns/IMediator.js";
import type { IFileStorage } from "../../common/IFileStorage.js";
import type { ExecuteMongoMassiveCommand } from "../commands/ExecuteMongoMassiveCommand.js";
import type { ValidationResultDTO } from "../../dtos/ValidationResultDTO.js";
import { ValidateMongoCommand } from "../commands/ValidateMongoCommand.js";
import { MassiveValidationUseCase } from "../../scraping/use-cases/MassiveValidationUseCase.js";
import { FilesConfig } from "../../../config/files.config.js";
import { Result } from "../../../shared/Result.js";

const REGEX_MONGO_URI =
  /(mongodb(?:\+srv)?:\/\/[^@\s"'`\\{}<>]{1,150}@[^\s"'`\\{}<>]{10,})/i;

export class ExecuteMongoMassiveHandler
  implements ICommandHandler<ExecuteMongoMassiveCommand, { scraped: number; validated: number }>
{
  constructor(
    private readonly _getMediator: () => IMediator,
    private readonly _massiveValidation: MassiveValidationUseCase,
    private readonly _fileStorage: IFileStorage,
  ) {}

  async execute(command: ExecuteMongoMassiveCommand): Promise<Result<{ scraped: number; validated: number }>> {
    const onLog = command.onLog ?? (() => {});
    onLog("[>] Iniciando pipeline MongoDB: scrape -> validacao...");

    const existingCreds = await this._loadExistingCredentials(command.credentialsFile, onLog);

    const result = await this._massiveValidation.execute({
      keywords: command.keywords,
      whitelist: command.whitelist,
      blacklist: command.blacklist,
      tempFile: FilesConfig.githubResults,
      patterns: [REGEX_MONGO_URI],
      validate: (uri) => this._doValidate(uri, existingCreds, onLog),
      outputFile: FilesConfig.mongoCredentials,
      saveFn: async (creds) => {
        const sanitized = this._sanitizeUri(creds[0]);
        await this._fileStorage.appendFile(FilesConfig.mongoCredentials, "\n" + sanitized);
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
      onLog(`[*] ${creds.size} URI(s) ja no banco`);
      return creds;
    } catch {
      onLog("[*] Banco vazio -- iniciando do zero");
      return new Set();
    }
  }

  private async _doValidate(uri: string, existingCreds: Set<string>, onLog: (msg: string) => void): Promise<boolean> {
    const sanitized = this._sanitizeUri(uri);
    const key = sanitized.toLowerCase();
    if (existingCreds.has(key)) { onLog(`[>] URI ja existe...`); return false; }

    let host = sanitized;
    try { host = new URL(sanitized).hostname; } catch { onLog(`[x] URI invalida -- descartada`); return false; }

    onLog(`[*] Testando: ${host}`);
    try {
      const result = await this._getMediator().send<ValidationResultDTO>(new ValidateMongoCommand(sanitized));
      const isValid = result.isSuccess && result.value!.isValid;
      onLog(isValid ? `[OK] ${host}` : `[x] ${host}`);
      if (isValid) existingCreds.add(key);
      return isValid;
    } catch (err: any) {
      onLog(`[x] ${host} - ${err.message.slice(0, 50)}`);
      return false;
    }
  }

  private _sanitizeUri(uri: string): string {
    let s = uri.replace(/#(?=[^@]*@)/, "%23");
    const qIdx = s.indexOf("?");
    if (qIdx !== -1) {
      const base = s.slice(0, qIdx);
      const cleanParams = s.slice(qIdx + 1).split("&")
        .filter((p) => { const [k, v] = p.split("="); return k && v && k.length > 1 && !k.includes("...") && !v.includes("..."); })
        .join("&");
      s = cleanParams ? `${base}?${cleanParams}` : base;
    }
    return s;
  }
}

