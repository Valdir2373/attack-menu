import { execSync } from "child_process";

export interface ArtFrame {
  content: string;
  delay: number;
}

export interface IArtProvider {
  name: string;
  frames(): ArtFrame[];
}

export class ArtSexy implements IArtProvider {
  name = "sexy";
  private arts: string[];
  private _delay: number;

  constructor(arts: string[], delay = 8000) {
    this.arts = arts;
    this._delay = delay;
  }

  frames(): ArtFrame[] {
    return this.arts.map((art) => ({ content: art, delay: this._delay }));
  }
}

export class ArtCowsay implements IArtProvider {
  name = "cowsay";
  private _figure: string;
  private _message: string;
  private _delay: number;
  private _configReader: (() => { figure: string; message: string; delay: number }) | null = null;

  constructor(figure = "tux", message = "Ola, Operador!", delay = 400) {
    this._figure = figure;
    this._message = message;
    this._delay = delay;
  }

  setConfigReader(reader: () => { figure: string; message: string; delay: number }): void {
    this._configReader = reader;
  }

  frames(): ArtFrame[] {
    if (this._configReader) {
      const cfg = this._configReader();
      this._figure = cfg.figure;
      this._message = cfg.message;
      this._delay = cfg.delay;
    }

    const result: ArtFrame[] = [];
    for (let i = 1; i <= this._message.length; i++) {
      const partial = this._message.slice(0, i);
      result.push({
        content: this._generateCowsay(partial),
        delay: this._delay,
      });
    }
    result.push({
      content: this._generateCowsay(this._message),
      delay: 3000,
    });
    return result;
  }

  private _generateCowsay(text: string): string {
    try {
      return execSync(`cowsay -f ${this._figure} "${text}"`, {
        encoding: "utf-8",
        timeout: 2000,
      }).trim();
    } catch {
      return this._fallbackTux(text);
    }
  }

  private _fallbackTux(text: string): string {
    const border = "_".repeat(text.length + 2);
    return [
      ` ${border}`,
      `< ${text} >`,
      ` ${"-".repeat(text.length + 2)}`,
      `   \\`,
      `    \\`,
      `        .--.`,
      `       |o_o |`,
      `       |:_/ |`,
      `      //   \\ \\`,
      `     (|     | )`,
      `    /'\\_   _/'\`\\`,
      `    \\___)=(___/`,
    ].join("\n");
  }

  get figure(): string { return this._figure; }
  set figure(f: string) { this._figure = f; }

  get message(): string { return this._message; }
  set message(m: string) { this._message = m; }

  get delay(): number { return this._delay; }
  set delay(d: number) { this._delay = d; }
}

export class ArtTerminal {
  private _providers: IArtProvider[] = [];
  private _activeIndex = 0;
  private _frameIndex = 0;
  private _frames: ArtFrame[] = [];

  register(provider: IArtProvider): this {
    this._providers.push(provider);
    if (this._providers.length === 1) this._loadFrames();
    return this;
  }

  switchTo(name: string): boolean {
    const idx = this._providers.findIndex((p) => p.name === name);
    if (idx < 0) return false;
    this._activeIndex = idx;
    this._frameIndex = 0;
    this._loadFrames();
    return true;
  }

  next(): ArtFrame {
    if (this._frames.length === 0) return { content: "", delay: 1000 };
    this._frameIndex++;
    if (this._frameIndex >= this._frames.length) {
      this._frameIndex = 0;
      this._loadFrames();
    }
    return this._frames[this._frameIndex];
  }

  current(): ArtFrame {
    if (this._frames.length === 0) return { content: "", delay: 1000 };
    return this._frames[this._frameIndex % this._frames.length];
  }

  get activeProvider(): IArtProvider | null {
    return this._providers[this._activeIndex] ?? null;
  }

  get providerNames(): string[] {
    return this._providers.map((p) => p.name);
  }

  private _loadFrames(): void {
    const provider = this._providers[this._activeIndex];
    this._frames = provider ? provider.frames() : [];
    this._frameIndex = 0;
  }
}
