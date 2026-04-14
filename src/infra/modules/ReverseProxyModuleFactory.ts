import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { IReverseProxyModuleFactory } from "../../application/proxy/reverse/IReverseProxyModuleFactory.js";
import { IReverseProxyServer } from "../../application/proxy/reverse/IReverseProxyServer.js";
import { RulesJsonRepository } from "../adapters/proxy/reverse/RulesJsonRepository.js";
import { BlockEngine } from "../adapters/proxy/reverse/BlockEngine.js";
import { ReplaceEngine } from "../adapters/proxy/reverse/ReplaceEngine.js";
import { HtmlSanitizer } from "../adapters/proxy/reverse/HtmlSanitizer.js";
import { FetchHttpClient } from "../adapters/proxy/reverse/FetchHttpClient.js";
import { ProcessProxyRequestUseCase } from "../../application/proxy/reverse/ProcessProxyRequestUseCase.js";
import { ExpressReverseProxyServer } from "../adapters/proxy/reverse/ExpressReverseProxyServer.js";

const RULES_PATH = resolve(dirname(fileURLToPath(import.meta.url)), "../../../rules.json");

export class ReverseProxyModuleFactory implements IReverseProxyModuleFactory {
  create(logger: (line: string) => void): IReverseProxyServer {
    const rulesRepo     = new RulesJsonRepository(RULES_PATH);
    const blockEngine   = new BlockEngine();
    const replaceEngine = new ReplaceEngine();
    const htmlSanitizer = new HtmlSanitizer(blockEngine);
    const httpClient    = new FetchHttpClient();

    const useCase = new ProcessProxyRequestUseCase(
      rulesRepo, blockEngine, replaceEngine, htmlSanitizer, httpClient,
    );

    return new ExpressReverseProxyServer(useCase, logger);
  }
}

