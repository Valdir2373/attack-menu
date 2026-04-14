export interface IGitHubScraperOptions {
  keywords: string[];
  tempFile: string;
  whitelist?: string[];
  blacklist?: string[];
  headless?: boolean;
  onLog?: (msg: string) => void;
  onProgress?: (keywordsRemaining: number) => void;
}

export interface IGitHubScraper {
  execute(options: IGitHubScraperOptions): Promise<{ scraped: number }>;
  validateCookie(cookie: string): Promise<boolean>;
}

