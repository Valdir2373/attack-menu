import { Result } from "../../shared/Result.js";
import { EmailAddress } from "../value-objects/EmailAddress.js";
import { randomUUID } from "crypto";

export class EmailCredential {
  private constructor(
    public readonly id: string,
    public readonly email: EmailAddress,
    public readonly password: string,
    public readonly createdAt: Date,
  ) {}

  static criar(email: string, password: string): Result<EmailCredential> {
    const emailAddr = EmailAddress.criar(email);
    if (emailAddr.isFailure) return Result.fail(emailAddr.error!);
    if (!password || password.length < 1) return Result.fail("Password não pode ser vazio");
    return Result.ok(new EmailCredential(randomUUID(), emailAddr.value!, password, new Date()));
  }
}

