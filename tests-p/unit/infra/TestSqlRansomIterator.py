import os
import pytest

os.environ.setdefault("KEY_CRIP_DATA", "test-key-for-sql-iterator")

from domain.service.ColumnData import ColumnData
from domain.service.SqlRansomDTO import SqlRansomDTO
from infra.service.SqlRansomIterator import SqlRansomIterator
from infra.service.RansomCripEngine import RansomCripEngine


class MockEngine:
    def __init__(self):
        self.execute_calls = []

    def execute(self, write_fn, datas):
        self.execute_calls.append(datas)
        for d in datas:
            write_fn(b"\x00" * 32)


class TestSqlRansomIterator:

    def test_single_table_single_column(self):
        engine = MockEngine()
        written = []

        col = ColumnData(
            name="password",
            values=["pass1", "pass2", "pass3"],
            write=lambda enc: written.append(enc),
        )

        dto = SqlRansomDTO(
            engine=engine,
            tables=["users"],
            get_columns=lambda table: [col],
            end_transaction=lambda: None,
        )

        iterator = SqlRansomIterator()
        total = iterator.run(dto)

        assert total == 3
        assert len(written) == 3
        assert len(engine.execute_calls) == 1

    def test_multiple_tables(self):
        engine = MockEngine()
        written = []

        def get_columns(table):
            if table == "users":
                return [ColumnData("email", ["a@b.com", "c@d.com"], lambda enc: written.append(("users", enc)))]
            if table == "orders":
                return [
                    ColumnData("address", ["rua 1", "rua 2", "rua 3"], lambda enc: written.append(("orders_addr", enc))),
                    ColumnData("phone", ["111", "222", "333"], lambda enc: written.append(("orders_phone", enc))),
                ]
            return []

        dto = SqlRansomDTO(
            engine=engine,
            tables=["users", "orders"],
            get_columns=get_columns,
            end_transaction=lambda: None,
        )

        iterator = SqlRansomIterator()
        total = iterator.run(dto)

        assert total == 8
        assert len(written) == 8

    def test_empty_table_returns_zero(self):
        engine = MockEngine()

        dto = SqlRansomDTO(
            engine=engine,
            tables=["empty_table"],
            get_columns=lambda table: [],
            end_transaction=lambda: None,
        )

        iterator = SqlRansomIterator()
        total = iterator.run(dto)

        assert total == 0

    def test_empty_column_values(self):
        engine = MockEngine()
        written = []

        col = ColumnData(name="col1", values=[], write=lambda enc: written.append(enc))

        dto = SqlRansomDTO(
            engine=engine,
            tables=["t1"],
            get_columns=lambda table: [col],
            end_transaction=lambda: None,
        )

        iterator = SqlRansomIterator()
        total = iterator.run(dto)

        assert total == 0
        assert len(written) == 0

    def test_no_tables_returns_zero(self):
        engine = MockEngine()

        dto = SqlRansomDTO(
            engine=engine,
            tables=[],
            get_columns=lambda table: [],
            end_transaction=lambda: None,
        )

        iterator = SqlRansomIterator()
        assert iterator.run(dto) == 0

    def test_with_real_engine(self):
        engine = RansomCripEngine()
        encrypted_blobs = []

        col = ColumnData(
            name="secret",
            values=["confidential_data_1", "confidential_data_2"],
            write=lambda enc: encrypted_blobs.append(enc),
        )

        dto = SqlRansomDTO(
            engine=engine,
            tables=["secrets"],
            get_columns=lambda table: [col],
            end_transaction=lambda: None,
        )

        iterator = SqlRansomIterator()
        total = iterator.run(dto)

        assert total == 2
        assert len(encrypted_blobs) == 2
        for blob in encrypted_blobs:
            assert len(blob) > 28

    def test_write_callback_receives_bytes(self):
        engine = MockEngine()
        types_received = []

        col = ColumnData(
            name="col1",
            values=["v1", "v2"],
            write=lambda enc: types_received.append(type(enc)),
        )

        dto = SqlRansomDTO(
            engine=engine,
            tables=["t1"],
            get_columns=lambda table: [col],
            end_transaction=lambda: None,
        )

        SqlRansomIterator().run(dto)

        assert all(t == bytes for t in types_received)
