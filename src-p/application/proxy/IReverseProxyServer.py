from abc import ABC, abstractmethod
from typing import Callable, Optional


class IReverseProxyServer(ABC):
    @abstractmethod
    async def start(self, target_url: str, port: int) -> None:
        ...

    @abstractmethod
    async def stop(self) -> None:
        ...
