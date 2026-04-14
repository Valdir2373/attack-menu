import { IGitHubScraper } from "../../../domain/ports/IGitHubScraper.js";
import { ICredentialEngineFactory } from "../../common/ICredentialEngine.js";
import { Result } from "../../../shared/Result.js";


export interface MassiveValidationInput {
  keywords: string[];
  whitelist?: string[];
  blacklist?: string[];
  tempFile: string;
  patterns: RegExp[];
  validate: (...args: string[]) => Promise<boolean>;
  outputFile: string;
  saveFn?: (creds: string[]) => Promise<void>;
  onLog?: (msg: string) => void;
  onProgress?: (keywordsRemaining: number) => void;
}

export interface MassiveValidationResult {
  scraped: number;
  validated: number;
}


export class MassiveValidationUseCase {
  constructor(
    private readonly scraper: IGitHubScraper,
    private readonly engineFactory: ICredentialEngineFactory,
  ) {}

  async execute(input: MassiveValidationInput): Promise<Result<MassiveValidationResult>> {
    if (!input.patterns.length) {
      return Result.fail("Nenhum padrão de extração fornecido");
    }

    const log = input.onLog ?? (() => {});
    const scraped = await this._executeScraping(input, log);
    const validated = await this._executeValidation(input, log);

    log(`[+] Concluído — ${scraped} scrapeado(s), ${validated} validado(s)`);
    return Result.ok({ scraped, validated });
  }


  private async _executeScraping(
    input: MassiveValidationInput,
    log: (msg: string) => void,
  ): Promise<number> {
    log("[>] Iniciando scraping no GitHub...");
    try {
      const result = await this.scraper.execute({
        keywords: input.keywords,
        tempFile: input.tempFile,
        whitelist: input.whitelist,
        blacklist: input.blacklist,
        headless: true,
        onLog: log,
        onProgress: input.onProgress,
      });
      log(`[+] ${result.scraped} bloco(s) encontrado(s)`);
      return result.scraped;
    } catch (err: unknown) {
      log(`[ERROR] Scraping: ${(err as Error).message}`);
      return 0;
    }
  }

  private async _executeValidation(
    input: MassiveValidationInput,
    log: (msg: string) => void,
  ): Promise<number> {
    log("[>] Iniciando validação de credenciais...");
    let validated = 0;

    const trackingValidate = async (...args: string[]): Promise<boolean> => {
      const ok = await input.validate(...args);
      if (ok) validated++;
      return ok;
    };

    try {
      const engine = this.engineFactory.create(
        input.patterns, trackingValidate, input.outputFile, input.saveFn,
      );
      const unique = await engine.countUnique(input.tempFile);
      log(`[◆] ${unique} credencial(is) única(s) para validar`);
      if (unique > 0) {
        await engine.runFromFile(input.tempFile);
      } else {
        log("[i] Nada para validar.");
      }
    } catch (err: unknown) {
      log(`[ERROR] Validação: ${(err as Error).message}`);
    }

    return validated;
  }
}

