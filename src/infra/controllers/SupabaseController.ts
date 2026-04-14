import type { IMediator } from "../../domain/patterns/IMediator.js";
import type { ISupabaseController } from "../../application/supabase/ISupabaseController.js";
import { ExecuteSupabaseValidationCommand } from "../../application/supabase/commands/ExecuteSupabaseValidationCommand.js";
import { ExecuteSupabaseMassiveCommand } from "../../application/supabase/commands/ExecuteSupabaseMassiveCommand.js";
import { Result } from "../../shared/Result.js";

export class SupabaseController implements ISupabaseController {
  constructor(private readonly _mediator: IMediator) {}

  async executeValidation(
    inputFile: string, credentialsFile: string,
    onLog: (msg: string) => void,
  ): Promise<Result<{ tested: number; validated: number }>> {
    return this._mediator.send<{ tested: number; validated: number }>(
      new ExecuteSupabaseValidationCommand(inputFile, credentialsFile, onLog),
    );
  }

  async executeMassive(
    keywords: string[], credentialsFile: string,
    onLog: (msg: string) => void,
    whitelist?: string[], blacklist?: string[],
    onProgress?: (remaining: number) => void,
  ): Promise<Result<{ scraped: number; validated: number }>> {
    return this._mediator.send<{ scraped: number; validated: number }>(
      new ExecuteSupabaseMassiveCommand(keywords, credentialsFile, whitelist, blacklist, onLog, onProgress),
    );
  }
}

