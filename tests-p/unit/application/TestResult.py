import pytest
from application.shared.Result import Result


class TestResult:
    def test_ok_is_success(self):
        r = Result.ok("hello")
        assert r.is_success is True
        assert r.is_failure is False
        assert r.value == "hello"
        assert r.error is None

    def test_fail_is_failure(self):
        r = Result.fail("algo deu errado")
        assert r.is_failure is True
        assert r.is_success is False
        assert r.error == "algo deu errado"
        assert r.value is None

    def test_ok_none_value(self):
        r = Result.ok(None)
        assert r.is_success is True

    def test_unwrap_ok(self):
        r = Result.ok(42)
        assert r.unwrap() == 42

    def test_unwrap_fail_raises(self):
        r = Result.fail("erro")
        with pytest.raises(RuntimeError, match="erro"):
            r.unwrap()
