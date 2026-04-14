import type { ICommandHandler } from "../../../domain/patterns/ICommandHandler.js";
import type { IEmailMonitorService } from "../../../domain/ports/IEmailMonitorService.js";
import type { StopEmailMonitorCommand } from "../commands/StopEmailMonitorCommand.js";
import type { EmailOutputDTO } from "../dto/EmailOutputDTO.js";
import { EmailMapper } from "../mappers/EmailMapper.js";
import { Result } from "../../../shared/Result.js";

export class StopEmailMonitorHandler implements ICommandHandler<StopEmailMonitorCommand, EmailOutputDTO[]> {
  private _service: IEmailMonitorService | null = null;

  setService(service: IEmailMonitorService | null): void { this._service = service; }

  async execute(_command: StopEmailMonitorCommand): Promise<Result<EmailOutputDTO[]>> {
    if (!this._service) return Result.ok([]);
    const emails = await this._service.stop();
    this._service = null;
    return Result.ok(emails.map(EmailMapper.toDTO));
  }
}

