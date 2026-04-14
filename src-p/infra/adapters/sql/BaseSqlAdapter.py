from typing import Any, List, Optional

from domain.service.ISqlAdapter import ISqlAdapter
from domain.service.ISqlDialect import ISqlDialect
from domain.service.ColumnData import ColumnData


class BaseSqlAdapter(ISqlAdapter):

    def __init__(self, dialect: ISqlDialect, uri: str) -> None:
        self._dialect = dialect
        self._dialect.connect(uri)

    def get_columns(self, table: str) -> List[ColumnData]:
        self._dialect.begin_transaction(table)

        pk_col = self._discover_pk(table)
        col_info = self._dialect.fetch_all(
            self._dialect.get_column_type_query(table), (table,)
        )

        data_cols = [(name, dtype) for name, dtype in col_info if name != pk_col]

        self._prepare_columns_for_encryption(table, data_cols)

        return self._build_column_data(table, data_cols, pk_col)

    def end_transaction(self) -> None:
        self._dialect.end_transaction()

    def _discover_pk(self, table: str) -> Optional[str]:
        row = self._dialect.fetch_one(self._dialect.get_pk_query(), (table,))
        return row[0] if row else None

    def _prepare_columns_for_encryption(
        self, table: str, columns: List[tuple]
    ) -> None:
        for name, dtype in columns:
            if self._dialect.needs_text_conversion(dtype):
                try:
                    ddl = self._dialect.alter_column_to_text(table, name)
                    self._dialect.execute(ddl)
                except Exception:
                    pass
        self._dialect.commit()

    def _build_column_data(
        self, table: str, columns: List[tuple], pk_col: Optional[str]
    ) -> List[ColumnData]:
        q = self._dialect.quote_identifier
        result: List[ColumnData] = []

        for col_name, _ in columns:
            if pk_col:
                rows = self._dialect.fetch_all(
                    f"SELECT {q(pk_col)}, {q(col_name)} FROM {q(table)}"
                )
                pk_values = [r[0] for r in rows]
                values = [r[1] for r in rows]
            else:
                rows = self._dialect.fetch_all(
                    f"SELECT {q(col_name)} FROM {q(table)}"
                )
                pk_values = None
                values = [r[0] for r in rows]

            result.append(ColumnData(
                name=col_name,
                values=values,
                write=self._make_write(table, col_name, pk_col, pk_values),
            ))

        return result

    def _make_write(
        self, table: str, col: str,
        pk_col: Optional[str], pk_values: Optional[List[Any]],
    ):
        index = [0]

        def write_fn(enc: bytes) -> None:
            try:
                query = self._dialect.build_update(table, col, pk_col, None)
                if pk_col and pk_values:
                    self._dialect.execute(query, (enc.hex(), pk_values[index[0]]))
                else:
                    self._dialect.execute(query, (enc.hex(), index[0]))
            except Exception as e:
                raise ConnectionError(f"SQL UPDATE failed on {table}.{col} row {index[0]}: {e}")
            index[0] += 1

        return write_fn
