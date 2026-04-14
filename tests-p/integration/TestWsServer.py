import asyncio
import json
import pytest
import websockets
from infra.app.AppModule import AppModule


@pytest.fixture
async def running_server():
    app    = AppModule(management_port=14445, agent_port=14444)
    server = app.get_server()

    task = asyncio.create_task(server.start())
    await asyncio.sleep(0.1)

    yield server

    task.cancel()
    try:
        await task
    except (asyncio.CancelledError, Exception):
        pass


@pytest.mark.asyncio
async def test_ping_returns_pong(running_server):
    async with websockets.connect("ws://localhost:14445") as ws:
        await ws.recv()

        await ws.send(json.dumps({"action": "ping", "payload": {}}))
        raw    = await ws.recv()
        result = json.loads(raw)

        assert result["success"] is True
        assert result["data"]["pong"] is True


@pytest.mark.asyncio
async def test_unknown_action_returns_fail(running_server):
    async with websockets.connect("ws://localhost:14445") as ws:
        await ws.recv()

        await ws.send(json.dumps({"action": "nao_existe"}))
        raw    = await ws.recv()
        result = json.loads(raw)

        assert result["success"] is False
        assert "nao_existe" in result["error"]


@pytest.mark.asyncio
async def test_invalid_json_returns_error(running_server):
    async with websockets.connect("ws://localhost:14445") as ws:
        await ws.recv()

        await ws.send("isso nao eh json{{{")
        raw    = await ws.recv()
        result = json.loads(raw)

        assert result["success"] is False
