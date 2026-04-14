from abc import ABC, abstractmethod
from typing import Any


class IWsHandler(ABC):

    @abstractmethod
    async def on_connect(self, client_id: str, websocket: Any) -> None:
        ...

    @abstractmethod
    async def on_message(self, client_id: str, message: str, websocket: Any) -> None:
        ...

    @abstractmethod
    async def on_disconnect(self, client_id: str) -> None:
        ...
