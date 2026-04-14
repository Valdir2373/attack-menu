import os
import socket
import pytest
from unittest.mock import patch, MagicMock

os.environ.setdefault("KEY_CRIP_DATA", "test-key")

from infra.service.DatabaseHealthChecker import (
    SupabaseHealthChecker, MongoHealthChecker, MySqlHealthChecker,
    PostgresHealthChecker, RedisHealthChecker, FirebaseHealthChecker,
    get_health_checker, DbStatus,
)



class TestSupabaseHealthChecker:
    def setup_method(self):
        self.checker = SupabaseHealthChecker()

    def test_bad_uri_format(self):
        diag = self.checker.diagnose("just-a-url-no-pipe")
        assert diag.status == DbStatus.BAD_CREDS

    def test_inactive_project_dns_fails(self):
        diag = self.checker.diagnose("https://nonexistent-project.supabase.co|eyJfake")
        assert diag.status == DbStatus.INACTIVE
        assert "pausado" in diag.message or "inatividade" in diag.message
        assert diag.can_reactivate is True

    def test_bad_credentials(self):
        diag = self.checker.diagnose(
            "https://woyzewbmfxefttghlvmx.supabase.co|invalid_key_here"
        )
        assert diag.status in (DbStatus.BAD_CREDS, DbStatus.ERROR)

    def test_healthy_project(self):
        key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndveXpld2JtZnhlZnR0Z2hsdm14Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4NDkyMTAsImV4cCI6MjA5MTQyNTIxMH0.Xho8mmEqW3vNkl2NNdwqHPdSl36RUJdIVQAEdMQ9lF8"
        diag = self.checker.diagnose(f"https://woyzewbmfxefttghlvmx.supabase.co|{key}")
        assert diag.status == DbStatus.HEALTHY

    def test_reactivate_gives_hint(self):
        diag = self.checker.reactivate("https://paused.supabase.co|key")
        assert "Restore project" in diag.message or "reativar" in diag.message.lower()



class TestMongoHealthChecker:
    def setup_method(self):
        self.checker = MongoHealthChecker()

    def test_healthy_local(self):
        diag = self.checker.diagnose(
            "mongodb://root:testpass123@localhost:17017/testdb?authSource=admin"
        )
        if diag.status == DbStatus.HEALTHY:
            assert "operacional" in diag.message
        else:
            assert diag.status in (DbStatus.UNREACHABLE, DbStatus.INACTIVE)

    def test_bad_credentials(self):
        diag = self.checker.diagnose(
            "mongodb://wrong:wrong@localhost:17017/testdb?authSource=admin"
        )
        assert diag.status in (DbStatus.BAD_CREDS, DbStatus.UNREACHABLE)

    def test_unreachable_server(self):
        diag = self.checker.diagnose("mongodb://localhost:19999/testdb")
        assert diag.status == DbStatus.UNREACHABLE

    def test_invalid_uri(self):
        diag = self.checker.diagnose("not-a-valid-uri")
        assert diag.status in (DbStatus.BAD_CREDS, DbStatus.ERROR, DbStatus.INACTIVE, DbStatus.UNREACHABLE)

    def test_dns_failure_atlas_paused(self):
        diag = self.checker.diagnose(
            "mongodb+srv://user:pass@nonexistent-cluster.mongodb.net/db"
        )
        assert diag.status in (DbStatus.INACTIVE, DbStatus.UNREACHABLE)

    def test_reactivate_gives_hint(self):
        diag = self.checker.reactivate("mongodb+srv://...")
        assert "Atlas" in diag.message or "cloud.mongodb.com" in diag.message



