import fs from "fs";
import { IRulesRepository } from "../../../../domain/proxy/reverse/IRulesRepository.js";
import { ProxyRules, MergedRules } from "../../../../domain/proxy/reverse/ProxyRules.js";

export class RulesJsonRepository implements IRulesRepository {
  constructor(private readonly filePath: string = "./rules.json") {}

  getMerged(host: string): MergedRules {
    const rules = this.load();
    const g = rules.global ?? {};
    const s = rules.sites?.[host] ?? {};
    return {
      blockUrls:    [...(g.blockUrls    ?? []), ...(s.blockUrls    ?? [])],
      blockPatterns:[...(g.blockPatterns ?? []), ...(s.blockPatterns ?? [])],
      replace:      [...(g.replace      ?? []), ...(s.replace      ?? [])],
      stripHeaders: [...(g.stripHeaders ?? []), ...(s.stripHeaders ?? [])],
    };
  }

  private load(): ProxyRules {
    try {
      return JSON.parse(fs.readFileSync(this.filePath, "utf-8")) as ProxyRules;
    } catch {
      return { global: {}, sites: {} };
    }
  }
}

