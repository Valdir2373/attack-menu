import json
import os
import sys
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Any, Dict, Optional


class LogLevel(Enum):
    DEBUG = "DEBUG"
    INFO  = "INFO"
    WARN  = "WARN"
    ERROR = "ERROR"


def _resolve_log_path() -> Path:
    var_log = Path("/var/log/attackmenu.jsonl")
    try:
        var_log.parent.mkdir(parents=True, exist_ok=True)
        var_log.touch(exist_ok=True)
        return var_log
    except OSError:
        fallback = Path("./logs/attackmenu.jsonl")
        fallback.parent.mkdir(parents=True, exist_ok=True)
        return fallback


_LOG_PATH: Path = _resolve_log_path()


class Logger:

    COLORS = {
        LogLevel.DEBUG: "\033[90m",
        LogLevel.INFO:  "\033[36m",
        LogLevel.WARN:  "\033[33m",
        LogLevel.ERROR: "\033[31m",
    }
    RESET = "\033[0m"

    def __init__(self, context: str = "App", debug: bool = False) -> None:
        self.context = context
        self._debug = debug

    @staticmethod
    def to_json(
        level: LogLevel,
        message: str,
        context: str,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> str:
        entry: Dict[str, Any] = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": level.value,
            "service": "python",
            "context": context,
            "message": message,
        }
        if metadata:
            entry["metadata"] = metadata
        return json.dumps(entry, ensure_ascii=False)

    def _write_json(self, level: LogLevel, message: str, metadata: Optional[Dict[str, Any]] = None) -> None:
        try:
            line = self.to_json(level, message, self.context, metadata)
            with open(_LOG_PATH, "a", encoding="utf-8") as f:
                f.write(line + "\n")
        except OSError:
            pass

    def _log(self, level: LogLevel, message: str, metadata: Optional[Dict[str, Any]] = None) -> None:
        if level == LogLevel.DEBUG and not self._debug:
            return
        ts    = datetime.now(timezone.utc).strftime("%H:%M:%S")
        color = self.COLORS[level]
        line  = f"{color}[{ts}] [{level.value}] [{self.context}] {message}{self.RESET}"
        stream = sys.stderr if level == LogLevel.ERROR else sys.stdout
        print(line, file=stream, flush=True)
        self._write_json(level, message, metadata)

    def debug(self, message: str, metadata: Optional[Dict[str, Any]] = None) -> None:
        self._log(LogLevel.DEBUG, message, metadata)

    def info(self, message: str, metadata: Optional[Dict[str, Any]] = None) -> None:
        self._log(LogLevel.INFO, message, metadata)

    def warn(self, message: str, metadata: Optional[Dict[str, Any]] = None) -> None:
        self._log(LogLevel.WARN, message, metadata)

    def error(self, message: str, metadata: Optional[Dict[str, Any]] = None) -> None:
        self._log(LogLevel.ERROR, message, metadata)

    def child(self, context: str) -> "Logger":
        return Logger(context=f"{self.context}:{context}", debug=self._debug)
