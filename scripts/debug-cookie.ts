import { config } from "dotenv";
config();

process.env.EDGE_PATH = process.env.EDGE_PATH
  || `${process.env.HOME}/.cache/puppeteer/chrome/linux-146.0.7680.153/chrome-linux64/chrome`;

import pupp from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { GithubConfig } from "../src/config/github.config.js";
import { BrowserConfig } from "../src/config/browser.config.js";

const puppeteer: any = pupp;
puppeteer.use(StealthPlugin());

async function main() {
  const cookie = GithubConfig.getCookie(0);
  console.log(`Cookie length: ${cookie.length}`);
  console.log(`Edge path: ${BrowserConfig.getEdgePath()}`);
  console.log(`Has logged_in=yes: ${cookie.includes("logged_in=yes")}`);

  // Parse cookie pairs
  const cleaned = cookie.replace(/^Cookie:\s*/i, "");
  const pairs = cleaned.split(";").map(p => p.trim()).filter(Boolean);
  console.log(`Cookie pairs: ${pairs.length}`);

  const cookieNames = pairs.map(p => p.split("=")[0]);
  console.log(`Keys: ${cookieNames.join(", ")}`);

  // Launch browser
  console.log("\nLaunching browser...");
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: BrowserConfig.getEdgePath(),
    args: [
      "--disable-blink-features=AutomationControlled",
      "--no-sandbox",
      "--disable-setuid-sandbox",
    ],
  });

  const page = await browser.newPage();

  // Inject cookies one by one to find which fails
  for (const pair of pairs) {
    const eqIdx = pair.indexOf("=");
    if (eqIdx < 0) continue;
    const name = pair.substring(0, eqIdx).trim();
    const value = pair.substring(eqIdx + 1).trim();
    if (!name) continue;
    try {
      await page.setCookie({
        name, value,
        domain: ".github.com",
        path: "/",
        secure: true,
        sameSite: "Lax" as any,
      });
    } catch (e: any) {
      console.log(`  ✗ Cookie "${name}" failed: ${e.message?.substring(0, 60)}`);
    }
  }

  console.log("Navigating to GitHub search...");
  const resp = await page.goto("https://github.com/search?q=test&type=code&p=1", {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });

  console.log(`Status: ${resp?.status()}`);
  console.log(`URL: ${page.url()}`);

  // Check for auth wall
  const html = await page.content();
  const hasSignIn = html.includes("Sign in") && html.includes("sign_in");
  const hasResults = html.includes("results-list") || html.includes("search-title");
  const has429 = resp?.status() === 429;

  console.log(`Has sign-in wall: ${hasSignIn}`);
  console.log(`Has search results: ${hasResults}`);
  console.log(`Is rate limited (429): ${has429}`);

  // Take screenshot for debug
  await page.screenshot({ path: "/tmp/github-debug.png", fullPage: false });
  console.log("Screenshot: /tmp/github-debug.png");

  // Check page title
  const title = await page.title();
  console.log(`Page title: ${title}`);

  await browser.close();

  if (!hasSignIn && !has429) {
    console.log("\n✓ Cookie FUNCIONA — podemos scrapear");
  } else {
    console.log("\n✗ Cookie não funciona");
  }
}

main().catch(e => { console.error(e); process.exit(1); });
