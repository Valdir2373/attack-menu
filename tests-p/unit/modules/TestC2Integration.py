import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from infra.services.ConnectionService import ConnectionService
from infra.utils.Logger import Logger
from application.client.dto.CommandInputDto import CommandInputDTO
from application.client.dto.CommandOutputDto import CommandOutputDTO
from application.client.use_cases.DispatchCommand import DispatchCommandUseCase


@pytest.fixture
def logger():
    return Logger(debug=False)


@pytest.fixture
def conn(logger):
    return ConnectionService(logger)


@pytest.fixture
def dispatcher():
    return DispatchCommandUseCase()


class TestAgentConnectionBroadcast:

    @pytest.mark.asyncio
    async def test_agent_connect_broadcasts_event_to_all_clients(self, conn):
        ws1 = AsyncMock()
        ws2 = AsyncMock()
        conn.register_client("c1", ws1)
        conn.register_client("c2", ws2)

        event = CommandOutputDTO.push_event("agent_connected", {"agent_id": "a1"})
        await conn.broadcast_to_clients(event)

        assert ws1.send.called
        assert ws2.send.called

    @pytest.mark.asyncio
    async def test_broadcast_skips_dead_client_and_removes_it(self, conn):
        alive_ws = AsyncMock()
        dead_ws = AsyncMock()
        dead_ws.send.side_effect = ConnectionError("peer gone")
        conn.register_client("alive", alive_ws)
        conn.register_client("dead", dead_ws)

        event = CommandOutputDTO.push_event("agent_connected", {"agent_id": "a1"})
        await conn.broadcast_to_clients(event)

        assert alive_ws.send.called
        assert "dead" not in conn.client_ids

    @pytest.mark.asyncio
    async def test_broadcast_with_no_clients_does_not_raise(self, conn):
        event = CommandOutputDTO.push_event("agent_connected", {"agent_id": "a1"})
        await conn.broadcast_to_clients(event)

    @pytest.mark.asyncio
    async def test_broadcast_payload_contains_agent_id(self, conn):
        ws = AsyncMock()
        conn.register_client("c1", ws)

        event = CommandOutputDTO.push_event("agent_connected", {"agent_id": "agent-xyz"})
        await conn.broadcast_to_clients(event)

        sent_data = ws.send.call_args[0][0]
        assert "agent-xyz" in sent_data

    @pytest.mark.asyncio
    async def test_multiple_agents_each_trigger_separate_broadcast(self, conn):
        ws = AsyncMock()
        conn.register_client("c1", ws)

        for agent_id in ["a1", "a2", "a3"]:
            conn.register_agent(agent_id, AsyncMock())
            event = CommandOutputDTO.push_event("agent_connected", {"agent_id": agent_id})
            await conn.broadcast_to_clients(event)

        assert ws.send.call_count == 3


class TestClientCommandDispatch:

    @pytest.mark.asyncio
    async def test_dispatch_known_action_returns_success(self, dispatcher):
        async def handler(payload):
            return CommandOutputDTO.ok(data={"result": "done"})

        dispatcher.register("run_cmd", handler)
        cmd = CommandInputDTO(action="run_cmd", payload={"target": "m1"})
        out = await dispatcher.execute(cmd)

        assert out.success is True
        assert out.data["result"] == "done"

    @pytest.mark.asyncio
    async def test_dispatch_unknown_action_returns_failure(self, dispatcher):
        cmd = CommandInputDTO(action="nonexistent_action", payload={})
        out = await dispatcher.execute(cmd)

        assert out.success is False
        assert "desconhecida" in out.error

    @pytest.mark.asyncio
    async def test_dispatch_handler_exception_returns_failure(self, dispatcher):
        async def bad_handler(payload):
            raise RuntimeError("segfault in agent")

        dispatcher.register("crash", bad_handler)
        cmd = CommandInputDTO(action="crash", payload={})
        out = await dispatcher.execute(cmd)

        assert out.success is False
        assert "segfault" in out.error

    @pytest.mark.asyncio
    async def test_dispatch_forwards_payload_to_handler(self, dispatcher):
        received = {}

        async def handler(payload):
            received.update(payload)
            return CommandOutputDTO.ok()

        dispatcher.register("send_cmd", handler)
        cmd = CommandInputDTO(action="send_cmd", payload={"machine_id": "m1", "command": "whoami"})
        await dispatcher.execute(cmd)

        assert received["machine_id"] == "m1"
        assert received["command"] == "whoami"

    @pytest.mark.asyncio
    async def test_dispatch_overwrites_handler_for_same_action(self, dispatcher):
        async def old(payload):
            return CommandOutputDTO.ok(data={"version": 1})

        async def new(payload):
            return CommandOutputDTO.ok(data={"version": 2})

        dispatcher.register("cmd", old)
        dispatcher.register("cmd", new)

        out = await dispatcher.execute(CommandInputDTO(action="cmd"))
        assert out.data["version"] == 2


