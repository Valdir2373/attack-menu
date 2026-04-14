import { Result } from "../../shared/Result.js";
import { randomUUID } from "crypto";

export class Email {
  private constructor(
    public readonly id: string,
    public readonly about: string,
    public readonly from: string,
    public readonly content: string,
    public readonly timestamp: Date,
  ) {}

  static criar(about: string, from: string, content: string): Result<Email> {
    if (!about) return Result.fail("Assunto não pode ser vazio");
    if (!from) return Result.fail("Remetente não pode ser vazio");
    return Result.ok(new Email(randomUUID(), about, from, content, new Date()));
  }
}

