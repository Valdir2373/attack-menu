export class ExecuteSupabaseMassiveCommand {
  constructor(
    public readonly keywords: string[],
    public readonly credentialsFile: string,
    public readonly whitelist?: string[],
    public readonly blacklist?: string[],
    public readonly onLog?: (msg: string) => void,
    public readonly onProgress?: (remaining: number) => void,
  ) {}
}

