import os
import json
import hashlib
import pytest
from unittest.mock import patch

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

_NONCE_LEN = 12
_TAG_LEN   = 16


@pytest.fixture(autouse=True)
def set_key_env(monkeypatch):
    monkeypatch.setenv("KEY_CRIP_DATA", "test-secret-key-for-testing-2026")


@pytest.fixture
def engine():
    from infra.service.RansomCripEngine import RansomCripEngine
    return RansomCripEngine()


@pytest.fixture
def decrypt_fn():
    key_bytes = hashlib.sha256(b"test-secret-key-for-testing-2026").digest()
    aesgcm = AESGCM(key_bytes)

    def decrypt(cipherblob: bytes) -> bytes:
        nonce = cipherblob[:_NONCE_LEN]
        ct_and_tag = cipherblob[_NONCE_LEN:]
        return aesgcm.decrypt(nonce, ct_and_tag, None)

    return decrypt


class TestRansomCripEngine:

    def test_encrypt_single_string(self, engine, decrypt_fn):
        results = []
        engine.execute(lambda enc: results.append(enc), ["hello world"])

        assert len(results) == 1
        decrypted = decrypt_fn(results[0])
        assert decrypted == b"hello world"

    def test_encrypt_multiple_items(self, engine, decrypt_fn):
        results = []
        data = ["item1", "item2", "item3", "item4", "item5"]
        engine.execute(lambda enc: results.append(enc), data)

        assert len(results) == 5
        for i, blob in enumerate(results):
            assert decrypt_fn(blob) == f"item{i+1}".encode("utf-8")

    def test_encrypt_bytes_passthrough(self, engine, decrypt_fn):
        raw = b"\x00\x01\x02\xff\xfe\xfd"
        results = []
        engine.execute(lambda enc: results.append(enc), [raw])

        assert decrypt_fn(results[0]) == raw

    def test_encrypt_dict_as_json(self, engine, decrypt_fn):
        data = {"username": "alice", "role": "admin", "score": 42}
        results = []
        engine.execute(lambda enc: results.append(enc), [data])

        decrypted = decrypt_fn(results[0])
        parsed = json.loads(decrypted)
        assert parsed == data

    def test_unique_nonce_per_item(self, engine):
        results = []
        engine.execute(lambda enc: results.append(enc), ["a", "b", "c", "d"])

        nonces = [blob[:_NONCE_LEN] for blob in results]
        assert len(set(nonces)) == 4, "Nonces devem ser únicos"

    def test_output_format(self, engine):
        results = []
        engine.execute(lambda enc: results.append(enc), ["test"])

        blob = results[0]
        assert len(blob) >= _NONCE_LEN + 1 + _TAG_LEN

    def test_deterministic_key_derivation(self, engine, decrypt_fn):
        results = []
        engine.execute(lambda enc: results.append(enc), ["deterministic"])

        assert decrypt_fn(results[0]) == b"deterministic"

    def test_tampered_ciphertext_detected(self, engine):
        results = []
        engine.execute(lambda enc: results.append(enc), ["secret"])

        blob = bytearray(results[0])
        blob[_NONCE_LEN + 2] ^= 0xFF
        tampered = bytes(blob)

        key_bytes = hashlib.sha256(b"test-secret-key-for-testing-2026").digest()
        aesgcm = AESGCM(key_bytes)

        with pytest.raises(Exception):
            aesgcm.decrypt(tampered[:_NONCE_LEN], tampered[_NONCE_LEN:], None)

    def test_empty_list_no_writes(self, engine):
        results = []
        engine.execute(lambda enc: results.append(enc), [])
        assert results == []

    def test_large_data_encryption(self, engine, decrypt_fn):
        big = "A" * (1024 * 1024)
        results = []
        engine.execute(lambda enc: results.append(enc), [big])

        assert len(results) == 1
        decrypted = decrypt_fn(results[0])
        assert decrypted == big.encode("utf-8")
        assert len(decrypted) == 1024 * 1024

    def test_unicode_preservation(self, engine, decrypt_fn):
        data = "こんにちは世界 🔒 données chiffrées"
        results = []
        engine.execute(lambda enc: results.append(enc), [data])

        assert decrypt_fn(results[0]).decode("utf-8") == data

    def test_1000_items_performance(self, engine, decrypt_fn):
        results = []
        data = [f"record_{i}" for i in range(1000)]
        engine.execute(lambda enc: results.append(enc), data)

        assert len(results) == 1000
        assert decrypt_fn(results[0]) == b"record_0"
        assert decrypt_fn(results[999]) == b"record_999"

    def test_missing_key_raises(self, monkeypatch):
        monkeypatch.delenv("KEY_CRIP_DATA", raising=False)
        monkeypatch.setenv("KEY_CRIP_DATA", "")

        from importlib import reload
        import infra.service.RansomCripEngine as mod

        with pytest.raises(EnvironmentError, match="KEY_CRIP_DATA"):
            reload(mod)
            mod.RansomCripEngine()
