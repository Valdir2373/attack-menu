export interface IMongoValidator {
  validateCredentials(uri: string): Promise<boolean>;
}

