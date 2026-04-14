import asyncio
import os
from typing import Any, Callable, Dict, Optional

from application.client.dto.CommandOutputDto import CommandOutputDTO
from application.client.use_cases.DispatchCommand import DispatchCommandUseCase
from application.proxy.ProcessProxyRequestUseCase import ProcessProxyRequestUseCase
from infra.adapters.proxy.BlockEngine import BlockEngine
from infra.adapters.proxy.ReplaceEngine import ReplaceEngine
from infra.adapters.proxy.HtmlSanitizer import HtmlSanitizer
from infra.adapters.proxy.RulesJsonRepository import RulesJsonRepository
from infra.adapters.proxy.AiohttpHttpClient import AiohttpHttpClient
from infra.adapters.proxy.AiohttpReverseProxyServer import AiohttpReverseProxyServer

RULES_PATH = "/app/rules.json"
DEFAULT_PORT = 1212


class ProxyReverseModule:

    def __init__(self, broadcast: Callable) -> None:
        self._broadcast = broadcast
        self._server: Optional[AiohttpReverseProxyServer] = None
        self._target_url: str = ""
        self._port: int = DEFAULT_PORT
        self._running: bool = False

    def install(self, dispatcher: DispatchCommandUseCase) -> None:
        dispatcher.register("start_proxy",  self._handle_start)
        dispatcher.register("stop_proxy",   self._handle_stop)
        dispatcher.register("proxy_status", self._handle_status)

    async def _handle_start(self, data: Dict[str, Any]) -> CommandOutputDTO:
        if self._running:
            return CommandOutputDTO.fail("Proxy já está rodando", event="proxy_error")

        target_url = data.get("targetUrl", "")
        port = int(data.get("port", DEFAULT_PORT))

        if not target_url:
            return CommandOutputDTO.fail("targetUrl é obrigatório", event="proxy_error")

        self._target_url = target_url
        self._port = port

        try:
            def _log(line: str) -> None:
                asyncio.create_task(
                    self._async_broadcast(CommandOutputDTO.push_event("proxy_log", {"line": line}))
                )

            block_engine   = BlockEngine()
            replace_engine = ReplaceEngine()
            html_sanitizer = HtmlSanitizer(block_engine)
            rules_repo     = RulesJsonRepository(RULES_PATH)
            http_client    = AiohttpHttpClient()

            use_case = ProcessProxyRequestUseCase(
                rules_repo, block_engine, replace_engine, html_sanitizer, http_client
            )

            self._server = AiohttpReverseProxyServer(use_case, logger=_log)
            await self._server.start(target_url, port)
            self._running = True
            await self._async_broadcast(
                CommandOutputDTO.push_event("proxy_started", {"port": port, "targetUrl": target_url})
            )
            return CommandOutputDTO.ok({"port": port, "targetUrl": target_url}, event="proxy_started")
        except Exception as e:
            self._server = None
            self._running = False
            err_msg = str(e)
            await self._async_broadcast(CommandOutputDTO.fail(err_msg, event="proxy_error"))
            return CommandOutputDTO.fail(err_msg, event="proxy_error")

    async def _handle_stop(self, _data: Dict[str, Any]) -> CommandOutputDTO:
        if not self._running or not self._server:
            return CommandOutputDTO.fail("Proxy não está rodando", event="proxy_error")

        await self._server.stop()
        self._server = None
        self._running = False
        await self._async_broadcast(CommandOutputDTO.push_event("proxy_stopped", {}))
        return CommandOutputDTO.ok(event="proxy_stopped")

    async def _handle_status(self, _data: Dict[str, Any]) -> CommandOutputDTO:
        return CommandOutputDTO.ok({
            "running": self._running,
            "targetUrl": self._target_url,
            "port": self._port,
        })

    async def _async_broadcast(self, output: CommandOutputDTO) -> None:
        try:
            result = self._broadcast(output)
            if asyncio.iscoroutine(result):
                await result
        except Exception:
            pass
