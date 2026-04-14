import json
import socket
import urllib.request
import urllib.error
from typing import Optional
from urllib.parse import urlparse

from domain.service.IDatabaseHealthCheck import (
    IDatabaseHealthCheck, DbDiagnostic, DbStatus,
)


class SupabaseHealthChecker(IDatabaseHealthCheck):

    def diagnose(self, uri: str) -> DbDiagnostic:
        parts = uri.split("|")
        if len(parts) < 2:
            return DbDiagnostic(DbStatus.BAD_CREDS, "URI Supabase inválida. Formato: url|anon_key")

        url, key = parts[0].rstrip("/"), parts[1]
        host = urlparse(url).hostname or ""

        try:
            socket.getaddrinfo(host, 443, socket.AF_INET, socket.SOCK_STREAM)
        except socket.gaierror:
            ref = host.split(".")[0]
            return DbDiagnostic(
                DbStatus.INACTIVE,
                f"Projeto Supabase '{ref}' está pausado por inatividade. "
                f"Acesse app.supabase.com e clique em 'Restore project'.",
                can_reactivate=True,
                reactivate_hint="Supabase pausa projetos grátis após 7 dias de inatividade.",
                raw_error=f"DNS NXDOMAIN: {host}",
            )

        try:
            test_url = f"{url}/rest/v1/data?select=id&limit=0"
            req = urllib.request.Request(test_url, headers={
                "apikey": key, "Authorization": f"Bearer {key}",
            })
            with urllib.request.urlopen(req, timeout=10) as resp:
                if resp.status == 200:
                    return DbDiagnostic(DbStatus.HEALTHY, "Supabase conectado e operacional.")
        except urllib.error.HTTPError as e:
            if e.code == 401:
                return DbDiagnostic(DbStatus.BAD_CREDS,
                    "Credencial Supabase inválida ou expirada. Verifique a anon key.",
                    raw_error=f"HTTP 401: {e.read().decode()[:100]}")
            if e.code == 403:
                return DbDiagnostic(DbStatus.BAD_CREDS,
                    "Acesso negado ao Supabase. A key pode não ter permissão.",
                    raw_error=f"HTTP 403")
            if e.code in (502, 503, 540):
                return DbDiagnostic(DbStatus.INACTIVE,
                    "Supabase retornou erro de serviço. O projeto pode estar reiniciando.",
                    can_reactivate=True, raw_error=f"HTTP {e.code}")
            return DbDiagnostic(DbStatus.ERROR,
                f"Supabase retornou HTTP {e.code}.",
                raw_error=str(e))
        except Exception as e:
            return DbDiagnostic(DbStatus.UNREACHABLE,
                f"Não foi possível conectar ao Supabase: {str(e)[:80]}",
                raw_error=str(e))

        return DbDiagnostic(DbStatus.HEALTHY, "Supabase operacional.")

    def reactivate(self, uri: str) -> DbDiagnostic:
        parts = uri.split("|")
        url = parts[0].rstrip("/")
        host = urlparse(url).hostname or ""
        ref = host.split(".")[0]
        return DbDiagnostic(
            DbStatus.INACTIVE,
            f"Para reativar o projeto '{ref}': acesse app.supabase.com → "
            f"selecione o projeto → clique 'Restore project'. Aguarde 1-3 minutos.",
            can_reactivate=False,
            reactivate_hint="Supabase Management API requer token de dashboard, "
                            "não é possível restaurar com a anon/service key.",
        )


