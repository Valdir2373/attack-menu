export interface ISupabaseValidator {
  validateCredentials(url: string, key: string): Promise<boolean>;
}

