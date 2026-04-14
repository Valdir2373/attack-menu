export class StartEmailMonitorCommand {
  constructor(
    public readonly email: string,
    public readonly password: string,
    public readonly onEmail?: (email: import("../dto/EmailOutputDTO.js").EmailOutputDTO) => void,
  ) {}
}

