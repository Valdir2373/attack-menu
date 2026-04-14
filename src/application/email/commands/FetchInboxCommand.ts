export class FetchInboxCommand {
  constructor(
    public readonly email: string,
    public readonly password: string,
    public readonly limit: number = 15,
  ) {}
}

