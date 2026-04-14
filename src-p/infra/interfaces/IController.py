from abc import ABC, abstractmethod
from typing import Any, Dict


class IController(ABC):

    @abstractmethod
    def get_actions(self) -> Dict[str, Any]:
        ...
