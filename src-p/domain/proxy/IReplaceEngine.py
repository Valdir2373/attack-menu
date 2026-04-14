from abc import ABC, abstractmethod
from typing import List, Literal
from domain.proxy.ProxyRules import ReplaceRule


class IReplaceEngine(ABC):
    @abstractmethod
    def apply(self, text: str, rules: List[ReplaceRule], phase: str) -> str:
        ...
