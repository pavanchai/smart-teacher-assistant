import uuid

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.class_ import Class
from app.repositories.class_repo import ClassRepository
from app.schemas.class_ import ClassCreate, ClassRead


class ClassService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.repo = ClassRepository(db)

    async def list_classes(self, school_id: uuid.UUID) -> list[ClassRead]:
        classes = await self.repo.get_by_school(school_id)
        return [ClassRead.model_validate(c) for c in classes]

    async def create_class(self, school_id: uuid.UUID, payload: ClassCreate) -> ClassRead:
        existing = await self.repo.get_by_school_and_name(school_id, payload.name)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Class '{payload.name}' already exists in this school",
            )
        new_class = Class(school_id=school_id, name=payload.name)
        created = await self.repo.create(new_class)
        return ClassRead.model_validate(created)

    async def get_class_for_school(self, class_id: uuid.UUID, school_id: uuid.UUID) -> Class:
        class_ = await self.repo.get_by_id(class_id)
        if not class_ or class_.school_id != school_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Class not found")
        return class_

    async def get_by_id(self, class_id: uuid.UUID) -> Class | None:
        return await self.repo.get_by_id(class_id)
