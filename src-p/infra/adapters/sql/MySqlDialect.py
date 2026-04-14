from typing import Any, List, Optional
from urllib.parse import urlparse

from domain.service.ISqlDialect import ISqlDialect


class MySqlDialect(ISqlDialect):

    def __init__(self) -> None:
        self._conn: Any = None
        self._cursor: Any = None

    def connect(self, uri: str) -> None:
        import pymysql
        p = urlparse(uri)
        self._conn = pymysql.connect(
            host=p.hostname, port=p.port or 3306,
            user=p.username, password=p.password or "",
            database=p.path.lstrip("/"),
            charset="utf8mb4",
            read_timeout=30, write_timeout=30, connect_timeout=10,
        )
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
        return f"`{name}`"

    def get_column_type_query(self, table: str) -> str:
        return (
            "SELECT COLUMN_NAME, DATA_TYPE "
            "FROM information_schema.COLUMNS "
            "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = %s "
            "ORDER BY ORDINAL_POSITION"
        )

    def get_pk_query(self) -> str:
        return (
            "SELECT COLUMN_NAME "
            "FROM information_schema.KEY_COLUMN_USAGE "
            "WHERE TABLE_SCHEMA = DATABASE() "
            "AND TABLE_NAME = %s AND CONSTRAINT_NAME = 'PRIMARY' "
            "LIMIT 1"
        )

    def alter_column_to_text(self, table: str, column: str) -> str:
        return f"ALTER TABLE `{table}` MODIFY `{column}` TEXT"

    def needs_text_conversion(self, data_type: str) -> bool:
        return data_type.lower() in ("varchar", "char", "tinytext")

    def begin_transaction(self, table: str) -> None:
        self._cursor.execute(f"LOCK TABLES `{table}` WRITE")
        self._cursor.execute("BEGIN")

    def end_transaction(self) -> None:
        self._conn.commit()
        self._cursor.execute("UNLOCK TABLES")

    def build_update(self, table: str, column: str, pk_column: Optional[str], pk_value: Any) -> str:
        if pk_column:
            return f"UPDATE `{table}` SET `{column}` = %s WHERE `{pk_column}` = %s"
        return f"UPDATE `{table}` SET `{column}` = %s LIMIT 1"
