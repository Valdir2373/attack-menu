from abc import ABC, abstractmethod

from domain.service.SqlRansomDTO import SqlRansomDTO


class ISqlRansomIterator(ABC):

    @abstractmethod
    def run(self, dto: SqlRansomDTO) -> int:
        ...
