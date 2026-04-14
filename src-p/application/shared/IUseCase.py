from abc import ABC, abstractmethod
from typing import Generic, TypeVar
from application.shared.Result import Result

TInput = TypeVar("TInput")
TOutput = TypeVar("TOutput")


class IUseCase(ABC, Generic[TInput, TOutput]):

    @abstractmethod
    async def execute(self, input_dto: TInput) -> Result[TOutput]:
        ...
