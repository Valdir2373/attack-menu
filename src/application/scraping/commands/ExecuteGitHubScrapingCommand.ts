export class ExecuteGitHubScrapingCommand {
  constructor(
    public readonly keywords: string[],
    public readonly tempFile: string,
    public readonly whitelist?: string[],
    public readonly blacklist?: string[],
    public readonly onLog?: (msg: string) => void,
    public readonly onProgress?: (keywordsRemaining: number) => void,
  ) {}
}

