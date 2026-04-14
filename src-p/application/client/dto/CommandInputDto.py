from dataclasses import dataclass, field
from typing import Any, Dict


@dataclass
class CommandInputDTO:
    action: str
    payload: Dict[str, Any] = field(default_factory=dict)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "CommandInputDTO":
        if "action" not in data:
            raise ValueError("Campo 'action' obrigatório no CommandInputDTO")
        return cls(
            action=str(data["action"]),
            payload=data.get("payload", {}),
        )
