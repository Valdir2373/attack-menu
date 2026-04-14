import { Result } from "../../shared/Result.js";

export class SupabaseKey {
  private constructor(public readonly value: string) {}

  static criar(key: string): Result<SupabaseKey> {
    if (!key || key.length < 10) return Result.fail("Key Supabase inválida");
    return Result.ok(new SupabaseKey(key));
  }

  equals(other: SupabaseKey): boolean {
    return this.value === other.value;
  }
}

