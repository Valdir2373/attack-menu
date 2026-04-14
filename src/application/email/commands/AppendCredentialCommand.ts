export class AppendCredentialCommand {
  constructor(
    public readonly filePath: string,
    public readonly email: string,
    public readonly password: string,
  ) {}
}

