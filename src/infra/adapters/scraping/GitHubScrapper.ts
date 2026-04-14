import pupp from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import fs from "fs";
import {
  IGitHubScraper,
  IGitHubScraperOptions,
} from "../../../domain/ports/IGitHubScraper.js";
import chalk from "chalk";
import { spinner } from "../../utils/spinner";
import { GithubConfig } from "../../../config/github.config.js";
import { BrowserConfig } from "../../../config/browser.config.js";

const puppeteer: any = pupp;
puppeteer.use(StealthPlugin());


type ScrapeItem = { link: string; code: string };
type PageResult = { count: number; stop: boolean };
type TryPageResult = PageResult & { error: boolean };
type FirstPageResult = { found: number; total: number; stop: boolean };
type PageTask = { keyword: string; pageNum: number };


const EDGE_PATH = BrowserConfig.getEdgePath();

const BROWSER_ARGS = [
  "--disable-blink-features=AutomationControlled",
  "--start-maximized",
  "--disable-images",
  "--disable-extensions",
  "--no-sandbox",
];

const BLOCKED_RESOURCE_TYPES = ["image", "stylesheet", "font", "media"];

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const GITHUB_SEARCH_BASE = "https://github.com/search";
const GITHUB_AUTH_CHECK_URL = `${GITHUB_SEARCH_BASE}?q=test&type=code&p=1`;
const RESULT_SEPARATOR = "-".repeat(60);

const BATCH_SIZE = 5;
const PAUSE_EVERY_N_BATCHES = 3;
const PAUSE_SECONDS = 15;
const MAX_RESULT_PAGES = 5;
const MAX_CONSECUTIVE_ERRORS = 2;
const TURBO_THRESHOLD = 4;
const MAX_TURBO_BOTS = 5;
const TURBO_WAIT_SECS = 15;


export class GitHubScraper implements IGitHubScraper {
  private browsers: Map<number, any> = new Map();
  private keywordQueue: string[] = [];
  private overflowTasks: PageTask[] = [];


  async execute(options: IGitHubScraperOptions): Promise<{ scraped: number }> {
    const bots = this.getAvailableBots();
    if (bots.length === 0) return { scraped: 0 };
    const turbo = bots.length > 1 && options.keywords.length > TURBO_THRESHOLD;
    turbo
      ? await this.runTurbo(bots.slice(0, MAX_TURBO_BOTS), options)
      : await this.runSingle(bots[0], options);
    return { scraped: this.countResultsInFile(options.tempFile) };
  }

  async validateCookie(cookie: string): Promise<boolean> {
    let browser: any = null;
    try {
      browser = await this.launchBrowser(true);
      return await this.checkCookieValidity(
        browser,
        this.normalizeCookie(cookie),
      );
    } catch {
      return false;
    } finally {
      if (browser) await browser.close();
    }
  }


  private getAvailableBots(): number[] {
    return GithubConfig.getAvailableBots();
  }

  private getBotCookieNorm(botIndex: number): string {
    return this.normalizeCookie(GithubConfig.getCookie(botIndex));
  }


  private async launchBrowser(headless: boolean): Promise<any> {
    return puppeteer.launch({
      headless,
      executablePath: EDGE_PATH,
      args: BROWSER_ARGS,
    });
  }

  private async openBrowserForBot(
    botIndex: number,
    headless: boolean,
  ): Promise<void> {
    this.browsers.set(botIndex, await this.launchBrowser(headless));
  }

  private async closeBrowserForBot(botIndex: number): Promise<void> {
    const b = this.browsers.get(botIndex);
    if (b) {
      await b.close();
      this.browsers.delete(botIndex);
    }
  }

  private async openAllBrowsers(
    bots: number[],
    headless: boolean,
  ): Promise<void> {
    await Promise.all(bots.map((b) => this.openBrowserForBot(b, headless)));
  }

  private async closeAllBrowsers(): Promise<void> {
    await Promise.all(
      [...this.browsers.keys()].map((b) => this.closeBrowserForBot(b)),
    );
  }

  private browserFor(botIndex: number): any {
    return this.browsers.get(botIndex);
  }

  private async newConfiguredPage(browser: any, cookie: string): Promise<any> {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await this.blockResources(page);
    await this.injectCookies(page, cookie);
    return page;
  }

