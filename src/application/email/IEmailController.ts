import type { Result } from "../../shared/Result.js";
import type { EmailCredentialDTO } from "./dto/EmailCredentialDTO.js";
import type { FetchedEmailDTO } from "./dto/FetchedEmailDTO.js";
import type { EmailOutputDTO } from "./dto/EmailOutputDTO.js";
import type { ImapEventCallback } from "./dto/ImapEventDTO.js";
import type { ValidationResultDTO } from "../dtos/ValidationResultDTO.js";

export interface IEmailController {
  startListen(email: string, password: string, onEvent: ImapEventCallback): Promise<Result<void>>;
  stopListen(connectionId: string): Promise<Result<void>>;
  startMonitor(email: string, password: string, onEmail?: (email: EmailOutputDTO) => void): Promise<Result<void>>;
  stopMonitor(connectionId: string): Promise<Result<EmailOutputDTO[]>>;
  sendEmail(fromEmail: string, fromPassword: string, to: string, subject: string, body: string, onStatus?: (msg: string) => void): Promise<Result<void>>;
  fetchInbox(email: string, password: string, limit?: number): Promise<Result<FetchedEmailDTO[]>>;
  verifyCredential(email: string, password: string): Promise<Result<ValidationResultDTO>>;
  readCredentials(filePath: string): Promise<Result<EmailCredentialDTO[]>>;
  appendCredential(filePath: string, email: string, password: string): Promise<Result<void>>;
  executeScrapValidate(keywords: string[], whitelist: string[], blacklist: string[], onLog: (msg: string) => void, onProgress?: (remaining: number) => void): Promise<Result<{ scraped: number; validated: number }>>;
}

