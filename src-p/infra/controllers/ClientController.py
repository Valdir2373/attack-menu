from typing import Any, Dict
from infra.controllers.BaseController import BaseController
from infra.services.ConnectionService import ConnectionService
from infra.utils.Logger import Logger
from application.client.dto.CommandOutputDto import CommandOutputDTO


class ClientController(BaseController):

    def __init__(self, connection_service: ConnectionService, logger: Logger) -> None:
        super().__init__(logger.child("ClientController"))
        self._connections = connection_service

    def get_actions(self) -> Dict[str, Any]:
        return {
            "ping":         self.ping,
            "status":       self.status,
            "list_clients": self.list_clients,
        }

    async def ping(self, payload: Dict[str, Any]) -> CommandOutputDTO:
        return self._ok(data={"pong": True, "message": "Server is alive"})

    async def status(self, payload: Dict[str, Any]) -> CommandOutputDTO:
        return self._ok(data={
            "clients_connected": self._connections.connected_clients_count,
            "agents_connected":  self._connections.connected_agents_count,
        })

    async def list_clients(self, payload: Dict[str, Any]) -> CommandOutputDTO:
        return self._ok(data={
            "clients": list(self._connections.client_ids),
            "agents":  list(self._connections.agent_ids),
        })
