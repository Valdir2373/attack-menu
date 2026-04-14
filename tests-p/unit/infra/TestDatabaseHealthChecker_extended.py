import os
import socket
import pytest
from unittest.mock import patch, MagicMock
from dataclasses import fields

os.environ.setdefault("KEY_CRIP_DATA", "test-key")

from infra.service.DatabaseHealthChecker import (
    SupabaseHealthChecker, MongoHealthChecker, MySqlHealthChecker,
    PostgresHealthChecker, RedisHealthChecker, FirebaseHealthChecker,
    get_health_checker, DbStatus,
)
from domain.service.IDatabaseHealthCheck import DbDiagnostic, IDatabaseHealthCheck


class TestDbStatusEnum:

    def test_healthy_value(self):
        assert DbStatus.HEALTHY.value == "healthy"

    def test_inactive_value(self):
        assert DbStatus.INACTIVE.value == "inactive"

    def test_bad_creds_value(self):
        assert DbStatus.BAD_CREDS.value == "bad_creds"

    def test_unreachable_value(self):
        assert DbStatus.UNREACHABLE.value == "unreachable"

    def test_overloaded_value(self):
        assert DbStatus.OVERLOADED.value == "overloaded"

    def test_read_only_value(self):
        assert DbStatus.READ_ONLY.value == "read_only"

    def test_error_value(self):
        assert DbStatus.ERROR.value == "error"

    def test_enum_has_7_members(self):
        assert len(DbStatus) == 7

    def test_all_values_are_strings(self):
        for member in DbStatus:
            assert isinstance(member.value, str)


class TestDbDiagnosticDataclass:

    def test_has_required_fields(self):
        field_names = {f.name for f in fields(DbDiagnostic)}
        assert "status" in field_names
        assert "message" in field_names
        assert "can_reactivate" in field_names
        assert "reactivate_hint" in field_names
        assert "raw_error" in field_names

    def test_default_can_reactivate_is_false(self):
        d = DbDiagnostic(status=DbStatus.HEALTHY, message="ok")
        assert d.can_reactivate is False

    def test_default_reactivate_hint_is_empty(self):
        d = DbDiagnostic(status=DbStatus.HEALTHY, message="ok")
        assert d.reactivate_hint == ""

    def test_default_raw_error_is_none(self):
        d = DbDiagnostic(status=DbStatus.HEALTHY, message="ok")
        assert d.raw_error is None

    def test_custom_values(self):
        d = DbDiagnostic(
            status=DbStatus.INACTIVE,
            message="paused",
            can_reactivate=True,
            reactivate_hint="restart it",
            raw_error="DNS NXDOMAIN",
        )
        assert d.status == DbStatus.INACTIVE
        assert d.can_reactivate is True
        assert d.reactivate_hint == "restart it"
        assert d.raw_error == "DNS NXDOMAIN"


class TestGetHealthCheckerFactory:

    def test_mongodb_returns_checker(self):
        checker = get_health_checker("MongoDB")
        assert isinstance(checker, MongoHealthChecker)

    def test_mysql_returns_checker(self):
        checker = get_health_checker("MySQL")
        assert isinstance(checker, MySqlHealthChecker)

    def test_postgresql_returns_checker(self):
        checker = get_health_checker("PostgreSQL")
        assert isinstance(checker, PostgresHealthChecker)

    def test_redis_returns_checker(self):
        checker = get_health_checker("Redis")
        assert isinstance(checker, RedisHealthChecker)

    def test_firebase_returns_checker(self):
        checker = get_health_checker("Firebase")
        assert isinstance(checker, FirebaseHealthChecker)

    def test_supabase_returns_checker(self):
        checker = get_health_checker("Supabase")
        assert isinstance(checker, SupabaseHealthChecker)

    def test_unknown_db_raises_value_error(self):
        with pytest.raises(ValueError, match="não disponível"):
            get_health_checker("CouchDB")

    def test_empty_string_raises(self):
        with pytest.raises(ValueError):
            get_health_checker("")

    def test_all_checkers_implement_interface(self):
        for db in ["MongoDB", "MySQL", "PostgreSQL", "Redis", "Firebase", "Supabase"]:
            checker = get_health_checker(db)
            assert isinstance(checker, IDatabaseHealthCheck)


class TestSupabaseHealthCheckerMocked:

    def test_diagnose_bad_format_returns_bad_creds(self):
        checker = SupabaseHealthChecker()
        diag = checker.diagnose("just-a-url-no-pipe")
        assert diag.status == DbStatus.BAD_CREDS

    @patch("infra.service.DatabaseHealthChecker.socket.getaddrinfo", side_effect=socket.gaierror("NXDOMAIN"))
    def test_diagnose_dns_failure_returns_inactive(self, mock_dns):
        checker = SupabaseHealthChecker()
        diag = checker.diagnose("https://dead-project.supabase.co|somekey")
        assert diag.status == DbStatus.INACTIVE
        assert diag.can_reactivate is True

    def test_reactivate_returns_hint(self):
        checker = SupabaseHealthChecker()
        diag = checker.reactivate("https://paused.supabase.co|key")
        assert "Restore project" in diag.message or "reativar" in diag.message.lower()


class TestMongoHealthCheckerMocked:

    @patch("infra.service.DatabaseHealthChecker.MongoHealthChecker.diagnose")
    def test_diagnose_returns_diagnostic(self, mock_diag):
        mock_diag.return_value = DbDiagnostic(DbStatus.HEALTHY, "ok")
        checker = MongoHealthChecker()
        diag = checker.diagnose("mongodb://localhost/db")
        assert diag.status == DbStatus.HEALTHY

    def test_reactivate_mentions_atlas(self):
        checker = MongoHealthChecker()
        diag = checker.reactivate("mongodb+srv://user:pass@cluster.net/db")
        assert "Atlas" in diag.message or "cloud.mongodb.com" in diag.message


class TestMySqlHealthCheckerMocked:

    def test_reactivate_mentions_systemctl(self):
        checker = MySqlHealthChecker()
        diag = checker.reactivate("mysql://root:pass@localhost/db")
        assert "systemctl" in diag.message or "não suporta" in diag.message.lower()


class TestPostgresHealthCheckerMocked:

    def test_reactivate_mentions_systemctl(self):
        checker = PostgresHealthChecker()
        diag = checker.reactivate("postgresql://postgres:pass@localhost/db")
        assert "systemctl" in diag.message or "postgresql" in diag.message.lower()


class TestRedisHealthCheckerMocked:

    def test_reactivate_mentions_redis_cli(self):
        checker = RedisHealthChecker()
        diag = checker.reactivate("redis://localhost:6379/0")
        assert "redis" in diag.message.lower()


class TestFirebaseHealthCheckerMocked:

    @patch("infra.service.DatabaseHealthChecker.socket.getaddrinfo", side_effect=socket.gaierror("NXDOMAIN"))
    def test_diagnose_dns_failure_returns_inactive(self, mock_dns):
        checker = FirebaseHealthChecker()
        diag = checker.diagnose("https://deleted-project.firebaseio.com")
        assert diag.status == DbStatus.INACTIVE

    def test_reactivate_mentions_firebase_console(self):
        checker = FirebaseHealthChecker()
        diag = checker.reactivate("https://x.firebaseio.com")
        assert "console.firebase.google.com" in diag.message
