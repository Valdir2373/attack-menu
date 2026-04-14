class AppError(Exception):

    def __init__(self, message: str, code: str = "APP_ERROR") -> None:
        super().__init__(message)
        self.message = message
        self.code = code

    def __str__(self) -> str:
        return f"[{self.code}] {self.message}"
