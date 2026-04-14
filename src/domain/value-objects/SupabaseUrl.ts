import { Result } from "../../shared/Result.js";

export class SupabaseUrl {
  private constructor(public readonly value: string) {}

  static criar(url: string): Result<SupabaseUrl> {
    if (!url || !url.includes("supabase")) return Result.fail("URL Supabase inválida");
    return Result.ok(new SupabaseUrl(url));
  }

  equals(other: SupabaseUrl): boolean {
    return this.value === other.value;
  }
}

