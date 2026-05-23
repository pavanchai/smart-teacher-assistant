from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.config import settings

import ssl as _ssl

def _make_ssl_ctx() -> _ssl.SSLContext:
    ctx = _ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = _ssl.CERT_NONE
    return ctx

_connect_args = (
    {"ssl": False} if "railway.internal" in settings.DATABASE_URL
    else {"ssl": _make_ssl_ctx()}
)
engine = create_async_engine(settings.DATABASE_URL, echo=False, future=True, connect_args=_connect_args)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        yield session
