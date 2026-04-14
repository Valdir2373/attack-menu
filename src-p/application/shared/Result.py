from dataclasses import dataclass
from typing import Generic, Optional, TypeVar

T = TypeVar("T")


@dataclass
class Result(Generic[T]):
    is_success: bool
    value: Optional[T] = None
    error: Optional[str] = None

    @classmethod
    def ok(cls, value: T) -> "Result[T]":
        return cls(is_success=True, value=value)

    @classmethod
    def fail(cls, error: str) -> "Result[T]":
        return cls(is_success=False, error=error)

    @property
    def is_failure(self) -> bool:
        return not self.is_success

    def unwrap(self) -> T:
        if self.is_failure:
            raise RuntimeError(f"Result.unwrap() em falha: {self.error}")
        return self.value  # type: ignore[return-value]
