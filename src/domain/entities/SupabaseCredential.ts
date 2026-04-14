import { Result } from "../../shared/Result.js";
import { SupabaseUrl } from "../value-objects/SupabaseUrl.js";
import { SupabaseKey } from "../value-objects/SupabaseKey.js";
import { randomUUID } from "crypto";

export class SupabaseCredential {
  private constructor(
    public readonly id: string,
    public readonly url: SupabaseUrl,
    public readonly key: SupabaseKey,
    public readonly createdAt: Date,
  ) {}

  static criar(url: string, key: string): Result<SupabaseCredential> {
    const supabaseUrl = SupabaseUrl.criar(url);
    if (supabaseUrl.isFailure) return Result.fail(supabaseUrl.error!);
    const supabaseKey = SupabaseKey.criar(key);
    if (supabaseKey.isFailure) return Result.fail(supabaseKey.error!);
    return Result.ok(new SupabaseCredential(randomUUID(), supabaseUrl.value!, supabaseKey.value!, new Date()));
  }
}

