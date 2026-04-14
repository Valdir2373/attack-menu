from typing import Any, List, Optional

from domain.service.ISqlDialect import ISqlDialect


class PostgreSqlDialect(ISqlDialect):

    def __init__(self) -> None:
        self._conn: Any = None
        self._cursor: Any = None

    def connect(self, uri: str) -> None:
        import psycopg2
        self._conn = psycopg2.connect(uri, connect_timeout=10)
        self._cursor = self._conn.cursor()

    def execute(self, query: str, params: tuple = ()) -> None:
        self._cursor.execute(query, params)

    def fetch_all(self, query: str, params: tuple = ()) -> List[tuple]:
        self._cursor.execute(query, params)
        return self._cursor.fetchall()

    def fetch_one(self, query: str, params: tuple = ()) -> Optional[tuple]:
        self._cursor.execute(query, params)
        return self._cursor.fetchone()

    def commit(self) -> None:
        self._conn.commit()

    def quote_identifier(self, name: str) -> str:
        return f'"{name}"'

    def get_column_type_query(self, table: str) -> str:
        return (
            "SELECT column_name, data_type "
            "FROM information_schema.columns "
            "WHERE table_name = %s AND table_schema = 'public' "
            "ORDER BY ordinal_position"
        )

    def get_pk_query(self) -> str:
        return (
            "SELECT a.attname "
            "FROM pg_index i "
            "JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey) "
            "WHERE i.indrelid = %s::regclass AND i.indisprimary "
            "LIMIT 1"
        )

    def alter_column_to_text(self, table: str, column: str) -> str:
        return f'ALTER TABLE "{table}" ALTER COLUMN "{column}" TYPE TEXT'

    def needs_text_conversion(self, data_type: str) -> bool:
        return data_type.lower() in ("character varying", "character", "varchar", "char")

    def begin_transaction(self, table: str) -> None:
        self._cursor.execute("BEGIN")

    def end_transaction(self) -> None:
        self._conn.commit()

    def build_update(self, table: str, column: str, pk_column: Optional[str], pk_value: Any) -> str:
        if pk_column:
            return f'UPDATE "{table}" SET "{column}" = %s WHERE "{pk_column}" = %s'
        return (
            f'UPDATE "{table}" SET "{column}" = %s '
            f'WHERE ctid = (SELECT ctid FROM "{table}" LIMIT 1 OFFSET %s)'
        )
