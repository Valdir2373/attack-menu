from typing import Any, Dict
from infra.interfaces.IController import IController
from infra.utils.Logger import Logger
from application.client.dto.CommandOutputDto import CommandOutputDTO


class BaseController(IController):

    def __init__(self, logger: Logger) -> None:
        self._logger = logger

    def get_actions(self) -> Dict[str, Any]:
        return {}

    def _ok(self, data: Any = None, event: str | None = None) -> CommandOutputDTO:
        return CommandOutputDTO.ok(data=data, event=event)

    def _fail(self, error: str, event: str | None = None) -> CommandOutputDTO:
        self._logger.warn(f"Resposta de erro: {error}")
        return CommandOutputDTO.fail(error=error, event=event)

    def _event(self, event: str, data: Any = None) -> CommandOutputDTO:
        return CommandOutputDTO.push_event(event=event, data=data)
