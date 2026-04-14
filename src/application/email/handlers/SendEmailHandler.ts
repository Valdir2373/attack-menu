import type { ICommandHandler } from "../../../domain/patterns/ICommandHandler.js";
import type { IEmailSender } from "../../../domain/ports/IEmailSender.js";
import type { SendEmailCommand } from "../commands/SendEmailCommand.js";
import { Result } from "../../../shared/Result.js";

export class SendEmailHandler implements ICommandHandler<SendEmailCommand, void> {
  constructor(private readonly _emailSender: IEmailSender) {}

  async execute(command: SendEmailCommand): Promise<Result<void>> {
    command.onStatus?.("[>] Configurando transporte SMTP...");
    command.onStatus?.("[>] Enviando...");
    await this._emailSender.send(command.fromEmail, command.fromPassword, command.to, command.subject, command.body);
    command.onStatus?.(`[OK] Enviado para ${command.to}`);
    return Result.ok(undefined);
  }
}

