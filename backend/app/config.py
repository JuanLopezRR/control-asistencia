import os
from functools import lru_cache


class Settings:
    APP_ENV: str = os.getenv("APP_ENV", "development")

    @property
    def DATABASE_URL(self) -> str:
        if self.APP_ENV == "production":
            return os.getenv(
                "DATABASE_URL",
                "postgresql://postgres:password@localhost:5432/control_as"
            )
        base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        return f"sqlite:///{os.path.join(base, 'attendance.db')}"

    @property
    def API_HOST(self) -> str:
        return os.getenv("API_HOST", "0.0.0.0")

    @property
    def API_PORT(self) -> int:
        return int(os.getenv("API_PORT", "8000"))


@lru_cache
def get_settings():
    return Settings()
