import asyncio
import hmac
import json
import os
from uuid import uuid4
from typing import Any
import websockets
from websockets.server import WebSocketServerProtocol

from infra.services.ConnectionService import ConnectionService
from infra.utils.Logger import Logger
from infra.utils.Serializer import Serializer
from application.client.dto.CommandInputDto import CommandInputDTO
from application.client.dto.CommandOutputDto import CommandOutputDTO
from application.client.use_cases.DispatchCommand import DispatchCommandUseCase


class WsServer:
    def __init__(
        self,
        dispatcher: DispatchCommandUseCase,
        connection_service: ConnectionService,
        logger: Logger,
        management_port: int = 4445,
        agent_port: int = 4444,
        host: str = "0.0.0.0",
    ) -> None:
        self._dispatcher      = dispatcher
        self._connections     = connection_service
        self._logger          = logger.child("WsServer")
        self._management_port = management_port
        self._agent_port      = agent_port
        self._host            = host
        self._authenticated: dict[str, bool] = {}

    async def _authenticate_client(
        self, client_id: str, ws: WebSocketServerProtocol
    ) -> bool:
        expected_token = os.getenv("OPERATOR_TOKEN", "")
        if not expected_token:
            await ws.send(Serializer.dumps(
                CommandOutputDTO.fail("OPERATOR_TOKEN not configured on server").to_dict()
            ))
            await ws.close()
            return False

        try:
            raw = await asyncio.wait_for(ws.recv(), timeout=10.0)
            data = Serializer.loads(str(raw))
        except (asyncio.TimeoutError, json.JSONDecodeError, Exception):
            await ws.send(Serializer.dumps(
                CommandOutputDTO.fail("Auth timeout or invalid payload").to_dict()
            ))
            await ws.close()
            return False

        if data.get("action") != "auth":
            await ws.send(Serializer.dumps(
                CommandOutputDTO.fail("First message must be auth").to_dict()
            ))
            await ws.close()
            return False

        token = str(data.get("payload", {}).get("token", ""))
        if not hmac.compare_digest(token, expected_token):
            await ws.send(Serializer.dumps(
                CommandOutputDTO.fail("Invalid token").to_dict()
            ))
            await ws.close()
            return False

        return True

    async def _handle_management(self, ws: WebSocketServerProtocol) -> None:
        client_id = str(uuid4())
        self._connections.register_client(client_id, ws)

        if not await self._authenticate_client(client_id, ws):
            self._connections.unregister_client(client_id)
            return

        self._authenticated[client_id] = True

        await ws.send(Serializer.dumps(
            CommandOutputDTO.push_event("connected", {"client_id": client_id}).to_dict()
        ))

        try:
            async for raw in ws:
                await self._process_client_message(client_id, str(raw), ws)
        except websockets.exceptions.ConnectionClosedError:
            pass
        except Exception as exc:
            self._logger.error(f"Erro inesperado (client {client_id}): {exc}")
        finally:
            self._authenticated.pop(client_id, None)
            self._connections.unregister_client(client_id)

    async def _process_client_message(
        self, client_id: str, raw: str, ws: WebSocketServerProtocol
    ) -> None:
        try:
            data    = Serializer.loads(raw)
            command = CommandInputDTO.from_dict(data)
        except (json.JSONDecodeError, ValueError) as exc:
            await ws.send(Serializer.dumps(CommandOutputDTO.fail(f"Mensagem inválida: {exc}").to_dict()))
            return

        self._logger.debug(f"[{client_id}] action={command.action}")
        try:
            output = await self._dispatcher.execute(command)
        except Exception as exc:
            output = CommandOutputDTO.fail(f"Erro ao executar comando: {exc}")
        await ws.send(Serializer.dumps(output.to_dict()))

    async def _handle_agent(self, ws: WebSocketServerProtocol) -> None:
        agent_id = str(uuid4())
        self._connections.register_agent(agent_id, ws)

        await self._connections.broadcast_to_clients(
            CommandOutputDTO.push_event("agent_connected", {"agent_id": agent_id})
        )

        try:
            async for raw in ws:
                await self._process_agent_message(agent_id, str(raw))
        except websockets.exceptions.ConnectionClosedError:
            pass
        except Exception as exc:
            self._logger.error(f"Erro inesperado (agent {agent_id}): {exc}")
        finally:
            self._connections.unregister_agent(agent_id)
            await self._connections.broadcast_to_clients(
                CommandOutputDTO.push_event("agent_disconnected", {"agent_id": agent_id})
            )

    async def _process_agent_message(self, agent_id: str, raw: str) -> None:
        self._logger.debug(f"[agent:{agent_id}] {raw[:120]}")
        try:
            data = Serializer.loads(raw)
        except json.JSONDecodeError:
            data = {"raw": raw}

        try:
            await self._connections.broadcast_to_clients(
                CommandOutputDTO.push_event("agent_message", {"agent_id": agent_id, "data": data})
            )
        except Exception as exc:
            self._logger.error(f"Broadcast failed for agent {agent_id}: {exc}")

    async def start(self) -> None:
        try:
            management = websockets.serve(self._handle_management, self._host, self._management_port)
            agent      = websockets.serve(self._handle_agent, "0.0.0.0", self._agent_port)
        except OSError as exc:
            raise ConnectionError(f"Failed to bind WebSocket ports ({self._management_port}, {self._agent_port}): {exc}")

        try:
            async with management, agent:
                self._logger.info(f"Management WS → ws://{self._host}:{self._management_port}")
                self._logger.info(f"Agent WS      → ws://0.0.0.0:{self._agent_port}")
                await asyncio.Future()
        except OSError as exc:
            raise ConnectionError(f"WebSocket server startup failed: {exc}")  