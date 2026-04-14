export class SendEmailCommand {
  constructor(
    public readonly fromEmail: string,
    public readonly fromPassword: string,
    public readonly to: string,
    public readonly subject: string,
    public readonly body: string,
    public readonly onStatus?: (msg: string) => void,
  ) {}
}

