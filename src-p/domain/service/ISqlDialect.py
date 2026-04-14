from abc import ABC, abstractmethod
from typing import Any, Callable, List, Optional


class ISqlDialect(ABC):

    @abstractmethod
    def connect(self, uri: str) -> None:
        ...

    @abstractmethod
    def execute(self, query: str, params: tuple = ()) -> None:
        ...

    @abstractmethod
    def fetch_all(self, query: str, params: tuple = ()) -> List[tuple]:
        ...

    @abstractmethod
    def fetch_one(self, query: str, params: tuple = ()) -> Optional[tuple]:
        ...

    @abstractmethod
    def commit(self) -> None:
        ...

    @abstractmethod
    def quote_identifier(self, name: str) -> str:
        ...

    @abstractmethod
    def get_column_type_query(self, table: str) -> str:
        ...

    @abstractmethod
    def get_pk_query(self) -> str:
        ...

    @abstractmethod
    def alter_column_to_text(self, table: str, column: str) -> str:
        ...

    @abstractmethod
    def needs_text_conversion(self, data_type: str) -> bool:
        ...

    @abstractmethod
    def begin_transaction(self, table: str) -> None:
        ...

    @abstractmethod
    def end_transaction(self) -> None:
        ...

    @abstractmethod
    def build_update(self, table: str, column: str, pk_column: Optional[str], pk_value: Any) -> str:
        ...
