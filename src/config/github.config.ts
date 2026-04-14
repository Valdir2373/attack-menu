import { ConfigError } from '../errors/index.js';

export class GithubConfig {
  static getAvailableBots(): number[] {
    const bots: number[] = [];
    for (let i = 0; process.env[`COOKIE_GIT${i}`]; i++) bots.push(i);
    if (bots.length === 0) throw new ConfigError('Nenhum COOKIE_GIT* configurado no .env');
    return bots;
  }

  static getCookie(botIndex: number): string {
    const cookie = process.env[`COOKIE_GIT${botIndex}`];
    if (!cookie) throw new ConfigError(`COOKIE_GIT${botIndex} não configurado no .env`);
    return cookie;
  }
}

