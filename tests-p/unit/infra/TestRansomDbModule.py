import os
import tempfile
import pytest

os.environ.setdefault("KEY_CRIP_DATA", "test-key-ransomdb-module")

from infra.modules.RansomDbModule import RansomDbModule
from application.client.dto.CommandOutputDto import CommandOutputDTO


@pytest.fixture
def module():
    broadcast_log = []

    def broadcast(dto):
        broadcast_log.append(dto)

    m = RansomDbModule(broadcast)
    m._broadcast_log = broadcast_log
    return m


class TestResolveUris:

    def test_single_mode_returns_uri(self, module):
        uris = module._resolve_uris("single", {"uri": "mongodb://host/db"})
        assert uris == ["mongodb://host/db"]

    def test_single_mode_strips_whitespace(self, module):
        uris = module._resolve_uris("single", {"uri": "  mongodb://host/db  "})
        assert uris == ["mongodb://host/db"]

    def test_single_mode_empty_uri_raises(self, module):
        with pytest.raises(ValueError, match="uri é obrigatória"):
            module._resolve_uris("single", {"uri": ""})

    def test_single_mode_missing_uri_raises(self, module):
        with pytest.raises(ValueError, match="uri é obrigatória"):
            module._resolve_uris("single", {})

    def test_file_mode_reads_lines(self, module):
        with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False) as f:
            f.write("# comentário\n")
            f.write("mongodb://host1/db1\n")
            f.write("\n")
            f.write("mongodb://host2/db2\n")
            f.write("# outro comentário\n")
            f.write("mongodb://host3/db3\n")
            path = f.name

        try:
            uris = module._resolve_uris("file", {"file_path": path})
            assert len(uris) == 3
            assert uris[0] == "mongodb://host1/db1"
            assert uris[2] == "mongodb://host3/db3"
        finally:
            os.unlink(path)

    def test_file_mode_missing_path_raises(self, module):
        with pytest.raises(ValueError, match="file_path é obrigatório"):
            module._resolve_uris("file", {})

    def test_file_not_found_raises(self, module):
        with pytest.raises(FileNotFoundError):
            module._resolve_uris("file", {"file_path": "/nonexistent/file.txt"})

    def test_invalid_mode_raises(self, module):
        with pytest.raises(ValueError, match="mode inválido"):
            module._resolve_uris("invalid", {})


class TestMask:

    def test_short_uri_unchanged(self, module):
        assert module._mask("mongodb://x") == "mongodb://x"

    def test_long_uri_truncated(self, module):
        uri = "mongodb+srv://user:longpassword@cluster.mongodb.net/database"
        masked = module._mask(uri)
        assert masked.endswith("...")
        assert len(masked) == 27


class TestToSqlUri:

    def test_pipe_separated_mysql(self, module):
        result = module._to_sql_uri("MySQL", "localhost|3306|root|pass123|mydb")
        assert result == "mysql://root:pass123@localhost:3306/mydb"

    def test_pipe_separated_postgresql(self, module):
        result = module._to_sql_uri("PostgreSQL", "db.host.com|5432|pguser|pgpass|warehouse")
        assert result == "postgresql://pguser:pgpass@db.host.com:5432/warehouse"

    def test_full_uri_passthrough(self, module):
        uri = "mysql://root:pass@localhost:3306/mydb"
        assert module._to_sql_uri("MySQL", uri) == uri

    def test_invalid_pipe_format_raises(self, module):
        with pytest.raises(ValueError, match="Formato inválido"):
            module._to_sql_uri("MySQL", "host|port|user")


class TestGenerateExample:

    def test_generates_mongodb_example(self, module):
        with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False) as f:
            path = f.name

        try:
            result = module._generate_example("MongoDB", path)
            assert result.success is True

            with open(path, "r") as f:
                content = f.read()
            assert "mongodb://" in content
        finally:
            os.unlink(path)

    def test_generates_mysql_example(self, module):
        with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False) as f:
            path = f.name

        try:
            result = module._generate_example("MySQL", path)
            assert result.success is True

            with open(path, "r") as f:
                content = f.read()
            assert "host|porta|usuario|senha|banco" in content.lower() or "|" in content
        finally:
            os.unlink(path)

    def test_generates_all_db_examples(self, module):
        dbs = ["MongoDB", "Firebase", "Supabase", "Redis", "MySQL", "PostgreSQL"]
        for db in dbs:
            with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False) as f:
                path = f.name
            try:
                result = module._generate_example(db, path)
                assert result.success is True, f"Falhou para {db}"
            finally:
                os.unlink(path)

    def test_invalid_path_fails(self, module):
        result = module._generate_example("MongoDB", "/nonexistent/dir/file.txt")
        assert result.success is False


class TestHandleRansomDb:

    @pytest.mark.asyncio
    async def test_rejects_unsupported_db(self, module):
        result = await module._handle_ransom_db({"db": "Oracle", "mode": "single"})
        assert result.success is False
        assert "Oracle" in result.error

    @pytest.mark.asyncio
    async def test_rejects_empty_db(self, module):
        result = await module._handle_ransom_db({"db": "", "mode": "single"})
        assert result.success is False

    @pytest.mark.asyncio
    async def test_example_mode_works(self, module):
        with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False) as f:
            path = f.name

        try:
            result = await module._handle_ransom_db({
                "db": "MongoDB",
                "mode": "example",
                "output_path": path,
            })
            assert result.success is True
        finally:
            os.unlink(path)

    @pytest.mark.asyncio
    async def test_single_mode_empty_uri_fails(self, module):
        result = await module._handle_ransom_db({
            "db": "MongoDB",
            "mode": "single",
            "uri": "",
        })
        assert result.success is False

    @pytest.mark.asyncio
    async def test_file_mode_nonexistent_file_fails(self, module):
        result = await module._handle_ransom_db({
            "db": "MongoDB",
            "mode": "file",
            "file_path": "/tmp/nonexistent_file_xyz.txt",
        })
        assert result.success is False
