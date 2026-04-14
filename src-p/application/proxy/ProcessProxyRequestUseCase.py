import re
from typing import Dict, List, Optional, Union

from domain.proxy.IRulesRepository import IRulesRepository
from domain.proxy.IBlockEngine import IBlockEngine
from domain.proxy.IReplaceEngine import IReplaceEngine
from domain.proxy.IHtmlSanitizer import IHtmlSanitizer
from domain.proxy.ProxyRules import MergedRules
from application.proxy.IHttpClient import IHttpClient, HttpForwardRequest, HttpForwardResponse
from application.proxy.ReverseProxyContext import ReverseProxyContext, ReverseProxyResult

_QUOTE_RE = re.compile(r"""(['"`])[^'"`]*PLACEHOLDER[^'"`]*\1""")


def _escape_regex(s: str) -> str:
    return re.escape(s)


class ProcessProxyRequestUseCase:
    def __init__(
        self,
        rules_repo: IRulesRepository,
        block_engine: IBlockEngine,
        replace_engine: IReplaceEngine,
        html_sanitizer: IHtmlSanitizer,
        http_client: IHttpClient,
    ):
        self._rules_repo = rules_repo
        self._block_engine = block_engine
        self._replace_engine = replace_engine
        self._html_sanitizer = html_sanitizer
        self._http_client = http_client

    async def execute(self, ctx: ReverseProxyContext) -> ReverseProxyResult:
        merged = self._rules_repo.get_merged(ctx.target_host)
        target_url = f"{ctx.target_domain}{ctx.url}"

        blocked = self._check_block(target_url, ctx.url, merged)
        if blocked:
            return blocked

        body = self._prepare_request_body(ctx.raw_body, ctx.headers, merged)
        fwd_headers = self._build_forward_headers(ctx)

        response = await self._http_client.forward(HttpForwardRequest(
            url=target_url,
            method=ctx.method,
            headers=fwd_headers,
            body=body,
        ))

        response_headers = self._build_response_headers(response, merged)

        redirect = self._handle_redirect(response, ctx, response_headers)
        if redirect:
            return redirect

        return self._build_body(response, response_headers, merged, ctx)

    def _check_block(self, target_url: str, url: str, merged: MergedRules) -> Optional[ReverseProxyResult]:
        if self._block_engine.is_blocked(target_url, merged) or self._block_engine.is_blocked(url, merged):
            return ReverseProxyResult(blocked=True, status=200, headers={}, body="")
        return None

    def _prepare_request_body(self, raw_body: Optional[bytes], headers: dict, merged: MergedRules) -> Optional[bytes]:
        if not raw_body:
            return raw_body
        ct = headers.get("content-type", "")
        if "application/json" in ct:
            replaced = self._replace_engine.apply(raw_body.decode("utf-8", errors="replace"), merged.replace, "request")
            return replaced.encode("utf-8")
        return raw_body

    def _build_forward_headers(self, ctx: ReverseProxyContext) -> dict:
        h = ctx.headers
        result = {
            "User-Agent":      h.get("user-agent", "Mozilla/5.0"),
            "Accept":          h.get("accept", "*/*"),
            "Accept-Language": h.get("accept-language", "pt-BR,pt;q=0.9"),
            "Content-Type":    h.get("content-type", ""),
            "Cookie":          h.get("cookie", ""),
            "Referer":         ctx.target_domain + "/",
            "Origin":          ctx.target_domain,
        }
        if "authorization" in h:
            result["Authorization"] = h["authorization"]
        return result

    def _build_response_headers(
        self, response: HttpForwardResponse, merged: MergedRules
    ) -> Dict[str, Union[str, List[str]]]:
        skip = {
            "content-encoding", "content-length", "transfer-encoding",
            "content-security-policy", "content-security-policy-report-only",
            "x-frame-options", "x-content-type-options", "strict-transport-security",
            "location",
        }
        for sh in merged.stripHeaders:
            skip.add(sh.lower())

        result: Dict[str, Union[str, List[str]]] = {}

        for k, v in response.headers.items():
            lk = k.lower()
            if lk in skip:
                continue

            if lk == "set-cookie":
                cookies = v if isinstance(v, list) else [v]
                adjusted = []
                for cookie in cookies:
                    c = re.sub(r";\s*Secure", "", cookie, flags=re.IGNORECASE)
                    c = re.sub(r"Domain=[^;]+", "Domain=localhost", c, flags=re.IGNORECASE)
                    adjusted.append(c)
                result["set-cookie"] = adjusted if len(adjusted) > 1 else adjusted[0]
                continue

            result[k] = v

        return result

    def _handle_redirect(
        self, response: HttpForwardResponse, ctx: ReverseProxyContext, headers: dict
    ) -> Optional[ReverseProxyResult]:
        if not (300 <= response.status < 400):
            return None
        loc = response.headers.get("location", "")
        if isinstance(loc, list):
            loc = loc[0]
        new_loc = loc \
            .replace(ctx.target_domain, ctx.local_domain) \
            .replace(f"https://{ctx.target_host}", ctx.local_domain) \
            .replace(f"http://{ctx.target_host}", ctx.local_domain)
        return ReverseProxyResult(blocked=False, status=response.status, headers=headers, body="", redirect=new_loc)

    def _build_body(
        self, response: HttpForwardResponse, headers: dict, merged: MergedRules, ctx: ReverseProxyContext
    ) -> ReverseProxyResult:
        ct = response.content_type
        is_text = any(t in ct for t in ("text", "json", "javascript", "xml"))

        if is_text:
            text = response.body.decode("utf-8", errors="replace")
            transformed = self._transform_text_body(text, ct, merged, ctx)
            return ReverseProxyResult(blocked=False, status=response.status, headers=headers, body=transformed)

        return ReverseProxyResult(blocked=False, status=response.status, headers=headers, body=response.body)

    def _transform_text_body(self, data: str, content_type: str, merged: MergedRules, ctx: ReverseProxyContext) -> str:
        result = self._replace_engine.apply(data, merged.replace, "response")
        if "text/html" in content_type:
            result = self._html_sanitizer.sanitize(result, merged)
        result = self._strip_blocked_urls(result, merged)
        result = self._rewrite_domains(result, ctx)
        return result

    def _strip_blocked_urls(self, data: str, merged: MergedRules) -> str:
        result = data
        for sub in merged.blockUrls:
            esc = _escape_regex(sub)
            result = re.sub(
                r"(?:https?:)?//[^\"\'\s]*" + esc + r"[^\"\'\s]*",
                "",
                result,
                flags=re.IGNORECASE,
            )
            result = re.sub(
                r"""(['"`])[^'"`]*""" + esc + r"""[^'"`]*\1""",
                lambda m: m.group(1) + m.group(1),
                result,
                flags=re.IGNORECASE,
            )
        for pat in merged.blockPatterns:
            result = re.sub(pat, "", result, flags=re.IGNORECASE)
        return result

    def _rewrite_domains(self, data: str, ctx: ReverseProxyContext) -> str:
        result = data.replace(ctx.target_domain, ctx.local_domain)
        result = result.replace(f"https://{ctx.target_host}", ctx.local_domain)
        result = result.replace(f"http://{ctx.target_host}", ctx.local_domain)
        return result
