import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_teacher
from app.database import get_db
from app.models.teacher import Teacher
from app.schemas.class_ import ClassCreate, ClassRead
from app.schemas.section import SectionRead
from app.services.class_service import ClassService
from app.services.section_service import SectionService

router = APIRouter(prefix="/classes", tags=["classes"])


@router.get("", response_model=list[ClassRead])
async def list_classes(
    current_teacher: Teacher = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db),
) -> list[ClassRead]:
    service = ClassService(db)
    return await service.list_classes(current_teacher.school_id)


@router.post("", response_model=ClassRead, status_code=status.HTTP_201_CREATED)
async def create_class(
    payload: ClassCreate,
    current_teacher: Teacher = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db),
) -> ClassRead:
    service = ClassService(db)
    return await service.create_class(current_teacher.school_id, payload)


@router.get("/{class_id}/sections", response_model=list[SectionRead])
async def list_sections_for_class(
    class_id: uuid.UUID,
    current_teacher: Teacher = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db),
) -> list[SectionRead]:
    service = SectionService(db)
    return await service.list_sections(class_id, current_teacher.school_id)
