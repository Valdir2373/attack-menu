export interface IEmailSender {
  send(
    from: string,
    password: string,
    to: string,
    subject: string,
    body: string,
  ): Promise<void>;
}

