import { MergedRules } from "./ProxyRules.js";

export interface IHtmlSanitizer {
  sanitize(html: string, rules: MergedRules): string;
}

