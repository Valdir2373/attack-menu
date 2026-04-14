from infra.errors.BaseError import AppError


class NotFoundError(AppError):
    def __init__(self, resource: str, identifier: str = "") -> None:
        msg = f"{resource} não encontrado" + (f": {identifier}" if identifier else "")
        super().__init__(msg, "NOT_FOUND")


class ValidationError(AppError):
    def __init__(self, message: str) -> None:
        super().__init__(message, "VALIDATION_ERROR")


class ConnectionError(AppError):
    def __init__(self, message: str) -> None:
        super().__init__(message, "CONNECTION_ERROR")


class ConfigError(AppError):
    def __init__(self, message: str) -> None:
        super().__init__(message, "CONFIG_ERROR")


class UnauthorizedError(AppError):
    def __init__(self, message: str = "Não autorizado") -> None:
        super().__init__(message, "UNAUTHORIZED")
