import type { ICommandHandler } from "../../../domain/patterns/ICommandHandler.js";
import type { IImapClient, FetchedEmail } from "../../../domain/ports/IImapClient.js";
import type { FetchInboxCommand } from "../commands/FetchInboxCommand.js";
import { Result } from "../../../shared/Result.js";

export class FetchInboxHandler implements ICommandHandler<FetchInboxCommand, FetchedEmail[]> {
  constructor(private readonly _imapClient: IImapClient) {}

  async execute(command: FetchInboxCommand): Promise<Result<FetchedEmail[]>> {
    const emails = await this._imapClient.fetchRecentEmails(command.email, command.password, command.limit);
    return Result.ok(emails);
  }
}

