import { ConfigError } from '../errors/index.js';

export class AppConfig {
  static getDatabaseUrl(): string {
    const url = process.env.DATABASE_URL;
    if (!url) throw new ConfigError('DATABASE_URL não configurada no .env');
    return url;
  }

  static isDebug(): boolean {
    return !!process.env["DEBUG"];
  }
}

