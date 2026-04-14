import { createContext, useContext } from "react";
import { ConfigError } from "../../src/errors/index.js";
import type { IEmailController } from "../../src/application/email/IEmailController.js";
import type { IMongoController } from "../../src/application/mongo/IMongoController.js";
import type { ISupabaseController } from "../../src/application/supabase/ISupabaseController.js";
import type { IProxyController } from "../../src/application/proxy/IProxyController.js";
import type { IProxyReverseController } from "../../src/application/proxy/IProxyReverseController.js";
import type { IScraperController } from "../../src/application/scraping/IScraperController.js";
import type { IRansomController } from "../../src/application/ransom/IRansomController.js";
import type { IC2Controller }     from "../../src/application/c2/IC2Controller.js";
import type { IClipboard } from "../../src/application/common/IClipboard.js";
import type { IKeywordReader } from "../../src/application/common/IKeywordReader.js";
import type { IFileStorage } from "../../src/application/common/IFileStorage.js";
import type { ArtService } from "./ArtService.js";

export interface AppServices {
  emailController: IEmailController;
  mongoController: IMongoController;
  supabaseController: ISupabaseController;
  proxyController: IProxyController;
  proxyReverseController: IProxyReverseController;
  scraperController: IScraperController;
  ransomController: IRansomController;
  c2Controller:     IC2Controller;
  clipboardService: IClipboard;
  keywordReader: IKeywordReader;
  fileStorage: IFileStorage;
  artService: ArtService;
}

export const ServicesContext = createContext<AppServices | null>(null);

export function useServices(): AppServices {
  const ctx = useContext(ServicesContext);
  if (!ctx) throw new ConfigError("ServicesContext não foi fornecido — certifique-se de envolver <App> com o provider.");
  return ctx;
}

