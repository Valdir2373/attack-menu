from abc import ABC, abstractmethod
from dataclasses import dataclass
from enum import Enum
from typing import Optional


class DbStatus(Enum):
    HEALTHY     = "healthy"
    INACTIVE    = "inactive"
    BAD_CREDS   = "bad_creds"
    UNREACHABLE = "unreachable"
    OVERLOADED  = "overloaded"
    READ_ONLY   = "read_only"
    ERROR       = "error"


@dataclass
class DbDiagnostic:
    status: DbStatus
    message: str
    can_reactivate: bool = False
    reactivate_hint: str = ""
    raw_error: Optional[str] = None


class IDatabaseHealthCheck(ABC):

    @abstractmethod
    def diagnose(self, uri: str) -> DbDiagnostic:
        ...

    @abstractmethod
    def reactivate(self, uri: str) -> DbDiagnostic:
        ...
