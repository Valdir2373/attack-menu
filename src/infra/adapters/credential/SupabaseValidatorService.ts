import { ISupabaseValidator } from "../../../domain/ports/ISupabaseValidator";

export class SupabaseValidatorService implements ISupabaseValidator {
  async validateCredentials(url: string, key: string): Promise<boolean> {
    if (!this._isValidJwt(key)) return false;

    const base = url.replace(/\/$/, "");
    try {
      const res = await fetch(`${base}/rest/v1/`, {
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
        },
        signal: AbortSignal.timeout(8000),
      });
      return res.status !== 401 && res.status !== 403 && res.status < 500;
    } catch {
      return false;
    }
  }

  private _isValidJwt(key: string): boolean {
    const parts = key.split(".");
    return parts.length === 3 && parts.every((p) => p.length > 0);
  }
}

