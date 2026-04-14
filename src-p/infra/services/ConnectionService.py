import asyncio
from typing import Any, Dict, Set
from infra.utils.Logger import Logger
from infra.utils.Serializer import Serializer
from application.client.dto.CommandOutputDto import CommandOutputDTO


class ConnectionService:

    def __init__(self, logger: Logger) -> None:
        self._logger  = logger.child("ConnectionService")
        self._clients: Dict[str, Any] = {}
        self._agents:  Dict[str, Any] = {}

    def register_client(self, client_id: str, ws: Any) -> None:
        self._clients[client_id] = ws
        self._logger.info(f"Client conectado: {client_id} (total: {len(self._clients)})")

    def unregister_client(self, client_id: str) -> None:
        self._clients.pop(client_id, None)
        self._logger.info(f"Client desconectado: {client_id} (total: {len(self._clients)})")

    async def send_to_client(self, client_id: str, output: CommandOutputDTO) -> bool:
        ws = self._clients.get(client_id)
        if ws is None:
            return False
        try:
            await ws.send(Serializer.dumps(output.to_dict()))
            return True
        except Exception as exc:
            self._logger.error(f"Erro ao enviar para client {client_id}: {exc}")
            return False

    async def broadcast_to_clients(self, output: CommandOutputDTO) -> None:
        payload = Serializer.dumps(output.to_dict())
        dead: list[str] = []
        for client_id, ws in list(self._clients.items()):
            try:
                await ws.send(payload)
            except Exception as exc:
                self._logger.error(f"Broadcast failed for client {client_id}: {exc}")
                dead.append(client_id)
        for client_id in dead:
            self._clients.pop(client_id, None)

    def register_agent(self, agent_id: str, ws: Any) -> None:
        self._agents[agent_id] = ws
        self._logger.info(f"Agente conectado: {agent_id} (total: {len(self._agents)})")

    def unregister_agent(self, agent_id: str) -> None:
        self._agents.pop(agent_id, None)
        self._logger.info(f"Agente desconectado: {agent_id} (total: {len(self._agents)})")

    async def send_to_agent(self, agent_id: str, message: str) -> bool:
        ws = self._agents.get(agent_id)
        if ws is None:
            return False
        try:
            await ws.send(message)
            return True
        except Exception as exc:
            self._logger.error(f"Erro ao enviar para agente {agent_id}: {exc}")
            return False

    @property
    def client_ids(self) -> Set[str]:
        return set(self._clients.keys())

    @property
    def agent_ids(self) -> Set[str]:
        return set(self._agents.keys())

    @property
    def connected_clients_count(self) -> int:
        return len(self._clients)

    @property
    def connected_agents_count(self) -> int:
        return len(self._agents)
