import type { ICommandHandler } from "../../../domain/patterns/ICommandHandler.js";
import type { IMediator } from "../../../domain/patterns/IMediator.js";
import type { IFileStorage } from "../../common/IFileStorage.js";
import type { ICredentialEngineFactory } from "../../common/ICredentialEngine.js";
import type { ExecuteMongoValidationCommand } from "../commands/ExecuteMongoValidationCommand.js";
import type { ValidationResultDTO } from "../../dtos/ValidationResultDTO.js";
import { ValidateMongoCommand } from "../commands/ValidateMongoCommand.js";
import { FilesConfig } from "../../../config/files.config.js";
import { Result } from "../../../shared/Result.js";

const REGEX_MONGO_URI =
  /(mongodb(?:\+srv)?:\/\/[^@\s"'`\\{}<>]{1,150}@[^\s"'`\\{}<>]{10,})/i;

export class ExecuteMongoValidationHandler
  implements ICommandHandler<ExecuteMongoValidationCommand, { tested: number; validated: number }>
{
  constructor(
    private readonly _getMediator: () => IMediator,
    private readonly _engineFactory: ICredentialEngineFactory,
    private readonly _fileStorage: IFileStorage,
  ) {}

  async execute(command: ExecuteMongoValidationCommand): Promise<Result<{ tested: number; validated: number }>> {
    command.onLog("[>] Iniciando teste de credenciais MongoDB...");
    let tested = 0;
    let validated = 0;

    try {
      const fileExists = await this._fileStorage.exists(command.inputFile);
      if (!fileExists) {
        command.onLog(`[i] Arquivo nao encontrado: ${command.inputFile}`);
        command.onLog(`[+] Concluido -- ${tested} testado(s), ${validated} validado(s)`);
        return Result.ok({ tested, validated });
      }

      const existingCreds = await this._loadExistingCredentials(command.credentialsFile, command.onLog);
      const engine = this._engineFactory.create(
        [REGEX_MONGO_URI],
        async (uri) => {
          tested++;
          const result = await this._doValidate(uri, existingCreds, command.onLog);
          if (result) validated++;
          return result;
        },
        FilesConfig.mongoCredentials,
        async (creds) => {
          const sanitized = this._sanitizeUri(creds[0]);
          await this._fileStorage.appendFile(FilesConfig.mongoCredentials, "\n" + sanitized);
        },
      );

      const uniqueCount = await engine.countUnique(command.inputFile);
      command.onLog(`[*] ${uniqueCount} URI(s) unica(s) para testar`);

      if (uniqueCount > 0) {
        await engine.runFromFile(command.inputFile);
      } else {
        command.onLog("[i] Nenhuma URI MongoDB com credenciais encontrada.");
      }

      command.onLog(`[+] Concluido -- ${tested} testado(s), ${validated} validado(s)`);
    } catch (err: any) {
      command.onLog(`[ERROR] ${err.message}`);
    }

    return Result.ok({ tested, validated });
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

