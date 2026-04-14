from dataclasses import dataclass, field
from typing import Dict, Optional, Union


@dataclass
class ReverseProxyContext:
    target_domain: str
    target_host: str
    local_domain: str
    method: str
    url: str
    headers: Dict[str, str]
    raw_body: Optional[bytes] = None


@dataclass
class ReverseProxyResult:
    blocked: bool
    status: int
    headers: Dict[str, Union[str, list]]
    body: Union[str, bytes]
    redirect: Optional[str] = None
