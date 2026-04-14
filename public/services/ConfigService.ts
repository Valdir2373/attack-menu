import fs from "fs";
import path from "path";

export interface ArtConfig {
  default: string;
  cowsay: {
    figure: string;
    message: string;
    delay: number;
  };
  sexy: {
    delay: number;
  };
}

export interface MenuConfig {
  name: string;
}

export interface AppConfig {
  art: ArtConfig;
  menu: MenuConfig;
}

const CONFIG_PATH = path.resolve(process.cwd(), "config.json");

const DEFAULT_CONFIG: AppConfig = {
  art: {
    default: "sexy",
    cowsay: {
      figure: "tux",
      message: "Ola, Operador!",
      delay: 400,
    },
    sexy: {
      delay: 8000,
    },
  },
  menu: {
    name: "Terminal Attack GM2373_404",
  },
};

export class ConfigService {
  private _config: AppConfig;

  constructor() {
    this._config = this._load();
  }

  get config(): AppConfig {
    return this._config;
  }

  get art(): ArtConfig {
    return this._config.art;
  }

  get menu(): MenuConfig {
    return this._config.menu;
  }

  update(partial: Partial<AppConfig>): void {
    if (partial.art) {
      this._config.art = { ...this._config.art, ...partial.art };
      if (partial.art.cowsay) {
        this._config.art.cowsay = { ...this._config.art.cowsay, ...partial.art.cowsay };
      }
      if (partial.art.sexy) {
        this._config.art.sexy = { ...this._config.art.sexy, ...partial.art.sexy };
      }
    }
    if (partial.menu) {
      this._config.menu = { ...this._config.menu, ...partial.menu };
    }
    this._save();
  }

  updateCowsay(figure?: string, message?: string, delay?: number): void {
    if (figure !== undefined) this._config.art.cowsay.figure = figure;
    if (message !== undefined) this._config.art.cowsay.message = message;
    if (delay !== undefined) this._config.art.cowsay.delay = delay;
    this._save();
  }

  updateDefaultArt(name: string): void {
    this._config.art.default = name;
    this._save();
  }

  updateMenuName(name: string): void {
    this._config.menu.name = name;
    this._save();
  }

  reload(): void {
    this._config = this._load();
  }

  private _load(): AppConfig {
    try {
      if (fs.existsSync(CONFIG_PATH)) {
        const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
        const parsed = JSON.parse(raw);
        return {
          art: {
            default: parsed.art?.default ?? DEFAULT_CONFIG.art.default,
            cowsay: { ...DEFAULT_CONFIG.art.cowsay, ...(parsed.art?.cowsay ?? {}) },
            sexy: { ...DEFAULT_CONFIG.art.sexy, ...(parsed.art?.sexy ?? {}) },
          },
          menu: { ...DEFAULT_CONFIG.menu, ...(parsed.menu ?? {}) },
        };
      }
    } catch {
      // fallback
    }
    return { ...DEFAULT_CONFIG };
  }

  private _save(): void {
    try {
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(this._config, null, 2) + "\n", "utf-8");
    } catch {
      // fallback silencioso
    }
  }
}
