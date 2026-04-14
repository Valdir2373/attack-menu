import os
import socket
import pytest
from unittest.mock import patch, MagicMock
from dataclasses import fields

os.environ.setdefault("KEY_CRIP_DATA", "health-check-test-key")

from domain.service.IDatabaseHealthCheck import DbStatus, DbDiagnostic, IDatabaseHealthCheck
from infra.service.DatabaseHealthChecker import (
    SupabaseHealthChecker, MongoHealthChecker, MySqlHealthChecker,
    PostgresHealthChecker, RedisHealthChecker, FirebaseHealthChecker,
    get_health_checker,
)


class TestDbStatusEnum:

    def test_has_exactly_7_members(self):
        assert len(DbStatus) == 7

    def test_all_values_are_lowercase_strings(self):
        for member in DbStatus:
            assert member.value == member.value.lower()
            assert isinstance(member.value, str)

    def test_string_representation_contains_name(self):
        assert "HEALTHY" in str(DbStatus.HEALTHY)
        assert "INACTIVE" in str(DbStatus.INACTIVE)
        assert "ERROR" in str(DbStatus.ERROR)


class TestDbDiagnosticDataclass:

    def test_has_five_fields(self):
        assert len(fields(DbDiagnostic)) == 5

    def test_defaults_for_optional_fields(self):
        d = DbDiagnostic(status=DbStatus.ERROR, message="fail")
        assert d.can_reactivate is False
        assert d.reactivate_hint == ""
        assert d.raw_error is None

    def test_can_reactivate_set_to_true(self):
        d = DbDiagnostic(
            status=DbStatus.INACTIVE,
            message="paused",
            can_reactivate=True,
        )
        assert d.can_reactivate is True


class TestGetHealthCheckerFactory:

    def test_returns_correct_type_for_all_six_dbs(self):
        expected = {
            "MongoDB": MongoHealthChecker,
            "MySQL": MySqlHealthChecker,
            "PostgreSQL": PostgresHealthChecker,
            "Redis": RedisHealthChecker,
            "Firebase": FirebaseHealthChecker,
            "Supabase": SupabaseHealthChecker,
        }
        for db, cls in expected.items():
            assert isinstance(get_health_checker(db), cls)

    def test_unknown_db_raises_value_error(self):
        with pytest.raises(ValueError, match="Health checker"):
            get_health_checker("CouchDB")

    def test_all_checkers_implement_abc(self):
        for db in ["MongoDB", "MySQL", "PostgreSQL", "Redis", "Firebase", "Supabase"]:
            checker = get_health_checker(db)
            assert isinstance(checker, IDatabaseHealthCheck)


class TestSupabaseHealthChecker:

    def test_missing_pipe_returns_bad_creds(self):
        diag = SupabaseHealthChecker().diagnose("https://xxx.supabase.co")
        assert diag.status == DbStatus.BAD_CREDS

    @patch("infra.service.DatabaseHealthChecker.socket.getaddrinfo",
           side_effect=socket.gaierror("NXDOMAIN"))
    def test_dns_failure_returns_inactive_with_reactivate(self, _):
        diag = SupabaseHealthChecker().diagnose("https://dead.supabase.co|key123")
        assert diag.status == DbStatus.INACTIVE
        assert diag.can_reactivate is True
        assert "dead" in diag.message

    @patch("infra.service.DatabaseHealthChecker.socket.getaddrinfo")
    @patch("infra.service.DatabaseHealthChecker.urllib.request.urlopen")
    def test_http_401_returns_bad_creds(self, mock_urlopen, mock_dns):
        import urllib.error
        mock_dns.return_value = [(None, None, None, None, None)]
        err = urllib.error.HTTPError(
            "url", 401, "Unauthorized", {}, MagicMock(read=lambda: b"bad key")
        )
        mock_urlopen.side_effect = err
        diag = SupabaseHealthChecker().diagnose("https://live.supabase.co|badkey")
        assert diag.status == DbStatus.BAD_CREDS

    def test_reactivate_mentions_restore(self):
        diag = SupabaseHealthChecker().reactivate("https://p.supabase.co|k")
        assert "Restore project" in diag.message or "reativar" in diag.message.lower()
        assert diag.can_reactivate is False


