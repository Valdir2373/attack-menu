from abc import ABC, abstractmethod
from domain.proxy.ProxyRules import MergedRules


class IHtmlSanitizer(ABC):
    @abstractmethod
    def sanitize(self, html: str, rules: MergedRules) -> str:
        ...
