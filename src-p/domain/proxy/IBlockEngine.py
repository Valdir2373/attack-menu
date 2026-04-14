from abc import ABC, abstractmethod
from domain.proxy.ProxyRules import MergedRules


class IBlockEngine(ABC):
    @abstractmethod
    def is_blocked(self, text: str, rules: MergedRules) -> bool:
        ...
