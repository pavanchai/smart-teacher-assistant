import uuid

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.section import Section
from app.repositories.section_repo import SectionRepository
from app.schemas.section import SectionCreate, SectionDetail, SectionRead
from app.services.class_service import ClassService


class SectionService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.repo = SectionRepository(db)
        self.class_service = ClassService(db)

    async def list_sections(self, class_id: uuid.UUID, school_id: uuid.UUID) -> list[SectionRead]:
        await self.class_service.get_class_for_school(class_id, school_id)
        sections = await self.repo.get_by_class(class_id)
        return [SectionRead.model_validate(s) for s in sections]

    async def create_section(
        self, class_id: uuid.UUID, school_id: uuid.UUID, payload: SectionCreate
    ) -> SectionRead:
        await self.class_service.get_class_for_school(class_id, school_id)
        existing = await self.repo.get_by_class_and_name(class_id, payload.name)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Section '{payload.name}' already exists in this class",
            )
        new_section = Section(class_id=class_id, name=payload.name)
        created = await self.repo.create(new_section)
        return SectionRead.model_validate(created)

    async def get_section_detail(self, section_id: uuid.UUID, school_id: uuid.UUID) -> SectionDetail:
        section = await self._get_section_for_school(section_id, school_id)
        count = await self.repo.get_student_count(section_id)
        return SectionDetail(
            id=section.id,
            class_id=section.class_id,
            name=section.name,
            created_at=section.created_at,
            student_count=count,
        )

    async def get_section_for_school(self, section_id: uuid.UUID, school_id: uuid.UUID) -> Section:
        return await self._get_section_for_school(section_id, school_id)

    async def _get_section_for_school(self, section_id: uuid.UUID, school_id: uuid.UUID) -> Section:
        section = await self.repo.get_by_id(section_id)
        if not section:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Section not found")
        class_ = await self.class_service.get_by_id(section.class_id)
        if class_ is None or class_.school_id != school_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Section not found")
        return section
