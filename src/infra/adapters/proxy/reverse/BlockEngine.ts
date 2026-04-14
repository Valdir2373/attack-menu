import { IBlockEngine } from "../../../../domain/proxy/reverse/IBlockEngine.js";
import { MergedRules } from "../../../../domain/proxy/reverse/ProxyRules.js";

export class BlockEngine implements IBlockEngine {
  isBlocked(text: string, rules: MergedRules): boolean {
    for (const sub of rules.blockUrls) {
      if (text.includes(sub)) return true;
    }
    for (const pat of rules.blockPatterns) {
      if (new RegExp(pat, "i").test(text)) return true;
    }
    return false;
  }
}

