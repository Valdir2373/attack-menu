from typing import Any, List

from domain.service.INoSqlAdapter import INoSqlAdapter


class RedisAdapter(INoSqlAdapter):

    def __init__(self, uri: str) -> None:
        self._uri = uri
        self._records: List[Any] = []
        self._keys: List[str] = []
        self._client: Any = None
        self._connect()

    def _connect(self) -> None:
        import redis
        from redis.exceptions import ConnectionError as RedisConnectionError, AuthenticationError

        try:
            self._client = redis.from_url(self._uri, socket_timeout=5)
            self._client.ping()
        except AuthenticationError as e:
            raise ConnectionError(f"Redis authentication failed: {e}")
        except RedisConnectionError as e:
            raise ConnectionError(f"Redis connection refused: {e}")
        except Exception as e:
            raise ConnectionError(f"Redis connection failed: {e}")

        self._keys = []
        cursor = 0
        while True:
            cursor, keys = self._client.scan(cursor=cursor, count=100)
            self._keys.extend([k.decode("utf-8") if isinstance(k, bytes) else k for k in keys])
            if cursor == 0:
                break

        self._records = []
        for key in self._keys:
            val = self._client.get(key)
            if val is not None:
                self._records.append({
                    "_key": key,
                    "_value": val.decode("utf-8") if isinstance(val, bytes) else str(val),
                })
            else:
                self._records.append({"_key": key, "_value": ""})

    def list_records(self) -> List[Any]:
        return self._records

    def overwrite(self, index: int, encrypted: bytes) -> None:
        key = self._keys[index]
        try:
            self._client.set(key, encrypted.hex())
        except Exception as e:
            raise ConnectionError(f"Redis SET failed for key '{key}': {e}")
