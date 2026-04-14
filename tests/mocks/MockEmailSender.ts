import type { IEmailSender } from "../../src/domain/ports/IEmailSender.js";

export class MockEmailSender implements IEmailSender {
  sent: { from: string; to: string; subject: string; body: string }[] = [];

  async send(from: string, _password: string, to: string, subject: string, body: string): Promise<void> {
    this.sent.push({ from, to, subject, body });
  }
}
