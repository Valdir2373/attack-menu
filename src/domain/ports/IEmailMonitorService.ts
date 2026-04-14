import { Email } from "../entities/Email";

export interface IEmailMonitorService {
  start(email: string, password: string, onEmail?: (email: Email) => void): Promise<void>;
  stop(): Promise<Email[]>;
  readonly isRunning: boolean;
}

