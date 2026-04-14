import { Result } from "../../shared/Result.js";
import { MongoUri } from "../value-objects/MongoUri.js";
import { randomUUID } from "crypto";

export class MongoCredential {
  private constructor(
    public readonly id: string,
    public readonly uri: MongoUri,
    public readonly createdAt: Date,
  ) {}

  static criar(uri: string): Result<MongoCredential> {
    const mongoUri = MongoUri.criar(uri);
    if (mongoUri.isFailure) return Result.fail(mongoUri.error!);
    return Result.ok(new MongoCredential(randomUUID(), mongoUri.value!, new Date()));
  }
}

