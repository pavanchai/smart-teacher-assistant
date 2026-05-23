import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_teacher
from app.database import get_db
from app.models.teacher import Teacher
from app.schemas.section import SectionCreate, SectionDetail, SectionRead
from app.services.section_service import SectionService

router = APIRouter(tags=["sections"])


@router.post(
    "/classes/{class_id}/sections",
    response_model=SectionRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_section(
    class_id: uuid.UUID,
    payload: SectionCreate,
    current_teacher: Teacher = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db),
) -> SectionRead:
    service = SectionService(db)
    return await service.create_section(class_id, current_teacher.school_id, payload)


@router.get("/sections/{section_id}", response_model=SectionDetail)
async def get_section(
    section_id: uuid.UUID,
    current_teacher: Teacher = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db),
) -> SectionDetail:
    service = SectionService(db)
    return await service.get_section_detail(section_id, current_teacher.school_id)
