import { Result } from "../../shared/Result.js";

export class EmailAddress {
  private constructor(public readonly value: string) {}

  static criar(email: string): Result<EmailAddress> {
    if (!email || !email.includes("@")) return Result.fail("Email inválido");
    return Result.ok(new EmailAddress(email));
  }

  equals(other: EmailAddress): boolean {
    return this.value === other.value;
  }
}

