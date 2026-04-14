import type { ICommandHandler } from "../../../domain/patterns/ICommandHandler.js";
import type { IEmailMonitorService } from "../../../domain/ports/IEmailMonitorService.js";
import type { StartEmailMonitorCommand } from "../commands/StartEmailMonitorCommand.js";
import { EmailMapper } from "../mappers/EmailMapper.js";
import { Result } from "../../../shared/Result.js";

export class StartEmailMonitorHandler implements ICommandHandler<StartEmailMonitorCommand, void> {
  constructor(private readonly _serviceFactory: () => IEmailMonitorService) {}

  private _service: IEmailMonitorService | null = null;

  get service(): IEmailMonitorService | null { return this._service; }

  async execute(command: StartEmailMonitorCommand): Promise<Result<void>> {
    this._service = this._serviceFactory();
    await this._service.start(
      command.email,
      command.password,
      command.onEmail ? (e) => command.onEmail!(EmailMapper.toDTO(e)) : undefined,
    );
    return Result.ok(undefined);
  }
}

