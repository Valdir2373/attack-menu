from typing import Any, Dict, List, Optional
from domain.database.IDatabase import IDatabase


class InMemoryDatabase(IDatabase):

    def __init__(self) -> None:
        self._store: Dict[str, Dict[str, Dict[str, Any]]] = {}

    def _ensure_collection(self, collection: str) -> None:
        if collection not in self._store:
            self._store[collection] = {}

    async def get(self, collection: str, key: str) -> Optional[Dict[str, Any]]:
        self._ensure_collection(collection)
        return self._store[collection].get(key)

    async def get_all(self, collection: str) -> List[Dict[str, Any]]:
        self._ensure_collection(collection)
        return list(self._store[collection].values())

    async def set(self, collection: str, key: str, value: Dict[str, Any]) -> None:
        self._ensure_collection(collection)
        self._store[collection][key] = value

    async def delete(self, collection: str, key: str) -> bool:
        self._ensure_collection(collection)
        if key in self._store[collection]:
            del self._store[collection][key]
            return True
        return False

    async def exists(self, collection: str, key: str) -> bool:
        self._ensure_collection(collection)
        return key in self._store[collection]
