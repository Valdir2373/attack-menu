import os
import pytest


MONGO_URI = os.getenv(
    "MONGO_TEST_URI",
    "mongodb://root:testpass123@localhost:17017/testdb?authSource=admin"
)


def _can_connect_mongo() -> bool:
    try:
        from pymongo import MongoClient
        c = MongoClient(MONGO_URI, serverSelectionTimeoutMS=2000)
        c.admin.command("ping")
        c.close()
        return True
    except Exception:
        return False


skip_no_mongo = pytest.mark.skipif(
    not _can_connect_mongo(),
    reason="MongoDB não disponível em localhost:17017"
)


@skip_no_mongo
class TestMongoAdapter:

    @pytest.fixture(autouse=True)
    def seed_data(self):
        from pymongo import MongoClient
        c = MongoClient(MONGO_URI)
        db = c.get_default_database()
        col = db["data"]
        col.drop()
        col.insert_many([
            {"username": "alice", "password_hash": "5f4dcc3b"},
            {"username": "bob",   "password_hash": "e10adc39"},
            {"username": "carol", "password_hash": "25f9e794"},
        ])
        yield
        col.drop()
        c.close()

    @pytest.fixture
    def adapter(self):
        from infra.adapters.nosql.MongoAdapter import MongoAdapter
        return MongoAdapter(MONGO_URI)

    def test_stores_uri(self, adapter):
        assert "testdb" in adapter._uri

    def test_list_records_returns_data(self, adapter):
        records = adapter.list_records()
        assert len(records) == 3

    def test_record_has_username(self, adapter):
        records = adapter.list_records()
        usernames = [r["username"] for r in records]
        assert "alice" in usernames
        assert "bob" in usernames
        assert "carol" in usernames

    def test_record_has_password_hash(self, adapter):
        for r in adapter.list_records():
            assert "password_hash" in r

    def test_record_has_id(self, adapter):
        for r in adapter.list_records():
            assert "_id" in r

    def test_overwrite_writes_to_db(self, adapter):
        adapter.overwrite(0, b"\x00\x01\x02")
        from pymongo import MongoClient
        c = MongoClient(MONGO_URI)
        doc = c.get_default_database()["data"].find_one({"_id": adapter._ids[0]})
        assert doc["_ransomed"] is True
        assert "_encrypted" in doc
        c.close()

    def test_ids_match_records(self, adapter):
        assert len(adapter._ids) == len(adapter._records)

    def test_list_records_returns_list(self, adapter):
        assert isinstance(adapter.list_records(), list)

    def test_invalid_uri_raises(self):
        from infra.adapters.nosql.MongoAdapter import MongoAdapter
        with pytest.raises(Exception):
            MongoAdapter("mongodb://nonexistent:27017/db")
