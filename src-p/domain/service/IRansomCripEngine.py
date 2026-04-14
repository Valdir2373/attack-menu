from abc import ABC, abstractmethod
from typing import Callable


class IRansomCripEngine(ABC):
    @abstractmethod
    def execute(self, write: Callable[[bytes], None], datas: list) -> None:
        ...
