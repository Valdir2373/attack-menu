import json
from datetime import datetime
from typing import Any


class Serializer:

    @staticmethod
    def _default(obj: Any) -> Any:
        if isinstance(obj, datetime):
            return obj.isoformat()
        if hasattr(obj, "__dict__"):
            return obj.__dict__
        raise TypeError(f"Tipo não serializável: {type(obj)}")

    @classmethod
    def dumps(cls, data: Any) -> str:
        return json.dumps(data, default=cls._default, ensure_ascii=False)

    @classmethod
    def loads(cls, raw: str) -> Any:
        return json.loads(raw)

    @classmethod
    def to_dict(cls, obj: Any) -> Any:
        if hasattr(obj, "to_dict"):
            return obj.to_dict()
        if hasattr(obj, "__dataclass_fields__"):
            return {k: cls.to_dict(v) for k, v in obj.__dict__.items()}
        if isinstance(obj, datetime):
            return obj.isoformat()
        if isinstance(obj, list):
            return [cls.to_dict(i) for i in obj]
        if isinstance(obj, dict):
            return {k: cls.to_dict(v) for k, v in obj.items()}
        return obj
