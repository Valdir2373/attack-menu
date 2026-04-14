import type { IMediator } from "../../domain/patterns/IMediator.js";
import type { EmailCredentialDTO } from "../../application/email/dto/EmailCredentialDTO.js";
import type { FetchedEmailDTO } from "../../application/email/dto/FetchedEmailDTO.js";
import type { EmailOutputDTO } from "../../application/email/dto/EmailOutputDTO.js";
import type { ImapEventCallback } from "../../application/email/dto/ImapEventDTO.js";
import type { ValidationResultDTO } from "../../application/dtos/ValidationResultDTO.js";
import type { IEmailController } from "../../application/email/IEmailController.js";
import { SendEmailCommand } from "../../application/email/commands/SendEmailCommand.js";
import { FetchInboxCommand } from "../../application/email/commands/FetchInboxCommand.js";
import { VerifyImapCredentialCommand } from "../../application/email/commands/VerifyImapCredentialCommand.js";
import { ReadCredentialsCommand } from "../../application/email/commands/ReadCredentialsCommand.js";
import { AppendCredentialCommand } from "../../application/email/commands/AppendCredentialCommand.js";
import { ImapStartListenCommand } from "../../application/email/commands/ImapStartListenCommand.js";
import { ImapStopListenCommand } from "../../application/email/commands/ImapStopListenCommand.js";
import { StartEmailMonitorCommand } from "../../application/email/commands/StartEmailMonitorCommand.js";
import { StopEmailMonitorCommand } from "../../application/email/commands/StopEmailMonitorCommand.js";
import { ExecuteScrapValidatePipelineCommand } from "../../application/scraping/commands/ExecuteScrapValidatePipelineCommand.js";
import { Result } from "../../shared/Result.js";

export class EmailController implements IEmailController {
  constructor(private readonly _mediator: IMediator) {}

  async startListen(email: string, password: string, onEvent: ImapEventCallback): Promise<Result<void>> {
    return this._mediator.send<void>(new ImapStartListenCommand(email, password, onEvent));
  }

  async stopListen(connectionId: string): Promise<Result<void>> {
    return this._mediator.send<void>(new ImapStopListenCommand(connectionId));
  }

  async startMonitor(email: string, password: string, onEmail?: (email: EmailOutputDTO) => void): Promise<Result<void>> {
    return this._mediator.send<void>(new StartEmailMonitorCommand(email, password, onEmail));
  }

  async stopMonitor(connectionId: string): Promise<Result<EmailOutputDTO[]>> {
    return this._mediator.send<EmailOutputDTO[]>(new StopEmailMonitorCommand(connectionId));
  }

  async sendEmail(
    fromEmail: string, fromPassword: string,
    to: string, subject: string, body: string,
    onStatus?: (msg: string) => void,
  ): Promise<Result<void>> {
    return this._mediator.send<void>(new SendEmailCommand(fromEmail, fromPassword, to, subject, body, onStatus));
  }

  async fetchInbox(email: string, password: string, limit = 15): Promise<Result<FetchedEmailDTO[]>> {
    return this._mediator.send<FetchedEmailDTO[]>(new FetchInboxCommand(email, password, limit));
  }

  async verifyCredential(email: string, password: string): Promise<Result<ValidationResultDTO>> {
    return this._mediator.send<ValidationResultDTO>(new VerifyImapCredentialCommand(email, password));
  }

  async readCredentials(filePath: string): Promise<Result<EmailCredentialDTO[]>> {
    return this._mediator.send<EmailCredentialDTO[]>(new ReadCredentialsCommand(filePath));
  }

  async appendCredential(filePath: string, email: string, password: string): Promise<Result<void>> {
    return this._mediator.send<void>(new AppendCredentialCommand(filePath, email, password));
  }

  async executeScrapValidate(
    keywords: string[], whitelist: string[], blacklist: string[],
    onLog: (msg: string) => void, onProgress?: (remaining: number) => void,
  ): Promise<Result<{ scraped: number; validated: number }>> {
    return this._mediator.send<{ scraped: number; validated: number }>(
      new ExecuteScrapValidatePipelineCommand(keywords, whitelist, blacklist, onLog, onProgress),
    );
  }
}

