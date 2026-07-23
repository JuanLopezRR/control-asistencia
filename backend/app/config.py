import os
from functools import lru_cache
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"))


class Settings:
    APP_ENV: str = os.getenv("APP_ENV", "development")

    @property
    def DATABASE_URL(self) -> str:
        supabase_url = os.getenv("SUPABASE_URL", "")
        database_url = os.getenv("DATABASE_URL", "")
        
        if supabase_url:
            return supabase_url
        if database_url:
            return database_url
        
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
