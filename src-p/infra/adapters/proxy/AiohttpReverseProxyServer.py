import asyncio
from typing import Callable, Dict, List, Optional, Union
from urllib.parse import urlparse

from aiohttp import web
from multidict import CIMultiDict

from application.proxy.IReverseProxyServer import IReverseProxyServer
from application.proxy.ProcessProxyRequestUseCase import ProcessProxyRequestUseCase
from application.proxy.ReverseProxyContext import ReverseProxyContext


class AiohttpReverseProxyServer(IReverseProxyServer):
    def __init__(self, use_case: ProcessProxyRequestUseCase, logger: Callable[[str], None] = print):
        self._use_case = use_case
        self._logger = logger
        self._runner: Optional[web.AppRunner] = None
        self._target_domain: str = ""
        self._target_host: str = ""
        self._local_domain: str = ""

    async def start(self, target_url: str, port: int) -> None:
        self._target_domain = target_url.rstrip("/")
        parsed = urlparse(self._target_domain)
        self._target_host = parsed.hostname or ""
        self._local_domain = f"http://localhost:{port}"

        app = web.Application()
        app.router.add_route("GET", "/__blocked__", lambda r: web.Response(status=200, text=""))
        app.router.add_route("*", "/{path_info:.*}", self._handle)

        self._runner = web.AppRunner(app)
        await self._runner.setup()
        site = web.TCPSite(self._runner, "0.0.0.0", port)
        await site.start()

        self._logger(
            f"\n\033[31m  PROXY\033[0m"
            f"\n  \033[90mLocal  :\033[0m \033[37m{self._local_domain}\033[0m"
            f"\n  \033[90mAlvo   :\033[0m \033[31m{self._target_domain}\033[0m"
            f"\n  \033[90mRules  :\033[0m \033[37m./rules.json\033[0m"
        )

    async def stop(self) -> None:
        if self._runner:
            await self._runner.cleanup()
            self._runner = None

    async def _handle(self, request: web.Request) -> web.Response:
        path = "/" + request.match_info.get("path_info", "")
        query = request.rel_url.query_string
        url = f"{path}?{query}" if query else path

        headers = {k.lower(): v for k, v in request.headers.items()}
        for h in ("host", "connection", "keep-alive", "proxy-authenticate",
                  "proxy-authorization", "te", "trailers", "transfer-encoding", "upgrade"):
            headers.pop(h, None)

        raw_body: Optional[bytes] = None
        if request.method not in ("GET", "HEAD"):
            raw_body = await request.read()

        ctx = ReverseProxyContext(
            target_domain=self._target_domain,
            target_host=self._target_host,
            local_domain=self._local_domain,
            method=request.method,
            url=url,
            headers=headers,
            raw_body=raw_body,
        )

        try:
            result = await self._use_case.execute(ctx)
        except Exception as e:
            msg = str(e)
            if "timeout" in msg.lower() or "aborted" in msg.lower():
                self._logger(f"\033[33m[TIMEOUT]\033[0m {url}")
                return web.Response(status=504, text="")
            self._logger(f"\033[31m[ERRO]\033[0m {url} — {msg}")
            return web.Response(status=502, text="")

        if result.blocked:
            self._logger(f"\033[31m[BLOQUEADO]\033[0m {url}")
            return web.Response(status=200, text="")

        response_headers = CIMultiDict()
        for k, v in result.headers.items():
            if k.lower() == "set-cookie":
                cookies = v if isinstance(v, list) else [v]
                for cookie in cookies:
                    response_headers.add("Set-Cookie", cookie)
            elif isinstance(v, list):
                for item in v:
                    response_headers.add(k, item)
            else:
                response_headers[k] = v

        if result.redirect:
            response_headers["Location"] = result.redirect
            return web.Response(status=result.status, headers=response_headers, text="")

        ct_raw = response_headers.pop("content-type", None) or response_headers.pop("Content-Type", None)

        if isinstance(result.body, str):
            self._logger(f"\033[32m[OK]\033[0m {request.method} {url}")
            ct = (ct_raw if isinstance(ct_raw, str) else (ct_raw[0] if ct_raw else "text/html"))
            mime = ct.split(";")[0].strip()
            return web.Response(
                status=result.status,
                headers=response_headers,
                body=result.body.encode("utf-8", errors="replace"),
                content_type=mime,
                charset="utf-8",
            )
        else:
            self._logger(f"\033[34m[BIN]\033[0m {request.method} {url}")
            ct = (ct_raw if isinstance(ct_raw, str) else (ct_raw[0] if ct_raw else "application/octet-stream"))
            mime = ct.split(";")[0].strip()
            return web.Response(
                status=result.status,
                headers=response_headers,
                body=result.body,
                content_type=mime,
            )