class MongoHealthChecker(IDatabaseHealthCheck):

    def diagnose(self, uri: str) -> DbDiagnostic:
        try:
            from pymongo import MongoClient
            from pymongo.errors import (
                ServerSelectionTimeoutError, OperationFailure,
                ConfigurationError, ConnectionFailure,
            )
        except ImportError:
            return DbDiagnostic(DbStatus.ERROR, "pymongo não instalado. Execute: pip install pymongo")

        try:
            client = MongoClient(uri, serverSelectionTimeoutMS=5000)
            client.admin.command("ping")
            client.close()
            return DbDiagnostic(DbStatus.HEALTHY, "MongoDB conectado e operacional.")
        except ServerSelectionTimeoutError as e:
            err = str(e)
            if "Name or service not known" in err or "NXDOMAIN" in err or "getaddrinfo" in err:
                return DbDiagnostic(DbStatus.INACTIVE,
                    "Cluster MongoDB Atlas pode estar pausado por inatividade. "
                    "Acesse cloud.mongodb.com e verifique o status do cluster.",
                    can_reactivate=True,
                    reactivate_hint="Atlas M0 pausa após 60 dias. Clique 'Resume' no dashboard.",
                    raw_error=err[:150])
            return DbDiagnostic(DbStatus.UNREACHABLE,
                "MongoDB não respondeu em 5s. Verifique se o servidor está rodando "
                "e se o IP está liberado no whitelist do Atlas.",
                raw_error=err[:150])
        except OperationFailure as e:
            code = e.code
            if code == 18:
                return DbDiagnostic(DbStatus.BAD_CREDS,
                    "Credencial MongoDB inválida. Verifique usuário e senha na URI.",
                    raw_error=f"OperationFailure code={code}")
            return DbDiagnostic(DbStatus.ERROR,
                f"Erro MongoDB: {str(e)[:80]}",
                raw_error=str(e)[:150])
        except ConfigurationError as e:
            err = str(e)
            if "DNS" in err or "does not exist" in err:
                return DbDiagnostic(DbStatus.INACTIVE,
                    "Cluster MongoDB Atlas não encontrado (DNS). "
                    "Pode estar pausado ou a URI está incorreta.",
                    can_reactivate=True,
                    reactivate_hint="Atlas M0 pausa após 60 dias. Verifique cloud.mongodb.com.",
                    raw_error=err[:150])
            return DbDiagnostic(DbStatus.BAD_CREDS,
                f"URI MongoDB malformada: {err[:80]}",
                raw_error=err[:150])
        except ConnectionFailure as e:
            return DbDiagnostic(DbStatus.UNREACHABLE,
                f"Falha de conexão MongoDB: {str(e)[:80]}",
                raw_error=str(e)[:150])
        except Exception as e:
            return DbDiagnostic(DbStatus.ERROR,
                f"Erro inesperado MongoDB: {str(e)[:80]}",
                raw_error=str(e)[:150])

    def reactivate(self, uri: str) -> DbDiagnostic:
        return DbDiagnostic(DbStatus.INACTIVE,
            "Para reativar MongoDB Atlas: acesse cloud.mongodb.com → "
            "selecione o cluster → clique 'Resume'. Aguarde 1-5 minutos.",
            can_reactivate=False,
            reactivate_hint="Atlas API requer API key com role 'Project Cluster Manager'.")


