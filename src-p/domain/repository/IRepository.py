from abc import ABC, abstractmethod
from typing import Generic, TypeVar, Optional, List

T = TypeVar("T")


class IRepository(ABC, Generic[T]):

    @abstractmethod
    async def find_by_id(self, entity_id: str) -> Optional[T]:
        ...

    @abstractmethod
    async def find_all(self) -> List[T]:
        ...

    @abstractmethod
    async def save(self, entity: T) -> T:
        ...

    @abstractmethod
    async def delete(self, entity_id: str) -> bool:
        ...
