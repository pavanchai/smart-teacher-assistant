import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.teacher import Teacher


class TeacherRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_by_id(self, teacher_id: uuid.UUID) -> Teacher | None:
        result = await self.db.execute(select(Teacher).where(Teacher.id == teacher_id))
        return result.scalar_one_or_none()

    async def get_by_email(self, email: str) -> Teacher | None:
        result = await self.db.execute(select(Teacher).where(Teacher.email == email))
        return result.scalar_one_or_none()

    async def create(self, teacher: Teacher) -> Teacher:
        self.db.add(teacher)
        await self.db.commit()
        await self.db.refresh(teacher)
        return teacher