  private async newConfiguredPageForBot(botIndex: number): Promise<any> {
    return this.newConfiguredPage(
      this.browserFor(botIndex),
      this.getBotCookieNorm(botIndex),
    );
  }

  private async blockResources(page: any): Promise<void> {
    await page.setRequestInterception(true);
    page.on("request", (req: any) =>
      BLOCKED_RESOURCE_TYPES.includes(req.resourceType())
        ? req.abort()
        : req.continue(),
    );
  }


  private countResultsInFile(filename: string): number {
    if (!fs.existsSync(filename)) return 0;
    return fs.readFileSync(filename, "utf-8").split("KEYWORD:").length - 1;
  }


  private normalizeCookie(raw: string): string {
    return raw.replace(/^Cookie:\s*/i, "");
  }

  private parseCookiePairs(
    raw: string,
  ): Array<{ name: string; value: string }> {
    return raw
      .split(";")
      .map((c) => c.trim())
      .filter((c) => c.includes("="))
      .map((c) => {
        const [name, ...rest] = c.split("=");
        return { name: name.trim(), value: rest.join("=").trim() };
      });
  }

  private async injectCookies(page: any, cookie: string): Promise<void> {
    for (const { name, value } of this.parseCookiePairs(cookie)) {
      try {
        await page.setCookie({
          name,
          value,
          domain: name.startsWith("__Host-") ? undefined : ".github.com",
          path: "/",
          secure: true,
          sameSite: "Lax",
        });
      } catch {

      }
    }
  }


  private buildSearchUrl(keyword: string, pageNum: number): string {
    return `${GITHUB_SEARCH_BASE}?q=${encodeURIComponent(keyword)}&type=code&p=${pageNum}`;
  }

  private async navigateTo(
    page: any,
    url: string,
    timeout = 15000,
  ): Promise<any> {
    await page.setUserAgent(USER_AGENT);
    try {
      return await page.goto(url, { waitUntil: "networkidle0", timeout });
    } catch (err: any) {
      if (err.name === "TimeoutError" || err.message?.includes("timeout")) {
        return null;
      }
      throw err;
    }
  }


  private async extractPageResults(page: any): Promise<ScrapeItem[]> {
    try {
      return await page.evaluate(() => {
        const items = document.querySelectorAll(
          'div[data-testid="results-list"] > div',
        );
        const data: any[] = [];
        items.forEach((item) => {
          const linkEl = item.querySelector('a[href*="/blob/"]');
          const codeEl = item.querySelector(
            'table, div[class*="Box"] pre, .search-match',
          );
          if (linkEl)
            data.push({
              link: "https://github.com" + linkEl.getAttribute("href"),
              code: codeEl ? (codeEl as HTMLElement).innerText.trim() : "",
            });
        });
        return data;
      });
    } catch {
      return [];
    }
  }

  private async detectMaxPages(page: any): Promise<number> {
    return page.evaluate((limit: number) => {
      const elems = document.querySelectorAll(".prc-Pagination-Page-Etgqf");
      const nums = Array.from(elems)
        .map((el: any) => parseInt(el.textContent?.trim() || ""))
        .filter((n: any) => !isNaN(n));
      return Math.min(nums.length > 0 ? Math.max(...nums) : 1, limit);
    }, MAX_RESULT_PAGES);
  }


  private matchesWhitelist(item: ScrapeItem, whitelist: string[]): boolean {
    return (
      whitelist.length === 0 ||
      whitelist.some((w) => item.link.toLowerCase().includes(w.toLowerCase()))
    );
  }

  private matchesBlacklist(item: ScrapeItem, blacklist: string[]): boolean {
    return blacklist.some((b) =>
      item.code.toLowerCase().includes(b.toLowerCase()),
    );
  }

  private applyFilters(
    items: ScrapeItem[],
    whitelist: string[],
    blacklist: string[],
  ): ScrapeItem[] {
    return items.filter(
      (item) =>
        this.matchesWhitelist(item, whitelist) &&
        !this.matchesBlacklist(item, blacklist),
    );
  }

  private formatResultBlock(keyword: string, item: ScrapeItem): string {
    return `KEYWORD: ${keyword}\nLINK: ${item.link}\nCODE:\n${item.code}\n${RESULT_SEPARATOR}\n`;
  }

