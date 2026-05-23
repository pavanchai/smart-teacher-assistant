from fastapi import APIRouter, Depends
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_teacher
from app.database import get_db
from app.models.teacher import Teacher
from app.schemas.auth import TeacherPublic, Token
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=Token)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
) -> Token:
    service = AuthService(db)
    return await service.login(form_data.username, form_data.password)


@router.get("/me", response_model=TeacherPublic)
async def get_me(current_teacher: Teacher = Depends(get_current_teacher)) -> TeacherPublic:
    return TeacherPublic.model_validate(current_teacher)
