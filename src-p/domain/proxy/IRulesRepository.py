from abc import ABC, abstractmethod
from domain.proxy.ProxyRules import MergedRules


class IRulesRepository(ABC):
    @abstractmethod
    def get_merged(self, host: str) -> MergedRules:
        ...
