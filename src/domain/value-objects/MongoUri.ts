import { Result } from "../../shared/Result.js";

export class MongoUri {
  private constructor(public readonly value: string) {}

  static criar(uri: string): Result<MongoUri> {
    if (!uri || !uri.startsWith("mongodb")) return Result.fail("URI MongoDB inválida");
    return Result.ok(new MongoUri(uri));
  }

  equals(other: MongoUri): boolean {
    return this.value === other.value;
  }
}

