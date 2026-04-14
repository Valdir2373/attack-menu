export interface IEmailValidator {
  validateCredentials(email: string, password: string): Promise<boolean>;
}

