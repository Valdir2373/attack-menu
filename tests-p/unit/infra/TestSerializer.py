import os
import json
import pytest
from datetime import datetime
from dataclasses import dataclass

os.environ.setdefault("KEY_CRIP_DATA", "test-key")

from infra.utils.Serializer import Serializer


class TestSerializerDumpsLoads:

    def test_roundtrip_dict(self):
        data = {"name": "alice", "age": 30}
        raw = Serializer.dumps(data)
        result = Serializer.loads(raw)
        assert result == data

    def test_roundtrip_list(self):
        data = [1, 2, 3, "four"]
        raw = Serializer.dumps(data)
        result = Serializer.loads(raw)
        assert result == data

    def test_roundtrip_nested_structure(self):
        data = {"users": [{"name": "bob", "scores": [10, 20]}], "total": 1}
        raw = Serializer.dumps(data)
        result = Serializer.loads(raw)
        assert result == data

    def test_roundtrip_string(self):
        data = "hello world"
        raw = Serializer.dumps(data)
        result = Serializer.loads(raw)
        assert result == data

    def test_roundtrip_number(self):
        raw = Serializer.dumps(42)
        result = Serializer.loads(raw)
        assert result == 42

    def test_roundtrip_boolean(self):
        raw = Serializer.dumps(True)
        result = Serializer.loads(raw)
        assert result is True

    def test_roundtrip_null(self):
        raw = Serializer.dumps(None)
        result = Serializer.loads(raw)
        assert result is None

    def test_unicode_preserved(self):
        data = {"msg": "dados cifrados"}
        raw = Serializer.dumps(data)
        assert "dados cifrados" in raw
        result = Serializer.loads(raw)
        assert result["msg"] == "dados cifrados"


class TestSerializerDatetime:

    def test_datetime_serialized_as_iso(self):
        dt = datetime(2026, 4, 10, 12, 30, 0)
        raw = Serializer.dumps({"timestamp": dt})
        parsed = json.loads(raw)
        assert "2026-04-10" in parsed["timestamp"]
        assert "12:30:00" in parsed["timestamp"]

    def test_datetime_in_list(self):
        dt = datetime(2026, 1, 1)
        raw = Serializer.dumps([dt])
        parsed = json.loads(raw)
        assert "2026-01-01" in parsed[0]

    def test_datetime_nested(self):
        dt = datetime(2026, 6, 15, 8, 0, 0)
        data = {"events": [{"at": dt}]}
        raw = Serializer.dumps(data)
        parsed = json.loads(raw)
        assert "2026-06-15" in parsed["events"][0]["at"]


class TestSerializerToDict:

    def test_plain_dict_passthrough(self):
        data = {"key": "value"}
        result = Serializer.to_dict(data)
        assert result == {"key": "value"}

    def test_list_passthrough(self):
        data = [1, 2, 3]
        result = Serializer.to_dict(data)
        assert result == [1, 2, 3]

    def test_string_passthrough(self):
        result = Serializer.to_dict("hello")
        assert result == "hello"

    def test_int_passthrough(self):
        result = Serializer.to_dict(42)
        assert result == 42

    def test_datetime_converted_to_iso(self):
        dt = datetime(2026, 4, 10)
        result = Serializer.to_dict(dt)
        assert "2026-04-10" in result

    def test_dataclass_converted(self):
        @dataclass
        class Sample:
            name: str
            count: int

        obj = Sample(name="test", count=5)
        result = Serializer.to_dict(obj)
        assert result == {"name": "test", "count": 5}

    def test_nested_dataclass(self):
        @dataclass
        class Inner:
            value: int

        @dataclass
        class Outer:
            inner: Inner

        obj = Outer(inner=Inner(value=42))
        result = Serializer.to_dict(obj)
        assert result == {"inner": {"value": 42}}

    def test_list_of_dataclasses(self):
        @dataclass
        class Item:
            id: int

        items = [Item(id=1), Item(id=2)]
        result = Serializer.to_dict(items)
        assert result == [{"id": 1}, {"id": 2}]

    def test_dict_with_datetime_values(self):
        dt = datetime(2026, 12, 25)
        result = Serializer.to_dict({"created_at": dt})
        assert "2026-12-25" in result["created_at"]

    def test_object_with_to_dict_method(self):
        class CustomObj:
            def to_dict(self):
                return {"custom": True}

        result = Serializer.to_dict(CustomObj())
        assert result == {"custom": True}


class TestSerializerEdgeCases:

    def test_dumps_empty_dict(self):
        raw = Serializer.dumps({})
        assert raw == "{}"

    def test_dumps_empty_list(self):
        raw = Serializer.dumps([])
        assert raw == "[]"

    def test_loads_invalid_json_raises(self):
        with pytest.raises(json.JSONDecodeError):
            Serializer.loads("not valid json")

    def test_dumps_with_special_characters(self):
        data = {"msg": 'he said "hello" & <bye>'}
        raw = Serializer.dumps(data)
        result = Serializer.loads(raw)
        assert result["msg"] == 'he said "hello" & <bye>'