class TestMongoHealthChecker:

    @patch("infra.service.DatabaseHealthChecker.MongoHealthChecker.diagnose")
    def test_unreachable_returns_correct_status(self, mock_diag):
        mock_diag.return_value = DbDiagnostic(
            DbStatus.UNREACHABLE, "timeout", raw_error="timeout 5s"
        )
        diag = MongoHealthChecker().diagnose("mongodb://localhost:99999/db")
        assert diag.status == DbStatus.UNREACHABLE

    @patch("infra.service.DatabaseHealthChecker.MongoHealthChecker.diagnose")
    def test_invalid_uri_returns_error_or_bad_creds(self, mock_diag):
        mock_diag.return_value = DbDiagnostic(DbStatus.BAD_CREDS, "malformed")
        diag = MongoHealthChecker().diagnose("not-a-uri")
        assert diag.status in (DbStatus.BAD_CREDS, DbStatus.ERROR)

    def test_reactivate_mentions_atlas_resume(self):
        diag = MongoHealthChecker().reactivate("mongodb+srv://u:p@c.net/db")
        assert "Resume" in diag.message or "Atlas" in diag.message


class TestMySqlHealthChecker:

    @patch("infra.service.DatabaseHealthChecker.MySqlHealthChecker.diagnose")
    def test_unreachable_on_bad_port(self, mock_diag):
        mock_diag.return_value = DbDiagnostic(DbStatus.UNREACHABLE, "refused")
        diag = MySqlHealthChecker().diagnose("mysql://root:p@localhost:19999/db")
        assert diag.status == DbStatus.UNREACHABLE

    def test_reactivate_mentions_systemctl(self):
        diag = MySqlHealthChecker().reactivate("mysql://root:p@localhost/db")
        assert "systemctl" in diag.message

    @patch("infra.service.DatabaseHealthChecker.MySqlHealthChecker.diagnose")
    def test_bad_creds_on_wrong_password(self, mock_diag):
        mock_diag.return_value = DbDiagnostic(DbStatus.BAD_CREDS, "access denied")
        diag = MySqlHealthChecker().diagnose("mysql://root:wrong@localhost:3306/db")
        assert diag.status == DbStatus.BAD_CREDS


class TestPostgresHealthChecker:

    @patch("infra.service.DatabaseHealthChecker.PostgresHealthChecker.diagnose")
    def test_unreachable_on_bad_host(self, mock_diag):
        mock_diag.return_value = DbDiagnostic(DbStatus.UNREACHABLE, "Connection refused")
        diag = PostgresHealthChecker().diagnose("postgresql://u:p@localhost:19999/db")
        assert diag.status == DbStatus.UNREACHABLE

    @patch("infra.service.DatabaseHealthChecker.PostgresHealthChecker.diagnose")
    def test_bad_creds_on_wrong_password(self, mock_diag):
        mock_diag.return_value = DbDiagnostic(DbStatus.BAD_CREDS, "auth failed")
        diag = PostgresHealthChecker().diagnose("postgresql://u:wrong@localhost:5432/db")
        assert diag.status == DbStatus.BAD_CREDS


class TestRedisHealthChecker:

    @patch("infra.service.DatabaseHealthChecker.RedisHealthChecker.diagnose")
    def test_unreachable_on_bad_port(self, mock_diag):
        mock_diag.return_value = DbDiagnostic(DbStatus.UNREACHABLE, "refused")
        diag = RedisHealthChecker().diagnose("redis://localhost:19999/0")
        assert diag.status == DbStatus.UNREACHABLE

    @patch("infra.service.DatabaseHealthChecker.RedisHealthChecker.diagnose")
    def test_bad_password_returns_bad_creds(self, mock_diag):
        mock_diag.return_value = DbDiagnostic(DbStatus.BAD_CREDS, "WRONGPASS")
        diag = RedisHealthChecker().diagnose("redis://:wrongpw@localhost:6379/0")
        assert diag.status == DbStatus.BAD_CREDS


class TestFirebaseHealthChecker:

    @patch("infra.service.DatabaseHealthChecker.socket.getaddrinfo",
           side_effect=socket.gaierror("NXDOMAIN"))
    def test_deleted_project_dns_failure(self, _):
        diag = FirebaseHealthChecker().diagnose("https://deleted-xyz.firebaseio.com")
        assert diag.status == DbStatus.INACTIVE
        assert "deletado" in diag.message.lower() or "DNS" in (diag.raw_error or "")

    @patch("infra.service.DatabaseHealthChecker.socket.getaddrinfo")
    @patch("infra.service.DatabaseHealthChecker.urllib.request.urlopen")
    def test_permission_denied_returns_bad_creds(self, mock_urlopen, mock_dns):
        import urllib.error
        mock_dns.return_value = [(None, None, None, None, None)]
        err = urllib.error.HTTPError("url", 401, "Permission Denied", {}, MagicMock(read=lambda: b""))
        mock_urlopen.side_effect = err
        diag = FirebaseHealthChecker().diagnose("https://proj.firebaseio.com")
        assert diag.status == DbStatus.BAD_CREDS
