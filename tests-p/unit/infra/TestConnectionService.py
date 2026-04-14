import pytest
from unittest.mock import AsyncMock, MagicMock
from infra.services.ConnectionService import ConnectionService
from infra.utils.Logger import Logger
from application.client.dto.CommandOutputDto import CommandOutputDTO


@pytest.fixture
def service():
    logger = Logger(debug=False)
    return ConnectionService(logger)


class TestConnectionService:

    def test_initially_empty(self, service):
        assert service.connected_clients_count == 0
        assert service.connected_agents_count == 0

    def test_register_client(self, service):
        ws = MagicMock()
        service.register_client("client-1", ws)

        assert service.connected_clients_count == 1
        assert "client-1" in service.client_ids

    def test_register_multiple_clients(self, service):
        for i in range(5):
            service.register_client(f"client-{i}", MagicMock())

        assert service.connected_clients_count == 5

    def test_unregister_client(self, service):
        ws = MagicMock()
        service.register_client("c1", ws)
        service.unregister_client("c1")

        assert service.connected_clients_count == 0
        assert "c1" not in service.client_ids

    def test_register_agent(self, service):
        ws = MagicMock()
        service.register_agent("agent-1", ws)

        assert service.connected_agents_count == 1
        assert "agent-1" in service.agent_ids

    def test_unregister_agent(self, service):
        ws = MagicMock()
        service.register_agent("a1", ws)
        service.unregister_agent("a1")

        assert service.connected_agents_count == 0

    @pytest.mark.asyncio
    async def test_broadcast_to_clients(self, service):
        ws1 = AsyncMock()
        ws2 = AsyncMock()
        service.register_client("c1", ws1)
        service.register_client("c2", ws2)

        event = CommandOutputDTO.push_event("test", {"msg": "hello"})
        await service.broadcast_to_clients(event)

        assert ws1.send.called
        assert ws2.send.called

    def test_unregister_nonexistent_no_error(self, service):
        service.unregister_client("nonexistent")
        service.unregister_agent("nonexistent")
