import type { OpenWindow } from "./App.js";
import { EmailWindow } from "./EmailWindow.js";
import { WebScraperWindow } from "./WebScraperWindow.js";
import { MongoTestWindow } from "./MongoTestWindow.js";
import { SupabaseTestWindow } from "./SupabaseTestWindow.js";
import { ProxyReverseWindow } from "./ProxyReverseWindow.js";
import { RansomWindow } from "./RansomWindow.js";
import { C2Window }     from "./C2Window.js";
import { SettingsWindow } from "./SettingsWindow.js";
import { FilesConfig } from "../../src/config/files.config.js";

export interface WindowConfig {
  component: React.FC<any>;
  extraProps?: () => Record<string, unknown>;
}

export const WINDOW_REGISTRY: Record<OpenWindow["type"], WindowConfig> = {
  "email":         { component: EmailWindow },
  "web-scraper":   { component: WebScraperWindow },
  "mongo-test":    { component: MongoTestWindow, extraProps: () => ({ inputFile: FilesConfig.githubResults }) },
  "supabase":      { component: SupabaseTestWindow, extraProps: () => ({ inputFile: FilesConfig.supabaseResults }) },
  "proxy-reverse": { component: ProxyReverseWindow },
  "ransom":        { component: RansomWindow },
  "c2":            { component: C2Window },
  "settings":      { component: SettingsWindow },
};