class MySqlHealthChecker(IDatabaseHealthCheck):

    def diagnose(self, uri: str) -> DbDiagnostic:
        try:
            import pymysql
        except ImportError:
            return DbDiagnostic(DbStatus.ERROR, "pymysql não instalado. Execute: pip install pymysql")

        p = urlparse(uri)
        try:
            conn = pymysql.connect(
                host=p.hostname, port=p.port or 3306,
                user=p.username, password=p.password or "",
                database=p.path.lstrip("/"),
                connect_timeout=5, read_timeout=5,
            )
            conn.ping()
            conn.close()
            return DbDiagnostic(DbStatus.HEALTHY, "MySQL conectado e operacional.")
        except pymysql.err.OperationalError as e:
            code = e.args[0] if e.args else 0
            if code == 2003:
                return DbDiagnostic(DbStatus.UNREACHABLE,
                    f"MySQL não acessível em {p.hostname}:{p.port or 3306}. "
                    "Verifique se o servidor está rodando.",
                    raw_error=str(e)[:150])
            if code == 1045:
                return DbDiagnostic(DbStatus.BAD_CREDS,
                    "Credencial MySQL inválida. Verifique usuário e senha.",
                    raw_error=str(e)[:150])
            if code == 1040:
                return DbDiagnostic(DbStatus.OVERLOADED,
                    "MySQL atingiu limite de conexões. Tente novamente em alguns minutos.",
                    raw_error=str(e)[:150])
            if code in (2006, 2013):
                return DbDiagnostic(DbStatus.UNREACHABLE,
                    "Conexão MySQL perdida. O servidor pode ter caído.",
                    raw_error=str(e)[:150])
            return DbDiagnostic(DbStatus.ERROR,
                f"Erro MySQL ({code}): {str(e)[:80]}",
                raw_error=str(e)[:150])
        except Exception as e:
            return DbDiagnostic(DbStatus.ERROR,
                f"Erro inesperado MySQL: {str(e)[:80]}",
                raw_error=str(e)[:150])

    def reactivate(self, uri: str) -> DbDiagnostic:
        return DbDiagnostic(DbStatus.UNREACHABLE,
            "MySQL não suporta reativação automática. "
            "Verifique se o serviço está rodando: systemctl status mysql",
            can_reactivate=False)


class PostgresHealthChecker(IDatabaseHealthCheck):

    def diagnose(self, uri: str) -> DbDiagnostic:
        try:
            import psycopg2
        except ImportError:
            return DbDiagnostic(DbStatus.ERROR, "psycopg2 não instalado. Execute: pip install psycopg2-binary")

        try:
            conn = psycopg2.connect(uri, connect_timeout=5)
            cur = conn.cursor()
            cur.execute("SELECT 1")
            conn.close()
            return DbDiagnostic(DbStatus.HEALTHY, "PostgreSQL conectado e operacional.")
        except psycopg2.OperationalError as e:
            err = str(e)
            if "password authentication failed" in err:
                return DbDiagnostic(DbStatus.BAD_CREDS,
                    "Credencial PostgreSQL inválida. Verifique usuário e senha.",
                    raw_error=err[:150])
            if "Connection refused" in err or "could not connect" in err:
                return DbDiagnostic(DbStatus.UNREACHABLE,
                    "PostgreSQL não acessível. Verifique se o servidor está rodando.",
                    raw_error=err[:150])
            if "too many connections" in err:
                return DbDiagnostic(DbStatus.OVERLOADED,
                    "PostgreSQL atingiu limite de conexões.",
                    raw_error=err[:150])
            return DbDiagnostic(DbStatus.ERROR,
                f"Erro PostgreSQL: {err[:80]}",
                raw_error=err[:150])
        except Exception as e:
            return DbDiagnostic(DbStatus.ERROR,
                f"Erro inesperado PostgreSQL: {str(e)[:80]}",
                raw_error=str(e)[:150])

    def reactivate(self, uri: str) -> DbDiagnostic:
        return DbDiagnostic(DbStatus.UNREACHABLE,
            "PostgreSQL não suporta reativação automática. "
            "Verifique: systemctl status postgresql",
            can_reactivate=False)


