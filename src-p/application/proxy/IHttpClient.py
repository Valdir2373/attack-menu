from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Union


@dataclass
class HttpForwardRequest:
    url: str
    method: str
    headers: Dict[str, str]
    body: Optional[bytes] = None


@dataclass
class HttpForwardResponse:
    status: int
    headers: Dict[str, Union[str, List[str]]]
    body: bytes
    content_type: str = ""


class IHttpClient(ABC):
    @abstractmethod
    async def forward(self, req: HttpForwardRequest) -> HttpForwardResponse:
        ...
