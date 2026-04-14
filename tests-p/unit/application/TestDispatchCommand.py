import pytest
from application.client.dto.CommandInputDto import CommandInputDTO
from application.client.dto.CommandOutputDto import CommandOutputDTO
from application.client.use_cases.DispatchCommand import DispatchCommandUseCase


@pytest.fixture
def dispatcher() -> DispatchCommandUseCase:
    d = DispatchCommandUseCase()

    async def ping_handler(payload):
        return CommandOutputDTO.ok(data={"pong": True})

    async def fail_handler(payload):
        return CommandOutputDTO.fail("propositalmente falhou")

    d.register("ping", ping_handler)
    d.register("fail", fail_handler)
    return d


class TestDispatchCommandUseCase:
    @pytest.mark.asyncio
    async def test_dispatches_known_action(self, dispatcher):
        cmd    = CommandInputDTO(action="ping")
        result = await dispatcher.execute(cmd)
        assert result.success is True
        assert result.data == {"pong": True}

    @pytest.mark.asyncio
    async def test_returns_fail_for_unknown_action(self, dispatcher):
        cmd    = CommandInputDTO(action="inexistente")
        result = await dispatcher.execute(cmd)
        assert result.success is False
        assert "inexistente" in result.error

    @pytest.mark.asyncio
    async def test_propagates_handler_fail(self, dispatcher):
        cmd    = CommandInputDTO(action="fail")
        result = await dispatcher.execute(cmd)
        assert result.success is False

    @pytest.mark.asyncio
    async def test_handler_exception_is_caught(self, dispatcher):
        async def boom(payload):
            raise ValueError("kaboom")

        dispatcher.register("boom", boom)
        cmd    = CommandInputDTO(action="boom")
        result = await dispatcher.execute(cmd)
        assert result.success is False
        assert "kaboom" in result.error
