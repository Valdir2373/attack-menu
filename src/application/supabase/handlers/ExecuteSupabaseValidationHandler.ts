import type { ICommandHandler } from "../../../domain/patterns/ICommandHandler.js";
import type { IMediator } from "../../../domain/patterns/IMediator.js";
import type { IFileStorage } from "../../common/IFileStorage.js";
import type { ICredentialEngineFactory } from "../../common/ICredentialEngine.js";
import type { ExecuteSupabaseValidationCommand } from "../commands/ExecuteSupabaseValidationCommand.js";
import type { ValidationResultDTO } from "../../dtos/ValidationResultDTO.js";
import { ValidateSupabaseCommand } from "../commands/ValidateSupabaseCommand.js";
import { FilesConfig } from "../../../config/files.config.js";
import { Result } from "../../../shared/Result.js";

const REGEX_SUPABASE_URL = /(https?:\/\/[a-z0-9-]+\.supabase\.co)/i;
const REGEX_SUPABASE_KEY = /(eyJ[A-Za-z0-9._-]{80,})/;

export class ExecuteSupabaseValidationHandler
  implements ICommandHandler<ExecuteSupabaseValidationCommand, { tested: number; validated: number }>
{
  constructor(
    private readonly _getMediator: () => IMediator,
    private readonly _engineFactory: ICredentialEngineFactory,
    private readonly _fileStorage: IFileStorage,
  ) {}

  async execute(command: ExecuteSupabaseValidationCommand): Promise<Result<{ tested: number; validated: number }>> {
    command.onLog("[>] Iniciando teste de credenciais Supabase...");
    let tested = 0;
    let validated = 0;

    try {
      const existingCreds = await this._loadExistingCredentials(command.credentialsFile, command.onLog);
      const engine = this._engineFactory.create(
        [REGEX_SUPABASE_URL, REGEX_SUPABASE_KEY],
        async (url, key) => {
          tested++;
          const result = await this._doValidate(url, key, existingCreds, command.onLog);
          if (result) validated++;
          return result;
        },
        FilesConfig.supabaseCredentials,
        async (creds) => {
          await this._fileStorage.appendFile(FilesConfig.supabaseCredentials, `\n${creds[0]}|${creds[1]}`);
        },
      );

      const uniqueCount = await engine.countUnique(command.inputFile);
      command.onLog(`[*] ${uniqueCount} par(s) URL+Key para testar`);

      if (uniqueCount > 0) {
        await engine.runFromFile(command.inputFile);
      } else {
        command.onLog("[i] Nenhuma credencial Supabase encontrada.");
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