class RedisHealthChecker(IDatabaseHealthCheck):

    def diagnose(self, uri: str) -> DbDiagnostic:
        try:
            import redis as redis_lib
        except ImportError:
            return DbDiagnostic(DbStatus.ERROR, "redis não instalado. Execute: pip install redis")

        try:
            r = redis_lib.from_url(uri, socket_timeout=5)
            r.ping()
            r.close()
            return DbDiagnostic(DbStatus.HEALTHY, "Redis conectado e operacional.")
        except redis_lib.exceptions.ConnectionError as e:
            return DbDiagnostic(DbStatus.UNREACHABLE,
                "Redis não acessível. Verifique se o servidor está rodando.",
                raw_error=str(e)[:150])
        except redis_lib.exceptions.AuthenticationError:
            return DbDiagnostic(DbStatus.BAD_CREDS,
                "Senha Redis inválida (WRONGPASS).",
                raw_error="AuthenticationError")
        except redis_lib.exceptions.ResponseError as e:
            if "MISCONF" in str(e):
                return DbDiagnostic(DbStatus.READ_ONLY,
                    "Redis em modo read-only (MISCONF). Persistência falhou — "
                    "disco cheio ou sem permissão de escrita.",
                    raw_error=str(e)[:150])
            return DbDiagnostic(DbStatus.ERROR,
                f"Erro Redis: {str(e)[:80]}",
                raw_error=str(e)[:150])
        except Exception as e:
            return DbDiagnostic(DbStatus.ERROR,
                f"Erro inesperado Redis: {str(e)[:80]}",
                raw_error=str(e)[:150])

    def reactivate(self, uri: str) -> DbDiagnostic:
        return DbDiagnostic(DbStatus.UNREACHABLE,
            "Redis não suporta reativação automática. "
            "Verifique: systemctl status redis / redis-cli ping",
            can_reactivate=False)


class FirebaseHealthChecker(IDatabaseHealthCheck):

    def diagnose(self, uri: str) -> DbDiagnostic:
        url = uri.rstrip("/")
        host = urlparse(url).hostname or ""

        try:
            socket.getaddrinfo(host, 443, socket.AF_INET, socket.SOCK_STREAM)
        except socket.gaierror:
            return DbDiagnostic(DbStatus.INACTIVE,
                "Projeto Firebase não encontrado (DNS). O projeto pode ter sido deletado.",
                raw_error=f"DNS NXDOMAIN: {host}")

        try:
            req = urllib.request.Request(f"{url}/.json?shallow=true",
                                         headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=10) as resp:
                return DbDiagnostic(DbStatus.HEALTHY, "Firebase Realtime DB acessível e operacional.")
        except urllib.error.HTTPError as e:
            if e.code == 401:
                return DbDiagnostic(DbStatus.BAD_CREDS,
                    "Firebase: permissão negada. As regras de segurança bloqueiam acesso.",
                    raw_error="HTTP 401 Permission denied")
            if e.code == 402:
                return DbDiagnostic(DbStatus.OVERLOADED,
                    "Firebase: quota excedida (plano Spark). Atualize para Blaze.",
                    raw_error="HTTP 402 Quota exceeded")
            if e.code == 404:
                return DbDiagnostic(DbStatus.INACTIVE,
                    "Projeto Firebase desabilitado ou deletado.",
                    raw_error="HTTP 404")
            if e.code == 423:
                return DbDiagnostic(DbStatus.INACTIVE,
                    "Projeto Firebase bloqueado (Locked). Verifique no console Firebase.",
                    can_reactivate=True,
                    reactivate_hint="Acesse console.firebase.google.com e verifique o status.",
                    raw_error="HTTP 423 Locked")
            return DbDiagnostic(DbStatus.ERROR,
                f"Firebase retornou HTTP {e.code}.",
                raw_error=str(e))
        except Exception as e:
            return DbDiagnostic(DbStatus.UNREACHABLE,
                f"Firebase não acessível: {str(e)[:80]}",
                raw_error=str(e)[:150])

    def reactivate(self, uri: str) -> DbDiagnostic:
        return DbDiagnostic(DbStatus.INACTIVE,
            "Acesse console.firebase.google.com para verificar o status do projeto.",
            can_reactivate=False)


_CHECKERS = {
    "MongoDB":    MongoHealthChecker,
    "MySQL":      MySqlHealthChecker,
    "PostgreSQL": PostgresHealthChecker,
    "Redis":      RedisHealthChecker,
    "Firebase":   FirebaseHealthChecker,
    "Supabase":   SupabaseHealthChecker,
}


def get_health_checker(db: str) -> IDatabaseHealthCheck:
    cls = _CHECKERS.get(db)
    if not cls:
        raise ValueError(f"Health checker não disponível para '{db}'")
    return cls()
