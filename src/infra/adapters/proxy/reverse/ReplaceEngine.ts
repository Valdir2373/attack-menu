import { IReplaceEngine } from "../../../../domain/proxy/reverse/IReplaceEngine.js";
import { ReplaceRule } from "../../../../domain/proxy/reverse/ProxyRules.js";

export class ReplaceEngine implements IReplaceEngine {
  apply(text: string, rules: ReplaceRule[], phase: "request" | "response"): string {
    for (const rule of rules) {
      const target = rule.on ?? "response";
      if (target !== phase && target !== "both") continue;

      if (rule.from.startsWith("regex:")) {
        text = text.replace(new RegExp(rule.from.slice(6), "gi"), rule.to);
      } else {
        text = text.replaceAll(rule.from, rule.to);
      }
    }
    return text;
  }
}

