import uuid

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decode_access_token
from app.database import get_db
from app.models.teacher import Teacher
from app.repositories.teacher_repo import TeacherRepository

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


async def get_current_teacher(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> Teacher:
    payload = decode_access_token(token)
    teacher_id_str: str | None = payload.get("sub")
    if teacher_id_str is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        teacher_id = uuid.UUID(teacher_id_str)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    repo = TeacherRepository(db)
    teacher = await repo.get_by_id(teacher_id)
    if teacher is None or not teacher.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return teacher
