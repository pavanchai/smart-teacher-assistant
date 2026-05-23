import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.class_ import Class


class ClassRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_by_id(self, class_id: uuid.UUID) -> Class | None:
        result = await self.db.execute(select(Class).where(Class.id == class_id))
        return result.scalar_one_or_none()

    async def get_by_school(self, school_id: uuid.UUID) -> list[Class]:
        result = await self.db.execute(
            select(Class).where(Class.school_id == school_id).order_by(Class.name)
        )
        return list(result.scalars().all())

    async def get_by_school_and_name(self, school_id: uuid.UUID, name: str) -> Class | None:
        result = await self.db.execute(
            select(Class).where(Class.school_id == school_id, Class.name == name)
        )
        return result.scalar_one_or_none()

    async def create(self, class_: Class) -> Class:
        self.db.add(class_)
        await self.db.commit()
        await self.db.refresh(class_)
        return class_
