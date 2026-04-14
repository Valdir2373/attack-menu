import { IHtmlSanitizer } from "../../../../domain/proxy/reverse/IHtmlSanitizer.js";
import { IBlockEngine } from "../../../../domain/proxy/reverse/IBlockEngine.js";
import { MergedRules } from "../../../../domain/proxy/reverse/ProxyRules.js";

export class HtmlSanitizer implements IHtmlSanitizer {
  constructor(private readonly blockEngine: IBlockEngine) {}

  sanitize(html: string, rules: MergedRules): string {

    html = html.replace(
      /<script(\s[^>]*)?>[\s\S]*?<\/script>/gi,
      (match, attrs = "") => {
        if (this.isBlockedAttr(attrs, rules)) return "";
        if (this.blockEngine.isBlocked(match, rules)) return "";
        return match;
      },
    );

    html = html.replace(
      /<script(\s[^>]*)>/gi,
      (match, attrs = "") => (this.isBlockedAttr(attrs, rules) ? "" : match),
    );


    for (const tag of ["iframe", "frame", "embed", "object"]) {
      html = html.replace(
        new RegExp(`<${tag}(\\s[^>]*)?>[\\s\\S]*?</${tag}>`, "gi"),
        (match, attrs = "") => (this.isBlockedAttr(attrs, rules) ? "" : match),
      );
      html = html.replace(
        new RegExp(`<${tag}(\\s[^>]*)?>`, "gi"),
        (match, attrs = "") => (this.isBlockedAttr(attrs, rules) ? "" : match),
      );
    }


    for (const tag of ["link", "img", "source", "input"]) {
      html = html.replace(
        new RegExp(`<${tag}(\\s[^>]*)/?>`, "gi"),
        (match, attrs = "") => (this.isBlockedAttr(attrs, rules) ? "" : match),
      );
    }

    return html;
  }

  private isBlockedAttr(attrs: string, rules: MergedRules): boolean {
    const re = /(?:src|href|data|action|poster)=['"]([^'"]*)['"]/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(attrs)) !== null) {
      if (this.blockEngine.isBlocked(m[1], rules)) return true;
    }
    return false;
  }
}

