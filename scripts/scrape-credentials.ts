#!/usr/bin/env npx tsx
/**
 * scrape-credentials.ts — Usa o GitHubScraper para buscar credenciais
 * de Firebase e Supabase no GitHub.
 */

import { config } from "dotenv";
config();

process.env.EDGE_PATH = process.env.EDGE_PATH
  || `${process.env.HOME}/.cache/puppeteer/chrome/linux-146.0.7680.153/chrome-linux64/chrome`;

import { GitHubScraper } from "../src/infra/adapters/scraping/GitHubScrapper.js";

async function main() {
  const scraper = new GitHubScraper();

  // Primeiro, validar que o cookie funciona
  console.log("\n=== Validando cookie GitHub ===");
  const { GithubConfig } = await import("../src/config/github.config.js");
  const cookie = GithubConfig.getCookie(0);
  const valid = await scraper.validateCookie(cookie);
  console.log(`  Cookie válido: ${valid}\n`);

  if (!valid) {
    console.error("Cookie expirado ou inválido. Atualize COOKIE_GIT0 no .env");
    process.exit(1);
  }

  console.log("=== Scraping Supabase credentials (round 2) ===\n");

  const supabaseResult = await scraper.execute({
    keywords: [
      "NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY .env",
      "VITE_SUPABASE_URL VITE_SUPABASE_ANON_KEY",
      "REACT_APP_SUPABASE_URL REACT_APP_SUPABASE_ANON_KEY",
      "EXPO_PUBLIC_SUPABASE_URL supabase.co",
      "supabaseUrl supabaseAnonKey createClient",
    ],
    tempFile: "scraped_supabase.txt",
    whitelist: [],
    blacklist: ["example", "YOUR_SUPABASE", "your-project", "placeholder"],
    headless: true,
    onLog: (msg) => console.log(`  ${msg}`),
    onProgress: (remaining) => console.log(`  [${remaining} keywords restantes]`),
  });

  console.log(`\n  Supabase: ${supabaseResult.scraped} blocos\n`);

  console.log("=== Scraping Firebase credentials ===\n");

  const firebaseResult = await scraper.execute({
    keywords: [
      "service_account firebaseio.com private_key",
      "FIREBASE_DATABASE_URL firebaseio.com",
      "firebase-adminsdk private_key_id",
    ],
    tempFile: "scraped_firebase.txt",
    whitelist: [],
    blacklist: ["example", "YOUR_", "placeholder", "dummy"],
    headless: true,
    onLog: (msg) => console.log(`  ${msg}`),
    onProgress: (remaining) => console.log(`  [${remaining} keywords restantes]`),
  });

  console.log(`\n  Firebase: ${firebaseResult.scraped} blocos\n`);

  console.log("=== Resultados ===");
  console.log(`  Supabase → scraped_supabase.txt (${supabaseResult.scraped} blocos)`);
  console.log(`  Firebase → scraped_firebase.txt (${firebaseResult.scraped} blocos)`);

  process.exit(0);
}

main().catch((err) => {
  console.error("Erro:", err.message);
  process.exit(1);
});
