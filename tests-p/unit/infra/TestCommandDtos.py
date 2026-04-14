import pytest
from application.client.dto.CommandInputDto import CommandInputDTO
from application.client.dto.CommandOutputDto import CommandOutputDTO


class TestCommandInputDTO:

    def test_create_with_action(self):
        cmd = CommandInputDTO(action="ping")
        assert cmd.action == "ping"

    def test_create_with_payload(self):
        cmd = CommandInputDTO(action="ransom_db", payload={"db": "MongoDB"})
        assert cmd.payload == {"db": "MongoDB"}

    def test_from_dict(self):
        cmd = CommandInputDTO.from_dict({"action": "test", "payload": {"key": "val"}})
        assert cmd.action == "test"
        assert cmd.payload["key"] == "val"

    def test_from_dict_no_payload(self):
        cmd = CommandInputDTO.from_dict({"action": "ping"})
        assert cmd.action == "ping"

    def test_default_payload_is_empty(self):
        cmd = CommandInputDTO(action="ping")
        assert cmd.payload == {} or cmd.payload is None


class TestCommandOutputDTO:

    def test_ok_creates_success(self):
        dto = CommandOutputDTO.ok(data={"count": 5})
        assert dto.success is True
        assert dto.data == {"count": 5}
        assert dto.error is None

    def test_fail_creates_failure(self):
        dto = CommandOutputDTO.fail("algo deu errado")
        assert dto.success is False
        assert dto.error == "algo deu errado"

    def test_push_event_creates_event(self):
        dto = CommandOutputDTO.push_event("ransom_db_log", {"msg": "processando"})
        assert dto.success is True
        assert dto.event == "ransom_db_log"
        assert dto.data == {"msg": "processando"}

    def test_to_dict_success(self):
        dto = CommandOutputDTO.ok(data={"x": 1})
        d = dto.to_dict()
        assert d["success"] is True
        assert d["data"] == {"x": 1}

    def test_to_dict_failure(self):
        dto = CommandOutputDTO.fail("erro")
        d = dto.to_dict()
        assert d["success"] is False
        assert d["error"] == "erro"

    def test_to_dict_event(self):
        dto = CommandOutputDTO.push_event("test_event", {"a": 1})
        d = dto.to_dict()
        assert d["event"] == "test_event"
