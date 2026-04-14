import { config } from "dotenv";
config();

process.env.EDGE_PATH = process.env.EDGE_PATH
  || `${process.env.HOME}/.cache/puppeteer/chrome/linux-146.0.7680.153/chrome-linux64/chrome`;

import { GitHubScraper } from "../src/infra/adapters/scraping/GitHubScrapper.js";
import { GithubConfig } from "../src/config/github.config.js";

async function main() {
  const scraper = new GitHubScraper();
  const bots = GithubConfig.getAvailableBots();

  console.log(`\n=== Validando ${bots.length} cookies ===\n`);

  for (const i of bots) {
    const cookie = GithubConfig.getCookie(i);
    const preview = cookie.substring(0, 40) + "...";
    process.stdout.write(`  COOKIE_GIT${i}: `);
    try {
      const valid = await scraper.validateCookie(cookie);
      console.log(valid ? "✓ VÁLIDO" : "✗ expirado/inválido");
    } catch (e: any) {
      console.log(`✗ erro: ${e.message?.substring(0, 50)}`);
    }
  }

  console.log("");
  process.exit(0);
}

main().catch(e => { console.error(e.message); process.exit(1); });
