export class ValidateEmailCommand {
  constructor(
    public readonly email: string,
    public readonly password: string,
  ) {}
}

