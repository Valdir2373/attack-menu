from typing import Callable, Awaitable, Dict, Any
from application.client.dto.CommandInputDto import CommandInputDTO
from application.client.dto.CommandOutputDto import CommandOutputDTO


Handler = Callable[[Dict[str, Any]], Awaitable[CommandOutputDTO]]


class DispatchCommandUseCase:

    def __init__(self) -> None:
        self._handlers: Dict[str, Handler] = {}

    def register(self, action: str, handler: Handler) -> None:
        self._handlers[action] = handler

    async def execute(self, command: CommandInputDTO) -> CommandOutputDTO:
        handler = self._handlers.get(command.action)

        if handler is None:
            return CommandOutputDTO.fail(f"Ação desconhecida: '{command.action}'")

        try:
            return await handler(command.payload)
        except Exception as exc:
            return CommandOutputDTO.fail(f"Erro interno ao executar '{command.action}': {exc}")
