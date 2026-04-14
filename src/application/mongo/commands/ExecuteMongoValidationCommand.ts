export class ExecuteMongoValidationCommand {
  constructor(
    public readonly inputFile: string,
    public readonly credentialsFile: string,
    public readonly onLog: (msg: string) => void,
    public readonly onProgress?: (remaining: number) => void,
  ) {}
}

