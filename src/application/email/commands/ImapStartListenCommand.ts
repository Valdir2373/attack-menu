import type { ImapEventCallback } from "../../../domain/ports/IImapListener.js";

export class ImapStartListenCommand {
  constructor(
    public readonly email: string,
    public readonly password: string,
    public readonly onEvent: ImapEventCallback,
  ) {}
}

