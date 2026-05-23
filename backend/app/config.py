from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/attendance_db"
    SECRET_KEY: str = "dev-secret-key-change-in-production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    ALGORITHM: str = "HS256"

    def model_post_init(self, __context: object) -> None:
        # Railway injects postgresql:// but SQLAlchemy async needs postgresql+asyncpg://
        # Railway Postgres also requires SSL
        if self.DATABASE_URL.startswith("postgresql://"):
            url = self.DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)
            if "ssl=" not in url and "sslmode=" not in url:
                url += "?ssl=require"
            object.__setattr__(self, "DATABASE_URL", url)


settings = Settings()
