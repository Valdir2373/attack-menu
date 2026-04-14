import { ReplaceRule } from "./ProxyRules.js";

export interface IReplaceEngine {
  apply(text: string, rules: ReplaceRule[], phase: "request" | "response"): string;
}

