import { MergedRules } from "./ProxyRules.js";

export interface IRulesRepository {
  getMerged(host: string): MergedRules;
}

