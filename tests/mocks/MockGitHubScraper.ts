import type {
  IGitHubScraper,
  IGitHubScraperOptions,
} from "../../src/domain/ports/IGitHubScraper.js";

export class MockGitHubScraper implements IGitHubScraper {
  public executeCalls: IGitHubScraperOptions[] = [];
  public executeResult: { scraped: number } = { scraped: 0 };
  public shouldThrow: Error | null = null;
  public validateCookieResult = true;

  async execute(options: IGitHubScraperOptions): Promise<{ scraped: number }> {
    this.executeCalls.push(options);
    if (this.shouldThrow) throw this.shouldThrow;
    return this.executeResult;
  }

  async validateCookie(_cookie: string): Promise<boolean> {
    return this.validateCookieResult;
  }

  reset(): void {
    this.executeCalls = [];
    this.executeResult = { scraped: 0 };
    this.shouldThrow = null;
    this.validateCookieResult = true;
  }
}
