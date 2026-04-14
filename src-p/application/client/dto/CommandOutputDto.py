from dataclasses import dataclass, field
from typing import Any, Dict, Optional


@dataclass
class CommandOutputDTO:
    success: bool
    data: Optional[Any] = None
    error: Optional[str] = None
    event: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "success": self.success,
            "data": self.data,
            "error": self.error,
            "event": self.event,
        }

    @classmethod
    def ok(cls, data: Any = None, event: Optional[str] = None) -> "CommandOutputDTO":
        return cls(success=True, data=data, event=event)

    @classmethod
    def fail(cls, error: str, event: Optional[str] = None) -> "CommandOutputDTO":
        return cls(success=False, error=error, event=event)

    @classmethod
    def push_event(cls, event: str, data: Any = None) -> "CommandOutputDTO":
        return cls(success=True, data=data, event=event)
