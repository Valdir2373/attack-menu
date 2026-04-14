import pytest
from domain.entities.BaseEntity import BaseEntity


class ConcreteEntity(BaseEntity):
    pass


class TestBaseEntity:
    def test_create_generates_id(self):
        e = ConcreteEntity()
        assert e.id is not None
        assert len(e.id) == 36

    def test_create_generates_created_at(self):
        e = ConcreteEntity()
        assert e.created_at is not None

    def test_equality_by_id(self):
        e1 = ConcreteEntity()
        e2 = ConcreteEntity()
        assert e1 != e2

    def test_same_id_equals(self):
        e1 = ConcreteEntity()
        e2 = ConcreteEntity(id=e1.id, created_at=e1.created_at)
        assert e1 == e2

    def test_hashable(self):
        e = ConcreteEntity()
        s = {e}
        assert e in s