class TestMySqlHealthChecker:
    def setup_method(self):
        self.checker = MySqlHealthChecker()

    def test_healthy_local(self):
        diag = self.checker.diagnose("mysql://root:testpass123@localhost:13306/testdb")
        if diag.status == DbStatus.HEALTHY:
            assert "operacional" in diag.message
        else:
            assert diag.status == DbStatus.UNREACHABLE

    def test_bad_credentials(self):
        diag = self.checker.diagnose("mysql://root:wrongpass@localhost:13306/testdb")
        assert diag.status in (DbStatus.BAD_CREDS, DbStatus.UNREACHABLE)

    def test_unreachable_server(self):
        diag = self.checker.diagnose("mysql://root:pass@localhost:19999/testdb")
        assert diag.status == DbStatus.UNREACHABLE

    def test_reactivate_gives_hint(self):
        diag = self.checker.reactivate("mysql://...")
        assert "systemctl" in diag.message or "não suporta" in diag.message.lower()



class TestPostgresHealthChecker:
    def setup_method(self):
        self.checker = PostgresHealthChecker()

    def test_healthy_local(self):
        diag = self.checker.diagnose("postgresql://postgres:testpass123@localhost:15432/testdb")
        if diag.status == DbStatus.HEALTHY:
            assert "operacional" in diag.message
        else:
            assert diag.status == DbStatus.UNREACHABLE

    def test_bad_credentials(self):
        diag = self.checker.diagnose("postgresql://postgres:wrongpass@localhost:15432/testdb")
        assert diag.status in (DbStatus.BAD_CREDS, DbStatus.UNREACHABLE)

    def test_unreachable_server(self):
        diag = self.checker.diagnose("postgresql://postgres:pass@localhost:19999/testdb")
        assert diag.status == DbStatus.UNREACHABLE



class TestRedisHealthChecker:
    def setup_method(self):
        self.checker = RedisHealthChecker()

    def test_healthy_local(self):
        diag = self.checker.diagnose("redis://localhost:16379/0")
        if diag.status == DbStatus.HEALTHY:
            assert "operacional" in diag.message
        else:
            assert diag.status == DbStatus.UNREACHABLE

    def test_unreachable_server(self):
        diag = self.checker.diagnose("redis://localhost:19999/0")
        assert diag.status == DbStatus.UNREACHABLE

    def test_bad_password(self):
        diag = self.checker.diagnose("redis://:wrongpass@localhost:16379/0")
        assert diag.status in (DbStatus.HEALTHY, DbStatus.BAD_CREDS, DbStatus.UNREACHABLE)



class TestFirebaseHealthChecker:
    def setup_method(self):
        self.checker = FirebaseHealthChecker()

    def test_healthy_public_db(self):
        diag = self.checker.diagnose(
            "https://app-lembretes-55c7d-default-rtdb.firebaseio.com"
        )
        assert diag.status in (DbStatus.HEALTHY, DbStatus.UNREACHABLE)

    def test_permission_denied(self):
        diag = self.checker.diagnose(
            "https://among-us-irl-86233-default-rtdb.firebaseio.com"
        )
        assert diag.status in (DbStatus.BAD_CREDS, DbStatus.UNREACHABLE)

    def test_deleted_project(self):
        diag = self.checker.diagnose(
            "https://nonexistent-project-xyz.firebaseio.com"
        )
        assert diag.status in (DbStatus.INACTIVE, DbStatus.UNREACHABLE)

    def test_reactivate_gives_hint(self):
        diag = self.checker.reactivate("https://x.firebaseio.com")
        assert "console.firebase.google.com" in diag.message



class TestGetHealthChecker:

    def test_all_dbs_have_checker(self):
        for db in ["MongoDB", "MySQL", "PostgreSQL", "Redis", "Firebase", "Supabase"]:
            checker = get_health_checker(db)
            assert checker is not None

    def test_unknown_db_raises(self):
        with pytest.raises(ValueError, match="não disponível"):
            get_health_checker("Oracle")

    def test_checker_returns_diagnostic(self):
        checker = get_health_checker("Redis")
        diag = checker.diagnose("redis://localhost:19999/0")
        assert diag.status is not None
        assert diag.message is not None
        assert isinstance(diag.message, str)
        assert len(diag.message) > 0
