from dataclasses import dataclass
from typing import Callable, List

from domain.service.IRansomCripEngine import IRansomCripEngine
from domain.service.ColumnData import ColumnData


@dataclass
class SqlRansomDTO:
    engine: IRansomCripEngine
    tables: List[str]
    get_columns: Callable[[str], List[ColumnData]]
    end_transaction: Callable[[], None]
