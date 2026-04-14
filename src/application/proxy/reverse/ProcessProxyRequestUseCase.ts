import { IRulesRepository } from "../../../domain/proxy/reverse/IRulesRepository.js";
import { IBlockEngine } from "../../../domain/proxy/reverse/IBlockEngine.js";
import { IHtmlSanitizer } from "../../../domain/proxy/reverse/IHtmlSanitizer.js";
import { IReplaceEngine } from "../../../domain/proxy/reverse/IReplaceEngine.js";
import { IHttpClient } from "./IHttpClient.js";
import { ReverseProxyContext, ReverseProxyResult } from "./ReverseProxyContext.js";
import type { MergedRules } from "../../../domain/proxy/reverse/ProxyRules.js";

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export class ProcessProxyRequestUseCase {
  constructor(
    private readonly rulesRepo: IRulesRepository,
    private readonly blockEngine: IBlockEngine,
    private readonly replaceEngine: IReplaceEngine,
    private readonly htmlSanitizer: IHtmlSanitizer,
    private readonly httpClient: IHttpClient,
  ) {}

  async execute(ctx: ReverseProxyContext): Promise<ReverseProxyResult> {
    const merged = this.rulesRepo.getMerged(ctx.targetHost);
    const targetUrl = `${ctx.targetDomain}${ctx.url}`;

    const blocked = this._checkBlock(targetUrl, ctx.url, merged);
    if (blocked) return blocked;

    const body = this._prepareRequestBody(ctx.rawBody, ctx.headers, merged);
    const fwdHeaders = this._buildForwardHeaders(ctx);

    const response = await this.httpClient.forward({
      url: targetUrl, method: ctx.method,
      headers: fwdHeaders, body: body ? new Uint8Array(body) : undefined,
    });

    const responseHeaders = this._buildResponseHeaders(response, merged);

    const redirect = this._handleRedirect(response, ctx, responseHeaders);
    if (redirect) return redirect;

    return this._buildBody(response, responseHeaders, merged, ctx);
  }


  private _checkBlock(targetUrl: string, url: string, merged: MergedRules): ReverseProxyResult | null {
    if (this.blockEngine.isBlocked(targetUrl, merged) || this.blockEngine.isBlocked(url, merged)) {
      return { blocked: true, status: 200, headers: {}, body: "" };
    }
    return null;
  }

  private _prepareRequestBody(rawBody: Buffer | undefined, headers: Record<string, string | string[] | undefined>, merged: MergedRules): Buffer | undefined {
    if (!rawBody?.length) return rawBody;
    const reqCt = String(headers["content-type"] ?? "");
    if (reqCt.includes("application/json")) {
      return Buffer.from(this.replaceEngine.apply(rawBody.toString(), merged.replace, "request"));
    }
    return rawBody;
  }

  private _buildForwardHeaders(ctx: ReverseProxyContext): Record<string, string> {
    return {
      "User-Agent":      String(ctx.headers["user-agent"]      ?? "Mozilla/5.0"),
      "Accept":          String(ctx.headers["accept"]          ?? "*/*"),
      "Accept-Language": String(ctx.headers["accept-language"] ?? "pt-BR,pt;q=0.9"),
      "Content-Type":    String(ctx.headers["content-type"]    ?? ""),
      "Cookie":          String(ctx.headers["cookie"]          ?? ""),
      "Referer":         ctx.targetDomain + "/",
      "Origin":          ctx.targetDomain,
      ...(ctx.headers["authorization"]
        ? { Authorization: String(ctx.headers["authorization"]) }
        : {}),
    };
  }

  private _buildResponseHeaders(response: Response, merged: MergedRules): Record<string, string | string[]> {
    const skipHeaders = new Set([
      "content-encoding", "content-length", "transfer-encoding",
      ...merged.stripHeaders.map((h) => h.toLowerCase()),
      "content-security-policy", "content-security-policy-report-only",
      "x-frame-options", "x-content-type-options", "strict-transport-security",
    ]);

    const result: Record<string, string | string[]> = {};

    response.headers.forEach((value, key) => {
      const lk = key.toLowerCase();
      if (skipHeaders.has(lk) || lk === "location") return;

      if (lk === "set-cookie") {
        const adjusted = value
          .replace(/;\s*Secure/gi, "")
          .replace(/Domain=[^;]+/gi, "Domain=localhost");
        const existing = result["set-cookie"];
        result["set-cookie"] = existing
          ? [...(Array.isArray(existing) ? existing : [existing]), adjusted]
          : adjusted;
        return;
      }

      result[key] = value;
    });

    return result;
  }

  private _handleRedirect(response: Response, ctx: ReverseProxyContext, headers: Record<string, string | string[]>): ReverseProxyResult | null {
    if (response.status < 300 || response.status >= 400) return null;
    const loc = response.headers.get("location") ?? "";
    const newLoc = loc
      .replace(ctx.targetDomain, ctx.localDomain)
      .replace(`https://${ctx.targetHost}`, ctx.localDomain)
      .replace(`http://${ctx.targetHost}`, ctx.localDomain);
    return { blocked: false, status: response.status, headers, body: "", redirect: newLoc };
  }

  private async _buildBody(response: Response, headers: Record<string, string | string[]>, merged: MergedRules, ctx: ReverseProxyContext): Promise<ReverseProxyResult> {
    const ct = response.headers.get("content-type") ?? "";
    const isText = ct.includes("text") || ct.includes("json") || ct.includes("javascript") || ct.includes("xml");

    if (isText) {
      const data = await response.text();
      const transformed = this._transformTextBody(data, ct, merged, ctx);
      return { blocked: false, status: response.status, headers, body: transformed };
    }

    const buf = await response.arrayBuffer();
    return { blocked: false, status: response.status, headers, body: Buffer.from(buf) };
  }

  private _transformTextBody(data: string, contentType: string, merged: MergedRules, ctx: ReverseProxyContext): string {
    let result = this.replaceEngine.apply(data, merged.replace, "response");

    if (contentType.includes("text/html")) {
      result = this.htmlSanitizer.sanitize(result, merged);
    }

    result = this._stripBlockedUrls(result, merged);
    result = this._rewriteDomains(result, ctx);
    return result;
  }

  private _stripBlockedUrls(data: string, merged: MergedRules): string {
    let result = data;
    for (const sub of merged.blockUrls) {
      const reUrl = new RegExp(`(?:https?:)?//[^"'\\s]*${escapeRegex(sub)}[^"'\\s]*`, "gi");
      result = result.replace(reUrl, "");
      const reStr = new RegExp(`(['"\\x60])[^'"\\x60]*${escapeRegex(sub)}[^'"\\x60]*\\1`, "gi");
      result = result.replace(reStr, (_, q) => q + q);
    }
    for (const pat of merged.blockPatterns) {
      result = result.replace(new RegExp(pat, "gi"), "");
    }
    return result;
  }

  private _rewriteDomains(data: string, ctx: ReverseProxyContext): string {
    return data
      .replaceAll(ctx.targetDomain, ctx.localDomain)
      .replaceAll(`https://${ctx.targetHost}`, ctx.localDomain)
      .replaceAll(`http://${ctx.targetHost}`, ctx.localDomain);
  }
}

