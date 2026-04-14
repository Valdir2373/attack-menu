from typing import List

from infra.adapters.sql.BaseSqlAdapter import BaseSqlAdapter
from infra.adapters.sql.PostgreSqlDialect import PostgreSqlDialect


class PostgreSqlAdapter(BaseSqlAdapter):

    def __init__(self, uri: str) -> None:
        super().__init__(PostgreSqlDialect(), uri)

    def list_tables(self) -> List[str]:
        rows = self._dialect.fetch_all(
            "SELECT tablename FROM pg_tables WHERE schemaname = 'public'"
        )
        return [row[0] for row in rows]