  private appendToFile(
    keyword: string,
    items: ScrapeItem[],
    filename: string,
  ): void {
    fs.appendFileSync(
      filename,
      items.map((r) => this.formatResultBlock(keyword, r)).join("\n"),
    );
  }


  private async scrapeSinglePage(
    keyword: string,
    page: any,
    pageNum: number,
    filename: string,
    wl: string[],
    bl: string[],
  ): Promise<PageResult> {
    const response = await this.navigateTo(
      page,
      this.buildSearchUrl(keyword, pageNum),
    );
    if (response?.status() === 429) return { count: 0, stop: true };
    const filtered = this.applyFilters(
      await this.extractPageResults(page),
      wl,
      bl,
    );
    if (filtered.length > 0) this.appendToFile(keyword, filtered, filename);
    return { count: filtered.length, stop: false };
  }

  private async tryScrapePage(
    keyword: string,
    page: any,
    pageNum: number,
    filename: string,
    wl: string[],
    bl: string[],
  ): Promise<TryPageResult> {
    try {
      const { count, stop } = await this.scrapeSinglePage(
        keyword,
        page,
        pageNum,
        filename,
        wl,
        bl,
      );
      return { count, stop, error: false };
    } catch {
      return { count: 0, stop: false, error: true };
    }
  }

  private async scrapeFirstPage(
    keyword: string,
    page: any,
    filename: string,
    wl: string[],
    bl: string[],
  ): Promise<FirstPageResult> {
    const { count, stop } = await this.scrapeSinglePage(
      keyword,
      page,
      1,
      filename,
      wl,
      bl,
    );
    if (stop) return { found: 0, total: 0, stop: true };
    return {
      found: count,
      total: await this.detectMaxPages(page),
      stop: false,
    };
  }

  private async scrapeRemainingPages(
    keyword: string,
    page: any,
    filename: string,
    wl: string[],
    bl: string[],
    total: number,
    found: number,
  ): Promise<number> {
    let result = found,
      errors = 0;
    for (let p = 2; p <= total && errors < MAX_CONSECUTIVE_ERRORS; p++) {
      const res = await this.tryScrapePage(keyword, page, p, filename, wl, bl);
      if (res.stop) break;
      errors = res.error ? errors + 1 : 0;
      result += res.count;
    }
    return result;
  }

  private async scrapeKeywordPages(
    keyword: string,
    page: any,
    filename: string,
    wl: string[],
    bl: string[],
  ): Promise<number> {
    const first = await this.scrapeFirstPage(keyword, page, filename, wl, bl);
    if (first.stop || first.total <= 1) return first.found;
    return this.scrapeRemainingPages(
      keyword,
      page,
      filename,
      wl,
      bl,
      first.total,
      first.found,
    );
  }


  private reportKeywordResult(spin: any, keyword: string, found: number): void {
    found > 0
      ? spin.succeed(chalk.green(`✅ ${keyword} - ${found} encontrados`))
      : spin.fail(chalk.red(`❌ ${keyword} - sem resultados`));
  }

  private async processKeyword(
    keyword: string,
    page: any,
    filename: string,
    wl: string[],
    bl: string[],
    onLog?: (msg: string) => void,
  ): Promise<void> {
    onLog?.(`[◆] ${keyword}`);
    const spin = onLog ? null : spinner(`🔍 ${keyword}`);
    try {
      const found = await this.scrapeKeywordPages(
        keyword,
        page,
        filename,
        wl,
        bl,
      );
      onLog
        ? onLog(
            found > 0
              ? `[OK] ${keyword} — ${found} resultado(s)`
              : `[x] ${keyword} — sem resultados`,
          )
        : this.reportKeywordResult(spin!, keyword, found);
    } catch (err: any) {
      onLog?.(`[ERROR] ${keyword}: ${err.message}`);
      if (!onLog) spin!.fail(chalk.red(`❌ ${keyword} - erro: ${err.message}`));
    }
  }

