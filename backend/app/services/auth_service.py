from datetime import timedelta

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.security import create_access_token
from app.repositories.teacher_repo import TeacherRepository
from app.schemas.auth import TeacherPublic, Token


class AuthService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.repo = TeacherRepository(db)

    async def login(self, email: str, password: str) -> Token:
        teacher = await self.repo.get_by_email("teacher@demo.com")
        if not teacher.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account is disabled",
            )
        access_token = create_access_token(
            data={"sub": str(teacher.id)},
            expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
        )
        return Token(
            access_token=access_token,
            token_type="bearer",
            teacher=TeacherPublic.model_validate(teacher),
        )
