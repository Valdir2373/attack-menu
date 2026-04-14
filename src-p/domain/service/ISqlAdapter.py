from abc import ABC, abstractmethod
from typing import List

from domain.service.ColumnData import ColumnData


class ISqlAdapter(ABC):

    @abstractmethod
    def list_tables(self) -> List[str]:
        ...

    @abstractmethod
    def get_columns(self, table: str) -> List[ColumnData]:
        ...

    @abstractmethod
    def end_transaction(self) -> None:
        ...
