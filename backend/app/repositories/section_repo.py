import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.section import Section
from app.models.student import Student


class SectionRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_by_id(self, section_id: uuid.UUID) -> Section | None:
        result = await self.db.execute(select(Section).where(Section.id == section_id))
        return result.scalar_one_or_none()

    async def get_by_class(self, class_id: uuid.UUID) -> list[Section]:
        result = await self.db.execute(
            select(Section).where(Section.class_id == class_id).order_by(Section.name)
        )
        return list(result.scalars().all())

    async def get_by_class_and_name(self, class_id: uuid.UUID, name: str) -> Section | None:
        result = await self.db.execute(
            select(Section).where(Section.class_id == class_id, Section.name == name)
        )
        return result.scalar_one_or_none()

    async def get_student_count(self, section_id: uuid.UUID) -> int:
        result = await self.db.execute(
            select(func.count(Student.id)).where(
                Student.section_id == section_id, Student.is_active.is_(True)
            )
        )
        return result.scalar_one()

    async def create(self, section: Section) -> Section:
        self.db.add(section)
        await self.db.commit()
        await self.db.refresh(section)
        return section
