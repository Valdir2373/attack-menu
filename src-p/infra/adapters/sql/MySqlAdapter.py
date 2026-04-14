from typing import List

from infra.adapters.sql.BaseSqlAdapter import BaseSqlAdapter
from infra.adapters.sql.MySqlDialect import MySqlDialect


class MySqlAdapter(BaseSqlAdapter):

    def __init__(self, uri: str) -> None:
        super().__init__(MySqlDialect(), uri)

    def list_tables(self) -> List[str]:
        rows = self._dialect.fetch_all("SHOW TABLES")
        return [row[0] for row in rows]
