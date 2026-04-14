from abc import ABC, abstractmethod
from typing import Any, List


class INoSqlAdapter(ABC):

    @abstractmethod
    def list_records(self) -> List[Any]:
        ...

    @abstractmethod
    def overwrite(self, index: int, encrypted: bytes) -> None:
        ...
