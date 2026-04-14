from dataclasses import dataclass
from typing import Any, Callable, List


@dataclass
class ColumnData:
    name: str
    values: List[Any]
    write: Callable[[bytes], None]
