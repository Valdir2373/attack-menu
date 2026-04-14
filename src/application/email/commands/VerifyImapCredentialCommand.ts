export class VerifyImapCredentialCommand {
  constructor(
    public readonly email: string,
    public readonly password: string,
  ) {}
}

