import { MergedRules } from "./ProxyRules.js";

export interface IBlockEngine {
  isBlocked(text: string, rules: MergedRules): boolean;
}