  private async processBatch(
    botIndex: number,
    batch: string[],
    filename: string,
    wl: string[],
    bl: string[],
    onLog?: (msg: string) => void,
  ): Promise<void> {
    const pages = await Promise.all(
      batch.map(() => this.newConfiguredPageForBot(botIndex)),
    );
    await Promise.all(
      batch.map((kw, i) =>
        this.processKeyword(kw, pages[i], filename, wl, bl, onLog),
      ),
    );
    for (const page of pages) await page.close();
  }

  private async countdownWait(
    secs: number,
    onLog?: (msg: string) => void,
  ): Promise<void> {
    for (let s = secs; s > 0; s--) {
      onLog?.(`[>] Aguardando ${s}s...`);
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  private async pauseBetweenBatches(
    onLog?: (msg: string) => void,
  ): Promise<void> {
    onLog?.(`⏳ Aguardando ${PAUSE_SECONDS}s entre lotes...`);
    await this.countdownWait(PAUSE_SECONDS, onLog);
  }

  private async runBatchAt(
    botIndex: number,
    batchIndex: number,
    options: IGitHubScraperOptions,
  ): Promise<void> {
    const batchNum = Math.floor(batchIndex / BATCH_SIZE) + 1;
    const batch = options.keywords.slice(batchIndex, batchIndex + BATCH_SIZE);
    options.onLog?.(`[>] Lote ${batchNum} — ${batch.length} keyword(s)`);
    await this.processBatch(
      botIndex,
      batch,
      options.tempFile,
      options.whitelist ?? [],
      options.blacklist ?? [],
      options.onLog,
    );
    const remaining = Math.max(
      0,
      options.keywords.length - batchIndex - batch.length,
    );
    options.onProgress?.(remaining);
    if (batchNum % PAUSE_EVERY_N_BATCHES === 0)
      await this.pauseBetweenBatches(options.onLog);
  }

  private async runAllBatches(
    botIndex: number,
    options: IGitHubScraperOptions,
  ): Promise<void> {
    options.onLog?.(`[>] Iniciando scraper (bot ${botIndex})`);
    for (let i = 0; i < options.keywords.length; i += BATCH_SIZE)
      await this.runBatchAt(botIndex, i, options);
    options.onLog?.(`[+] Scraper finalizado`);
  }

  private async runSingle(
    botIndex: number,
    options: IGitHubScraperOptions,
  ): Promise<void> {
    await this.openBrowserForBot(botIndex, options.headless ?? true);
    await this.runAllBatches(botIndex, options);
    await this.closeBrowserForBot(botIndex);
  }


  private async runTurbo(
    bots: number[],
    options: IGitHubScraperOptions,
  ): Promise<void> {
    options.onLog?.(
      `[>] TURBO — ${bots.length} bot(s) · ${options.keywords.length} keyword(s)`,
    );
    this.keywordQueue = [...options.keywords];
    this.overflowTasks = [];
    await this.openAllBrowsers(bots, options.headless ?? true);
    await Promise.all(bots.map((b) => this.fillBotBudget(b, options)));
    while (this.overflowTasks.length > 0 || this.keywordQueue.length > 0)
      await this.processNextRound(bots, options);
    await this.closeAllBrowsers();
    options.onLog?.(`[+] TURBO finalizado`);
  }

  private async fillBotBudget(
    botIndex: number,
    options: IGitHubScraperOptions,
  ): Promise<void> {
    let budget = 0;
    while (budget < MAX_RESULT_PAGES && this.keywordQueue.length > 0) {
      const kw = this.keywordQueue.shift()!;
      options.onProgress?.(this.keywordQueue.length);
      budget += await this.processKeywordInBudget(
        botIndex,
        kw,
        budget,
        options,
      );
    }
  }

  private async processKeywordInBudget(
    botIndex: number,
    keyword: string,
    usedBudget: number,
    options: IGitHubScraperOptions,
  ): Promise<number> {
    const remaining = MAX_RESULT_PAGES - usedBudget;
    options.onLog?.(`[◆] [bot${botIndex}] ${keyword}`);
    const page = await this.newConfiguredPageForBot(botIndex);
    const first = await this.scrapeFirstPage(
      keyword,
      page,
      options.tempFile,
      options.whitelist ?? [],
      options.blacklist ?? [],
    );
    await page.close();
    if (first.stop) {
      options.onLog?.(`[x] ${keyword} — rate-limit`);
      return 0;
    }
    const consume = Math.min(first.total, remaining);
    if (first.total > remaining)
      options.onLog?.(
        `[>] ${keyword} — overflow: ${first.total - remaining} página(s) → próximo round`,
      );
    for (let p = remaining + 1; p <= first.total; p++)
      this.overflowTasks.push({ keyword, pageNum: p });
    options.onLog?.(
      `[OK] ${keyword} — ${first.found} resultado(s) · ${consume} pág(s)`,
    );
    if (consume > 1)
      await this.scrapePageRangeParallel(
        botIndex,
        keyword,
        2,
        consume,
        options,
      );
    return consume;
  }

  private async scrapePageRangeParallel(
    botIndex: number,
    keyword: string,
    from: number,
    to: number,
    options: IGitHubScraperOptions,
  ): Promise<void> {
    const nums = Array.from({ length: to - from + 1 }, (_, i) => from + i);
    const pages = await Promise.all(
      nums.map(() => this.newConfiguredPageForBot(botIndex)),
    );
    await Promise.all(
      nums.map((p, i) =>
        this.scrapeSinglePage(
          keyword,
          pages[i],
          p,
          options.tempFile,
          options.whitelist ?? [],
          options.blacklist ?? [],
        ),
      ),
    );
    await Promise.all(pages.map((p) => p.close()));
  }

  private async processNextRound(
    bots: number[],
    options: IGitHubScraperOptions,
  ): Promise<void> {
    const total = this.overflowTasks.length + this.keywordQueue.length;
    options.onLog?.(`[>] Rate-limit — ${total} tarefas restantes`);
    await this.countdownWait(TURBO_WAIT_SECS, options.onLog);
    await this.executeOverflowTasks(bots, options);
    await this.executeRemainingKeywords(bots, options);
  }

  private async executeOverflowTasks(
    bots: number[],
    options: IGitHubScraperOptions,
  ): Promise<void> {
    if (this.overflowTasks.length === 0) return;
    const tasks = this.overflowTasks.splice(0, bots.length * MAX_RESULT_PAGES);
    const chunks = this.chunkBy(tasks, MAX_RESULT_PAGES);
    await Promise.all(
      chunks.map((chunk, i) =>
        this.executeBotPageTasks(bots[i], chunk, options),
      ),
    );
  }

  private async executeRemainingKeywords(
    bots: number[],
    options: IGitHubScraperOptions,
  ): Promise<void> {
    if (this.keywordQueue.length === 0) return;
    options.onLog?.(
      `[>] Retomando ${this.keywordQueue.length} keyword(s) restante(s)`,
    );
    await Promise.all(bots.map((b) => this.fillBotBudget(b, options)));
  }

  private async executeBotPageTasks(
    botIndex: number,
    tasks: PageTask[],
    options: IGitHubScraperOptions,
  ): Promise<void> {
    const pages = await Promise.all(
      tasks.map(() => this.newConfiguredPageForBot(botIndex)),
    );
    await Promise.all(
      tasks.map((t, i) =>
        this.scrapeSinglePage(
          t.keyword,
          pages[i],
          t.pageNum,
          options.tempFile,
          options.whitelist ?? [],
          options.blacklist ?? [],
        ),
      ),
    );
    await Promise.all(pages.map((p) => p.close()));
  }

  private chunkBy<T>(arr: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < arr.length; i += size)
      chunks.push(arr.slice(i, i + size));
    return chunks;
  }


  private async isAuthWallVisible(page: any): Promise<boolean> {
    return page.evaluate(() => {
      const heading = document.querySelector(
        "h1.SessionsAuthHeader-module__authFormHeaderTitle__rVSNG",
      );
      const signInBtn = document.querySelector(
        "a.HeaderMenu-link.HeaderMenu-link--sign-in",
      );
      return !!(
        heading?.textContent?.includes("Sign in") ||
        document.title.includes("Sign in") ||
        signInBtn
      );
    });
  }

  private async checkCookieValidity(
    browser: any,
    cookie: string,
  ): Promise<boolean> {
    const page = await this.newConfiguredPage(browser, cookie);
    const response = await this.navigateTo(page, GITHUB_AUTH_CHECK_URL, 10000);
    if (response?.status() === 429) return false;
    return !(await this.isAuthWallVisible(page));
  }
}

