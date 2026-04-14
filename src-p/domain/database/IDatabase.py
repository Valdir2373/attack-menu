from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional


class IDatabase(ABC):

    @abstractmethod
    async def get(self, collection: str, key: str) -> Optional[Dict[str, Any]]:
        ...

    @abstractmethod
    async def get_all(self, collection: str) -> List[Dict[str, Any]]:
        ...

    @abstractmethod
    async def set(self, collection: str, key: str, value: Dict[str, Any]) -> None:
        ...

    @abstractmethod
    async def delete(self, collection: str, key: str) -> bool:
        ...

    @abstractmethod
    async def exists(self, collection: str, key: str) -> bool:
        ...
