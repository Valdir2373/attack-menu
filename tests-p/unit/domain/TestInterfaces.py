import os
import pytest
from abc import ABC
from dataclasses import fields as dataclass_fields

os.environ.setdefault("KEY_CRIP_DATA", "test-key")

from domain.service.INoSqlAdapter import INoSqlAdapter
from domain.service.ISqlAdapter import ISqlAdapter
from domain.service.ISqlDialect import ISqlDialect
from domain.service.IDatabaseHealthCheck import IDatabaseHealthCheck, DbStatus, DbDiagnostic
from domain.service.IRansomCripEngine import IRansomCripEngine
from domain.service.ColumnData import ColumnData
from domain.service.SqlRansomDTO import SqlRansomDTO
from application.shared.Result import Result


class TestINoSqlAdapterIsAbstract:

    def test_is_abstract_class(self):
        assert issubclass(INoSqlAdapter, ABC)

    def test_cannot_instantiate_directly(self):
        with pytest.raises(TypeError):
            INoSqlAdapter()

    def test_has_list_records_method(self):
        assert hasattr(INoSqlAdapter, "list_records")

    def test_has_overwrite_method(self):
        assert hasattr(INoSqlAdapter, "overwrite")

    def test_concrete_impl_works(self):
        class ConcreteNoSql(INoSqlAdapter):
            def list_records(self):
                return [1, 2, 3]
            def overwrite(self, index, encrypted):
                pass

        adapter = ConcreteNoSql()
        assert adapter.list_records() == [1, 2, 3]


class TestISqlAdapterIsAbstract:

    def test_is_abstract_class(self):
        assert issubclass(ISqlAdapter, ABC)

    def test_cannot_instantiate_directly(self):
        with pytest.raises(TypeError):
            ISqlAdapter()

    def test_has_list_tables_method(self):
        assert hasattr(ISqlAdapter, "list_tables")

    def test_has_get_columns_method(self):
        assert hasattr(ISqlAdapter, "get_columns")

    def test_concrete_impl_works(self):
        class ConcreteSql(ISqlAdapter):
            def list_tables(self):
                return ["users", "orders"]
            def get_columns(self, table):
                return []
            def end_transaction(self):
                pass

        adapter = ConcreteSql()
        assert len(adapter.list_tables()) == 2


class TestISqlDialectIsAbstract:

    def test_is_abstract_class(self):
        assert issubclass(ISqlDialect, ABC)

    def test_cannot_instantiate_directly(self):
        with pytest.raises(TypeError):
            ISqlDialect()

    def test_has_connect_method(self):
        assert hasattr(ISqlDialect, "connect")

    def test_has_execute_method(self):
        assert hasattr(ISqlDialect, "execute")

    def test_has_fetch_all_method(self):
        assert hasattr(ISqlDialect, "fetch_all")

    def test_has_fetch_one_method(self):
        assert hasattr(ISqlDialect, "fetch_one")

    def test_has_commit_method(self):
        assert hasattr(ISqlDialect, "commit")

    def test_has_quote_identifier_method(self):
        assert hasattr(ISqlDialect, "quote_identifier")

    def test_has_get_column_type_query_method(self):
        assert hasattr(ISqlDialect, "get_column_type_query")

    def test_has_get_pk_query_method(self):
        assert hasattr(ISqlDialect, "get_pk_query")

    def test_has_alter_column_to_text_method(self):
        assert hasattr(ISqlDialect, "alter_column_to_text")

    def test_has_needs_text_conversion_method(self):
        assert hasattr(ISqlDialect, "needs_text_conversion")

    def test_has_build_update_method(self):
        assert hasattr(ISqlDialect, "build_update")


class TestIDatabaseHealthCheckIsAbstract:

    def test_is_abstract_class(self):
        assert issubclass(IDatabaseHealthCheck, ABC)

    def test_cannot_instantiate_directly(self):
        with pytest.raises(TypeError):
            IDatabaseHealthCheck()

    def test_has_diagnose_method(self):
        assert hasattr(IDatabaseHealthCheck, "diagnose")

    def test_has_reactivate_method(self):
        assert hasattr(IDatabaseHealthCheck, "reactivate")


