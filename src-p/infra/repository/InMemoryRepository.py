from typing import Any, Generic, List, Optional, TypeVar
from domain.entities.BaseEntity import BaseEntity
from domain.repository.IRepository import IRepository
from domain.database.IDatabase import IDatabase
from infra.utils.Serializer import Serializer

T = TypeVar("T", bound=BaseEntity)


class InMemoryRepository(IRepository[T], Generic[T]):

    def __init__(self, db: IDatabase, collection: str, factory: Any = None) -> None:
        self._db         = db
        self._collection = collection
        self._factory    = factory

    async def find_by_id(self, entity_id: str) -> Optional[T]:
        data = await self._db.get(self._collection, entity_id)
        if data is None:
            return None
        return self._factory(data) if self._factory else data  # type: ignore[return-value]

    async def find_all(self) -> List[T]:
        rows = await self._db.get_all(self._collection)
        if self._factory:
            return [self._factory(row) for row in rows]
        return rows  # type: ignore[return-value]

    async def save(self, entity: T) -> T:
        data = Serializer.to_dict(entity)
        await self._db.set(self._collection, entity.id, data)
        return entity

    async def delete(self, entity_id: str) -> bool:
        return await self._db.delete(self._collection, entity_id)
