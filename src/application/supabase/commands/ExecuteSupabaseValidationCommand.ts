export class ExecuteSupabaseValidationCommand {
  constructor(
    public readonly inputFile: string,
    public readonly credentialsFile: string,
    public readonly onLog: (msg: string) => void,
  ) {}
}

