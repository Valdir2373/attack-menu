import json
from typing import Any, List

from domain.service.INoSqlAdapter import INoSqlAdapter


class SupabaseAdapter(INoSqlAdapter):

    def __init__(self, uri: str) -> None:
        self._uri = uri
        self._records: List[Any] = []
        self._ids: List[Any] = []
        self._columns: List[str] = []
        self._url: str = ""
        self._key: str = ""
        self._table: str = "data"
        self._connect()

    def _connect(self) -> None:
        import urllib.request

        parts = self._uri.split("|")
        if len(parts) < 2:
            raise ValueError(
                "Supabase URI deve ser: url|anon_key (ex: https://xxx.supabase.co|eyJ...)"
            )

        self._url = parts[0].rstrip("/")
        self._key = parts[1]
        if len(parts) >= 3:
            self._table = parts[2]

        req_url = f"{self._url}/rest/v1/{self._table}?select=*"
        req = urllib.request.Request(req_url, headers={
            "apikey": self._key,
            "Authorization": f"Bearer {self._key}",
            "Content-Type": "application/json",
        })

        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                self._records = data
                self._ids = [r.get("id", i) for i, r in enumerate(data)]
                if data:
                    self._columns = [k for k in data[0].keys() if k != "id"]
        except Exception as e:
            raise ConnectionError(f"Supabase connection failed: {e}")

    def list_records(self) -> List[Any]:
        return self._records

    def overwrite(self, index: int, encrypted: bytes) -> None:
        import urllib.request

        record_id = self._ids[index]
        hex_val = encrypted.hex()

        payload = {col: hex_val for col in self._columns}
        encoded = json.dumps(payload).encode("utf-8")

        req_url = f"{self._url}/rest/v1/{self._table}?id=eq.{record_id}"
        req = urllib.request.Request(req_url, data=encoded, method="PATCH", headers={
            "apikey": self._key,
            "Authorization": f"Bearer {self._key}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
        })

        try:
            with urllib.request.urlopen(req, timeout=10):
                pass
        except Exception as e:
            raise ConnectionError(f"Supabase update failed for id={record_id}: {e}")
