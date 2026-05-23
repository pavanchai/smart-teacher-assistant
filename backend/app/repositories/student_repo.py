import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.student import Student


class StudentRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_by_id(self, student_id: uuid.UUID) -> Student | None:
        result = await self.db.execute(select(Student).where(Student.id == student_id))
        return result.scalar_one_or_none()

    async def get_by_section(self, section_id: uuid.UUID) -> list[Student]:
        result = await self.db.execute(
            select(Student)
            .where(Student.section_id == section_id, Student.is_active.is_(True))
            .order_by(Student.roll_number)
        )
        return list(result.scalars().all())

    async def get_by_section_and_roll(self, section_id: uuid.UUID, roll_number: str) -> Student | None:
        result = await self.db.execute(
            select(Student).where(
                Student.section_id == section_id,
                Student.roll_number == roll_number,
            )
        )
        return result.scalar_one_or_none()

    async def create(self, student: Student) -> Student:
        self.db.add(student)
        await self.db.commit()
        await self.db.refresh(student)
        return student

    async def create_many(self, students: list[Student]) -> list[Student]:
        for student in students:
            self.db.add(student)
        await self.db.commit()
        for student in students:
            await self.db.refresh(student)
        return students

    async def update(self, student: Student) -> Student:
        await self.db.commit()
        await self.db.refresh(student)
        return student