class TestConnectionServiceAgentTracking:

    def test_register_agent_increments_count(self, conn):
        conn.register_agent("a1", MagicMock())
        conn.register_agent("a2", MagicMock())

        assert conn.connected_agents_count == 2

    def test_agent_ids_returns_set_of_registered_ids(self, conn):
        conn.register_agent("alpha", MagicMock())
        conn.register_agent("beta", MagicMock())

        assert conn.agent_ids == {"alpha", "beta"}

    @pytest.mark.asyncio
    async def test_send_to_agent_delivers_message(self, conn):
        ws = AsyncMock()
        conn.register_agent("a1", ws)

        ok = await conn.send_to_agent("a1", '{"type":"cmd","command":"whoami"}')

        assert ok is True
        ws.send.assert_called_once_with('{"type":"cmd","command":"whoami"}')

    @pytest.mark.asyncio
    async def test_send_to_unknown_agent_returns_false(self, conn):
        ok = await conn.send_to_agent("nonexistent", '{"type":"cmd"}')

        assert ok is False

    @pytest.mark.asyncio
    async def test_send_to_agent_returns_false_on_ws_error(self, conn):
        ws = AsyncMock()
        ws.send.side_effect = ConnectionError("broken pipe")
        conn.register_agent("a1", ws)

        ok = await conn.send_to_agent("a1", '{"type":"cmd"}')

        assert ok is False


class TestAgentDisconnectCleanup:

    def test_unregister_agent_decrements_count(self, conn):
        conn.register_agent("a1", MagicMock())
        conn.register_agent("a2", MagicMock())
        conn.unregister_agent("a1")

        assert conn.connected_agents_count == 1

    def test_unregister_agent_removes_from_agent_ids(self, conn):
        conn.register_agent("a1", MagicMock())
        conn.unregister_agent("a1")

        assert "a1" not in conn.agent_ids

    @pytest.mark.asyncio
    async def test_send_to_unregistered_agent_fails(self, conn):
        conn.register_agent("a1", AsyncMock())
        conn.unregister_agent("a1")

        ok = await conn.send_to_agent("a1", '{"type":"ping"}')
        assert ok is False

    @pytest.mark.asyncio
    async def test_disconnect_broadcast_reaches_clients(self, conn):
        client_ws = AsyncMock()
        conn.register_client("c1", client_ws)
        conn.register_agent("a1", MagicMock())

        conn.unregister_agent("a1")

        event = CommandOutputDTO.push_event("agent_disconnected", {"agent_id": "a1"})
        await conn.broadcast_to_clients(event)

        assert client_ws.send.called
        sent_data = client_ws.send.call_args[0][0]
        assert "agent_disconnected" in sent_data

    def test_unregister_nonexistent_agent_no_error(self, conn):
        conn.unregister_agent("ghost-agent")
        assert conn.connected_agents_count == 0