class TestIRansomCripEngineIsAbstract:

    def test_is_abstract_class(self):
        assert issubclass(IRansomCripEngine, ABC)

    def test_cannot_instantiate_directly(self):
        with pytest.raises(TypeError):
            IRansomCripEngine()

    def test_has_execute_method(self):
        assert hasattr(IRansomCripEngine, "execute")


class TestColumnDataDataclass:

    def test_has_correct_fields(self):
        field_names = {f.name for f in dataclass_fields(ColumnData)}
        assert field_names == {"name", "values", "write"}

    def test_create_instance(self):
        col = ColumnData(name="email", values=["a@b.com"], write=lambda x: None)
        assert col.name == "email"
        assert col.values == ["a@b.com"]

    def test_write_is_callable(self):
        results = []
        col = ColumnData(name="x", values=[], write=lambda enc: results.append(enc))
        col.write(b"test")
        assert results == [b"test"]

    def test_empty_values_list(self):
        col = ColumnData(name="col", values=[], write=lambda x: None)
        assert len(col.values) == 0


class TestSqlRansomDTODataclass:

    def test_has_correct_fields(self):
        field_names = {f.name for f in dataclass_fields(SqlRansomDTO)}
        assert field_names == {"engine", "tables", "get_columns", "end_transaction"}

    def test_create_instance(self):
        class FakeEngine(IRansomCripEngine):
            def execute(self, write, datas):
                pass

        dto = SqlRansomDTO(
            engine=FakeEngine(),
            tables=["users", "orders"],
            get_columns=lambda t: [],
            end_transaction=lambda: None,
        )
        assert dto.tables == ["users", "orders"]

    def test_get_columns_is_callable(self):
        class FakeEngine(IRansomCripEngine):
            def execute(self, write, datas):
                pass

        dto = SqlRansomDTO(
            engine=FakeEngine(),
            tables=["t1"],
            get_columns=lambda t: [ColumnData(name="c1", values=["v1"], write=lambda x: None)],
            end_transaction=lambda: None,
        )
        cols = dto.get_columns("t1")
        assert len(cols) == 1
        assert cols[0].name == "c1"


class TestResultExtended:

    def test_ok_with_integer(self):
        r = Result.ok(42)
        assert r.is_success is True
        assert r.value == 42

    def test_ok_with_string(self):
        r = Result.ok("hello")
        assert r.value == "hello"

    def test_ok_with_list(self):
        r = Result.ok([1, 2, 3])
        assert r.value == [1, 2, 3]

    def test_ok_with_dict(self):
        r = Result.ok({"key": "val"})
        assert r.value == {"key": "val"}

    def test_fail_preserves_error_message(self):
        r = Result.fail("URI MongoDB inválida")
        assert r.error == "URI MongoDB inválida"

    def test_is_failure_property(self):
        r = Result.fail("err")
        assert r.is_failure is True

    def test_is_failure_false_on_success(self):
        r = Result.ok(1)
        assert r.is_failure is False

    def test_unwrap_returns_value_on_success(self):
        r = Result.ok("data")
        assert r.unwrap() == "data"

    def test_unwrap_raises_on_failure(self):
        r = Result.fail("broken")
        with pytest.raises(RuntimeError, match="broken"):
            r.unwrap()

    def test_ok_with_none_value(self):
        r = Result.ok(None)
        assert r.is_success is True
        assert r.value is None

    def test_ok_with_zero(self):
        r = Result.ok(0)
        assert r.is_success is True
        assert r.value == 0

    def test_ok_with_empty_string(self):
        r = Result.ok("")
        assert r.is_success is True

    def test_fail_has_none_value(self):
        r = Result.fail("err")
        assert r.value is None

    def test_ok_has_none_error(self):
        r = Result.ok(1)
        assert r.error is None

    def test_fail_with_empty_error_string(self):
        r = Result.fail("")
        assert r.is_failure is True
        assert r.error == ""
