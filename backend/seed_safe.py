"""
Idempotent seed — runs on every container start, skips if demo data already exists.
"""
import asyncio

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings
from app.core.security import hash_password
from app.models.school import School
from app.models.teacher import Teacher
from app.models.class_ import Class
from app.models.section import Section
from app.models.student import Student
import app.models  # noqa: F401


async def seed() -> None:
    from app.database import _build_connect_args
    engine = create_async_engine(settings.DATABASE_URL, echo=False, connect_args=_build_connect_args())
    session_factory = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)

    async with session_factory() as db:
        # Skip if already seeded
        existing = await db.scalar(select(Teacher).where(Teacher.email == "teacher@demo.com"))
        if existing:
            print("Demo data already present, skipping seed.")
            await engine.dispose()
            return

        school = School(name="Demo School")
        db.add(school)
        await db.flush()

        teacher = Teacher(
            school_id=school.id,
            email="teacher@demo.com",
            hashed_password=hash_password("password123"),
            full_name="Demo Teacher",
            is_active=True,
        )
        db.add(teacher)
        await db.flush()

        grade10 = Class(school_id=school.id, name="Grade 10")
        db.add(grade10)
        await db.flush()

        section_a = Section(class_id=grade10.id, name="A")
        section_b = Section(class_id=grade10.id, name="B")
        db.add(section_a)
        db.add(section_b)
        await db.flush()

        students_a = [
            Student(section_id=section_a.id, roll_number="10A01", full_name="Arjun Sharma"),
            Student(section_id=section_a.id, roll_number="10A02", full_name="Priya Patel"),
            Student(section_id=section_a.id, roll_number="10A03", full_name="Rohan Mehta"),
            Student(section_id=section_a.id, roll_number="10A04", full_name="Sneha Reddy"),
            Student(section_id=section_a.id, roll_number="10A05", full_name="Vikram Singh"),
        ]
        students_b = [
            Student(section_id=section_b.id, roll_number="10B01", full_name="Ananya Iyer"),
            Student(section_id=section_b.id, roll_number="10B02", full_name="Rahul Gupta"),
            Student(section_id=section_b.id, roll_number="10B03", full_name="Kavya Nair"),
            Student(section_id=section_b.id, roll_number="10B04", full_name="Aditya Joshi"),
            Student(section_id=section_b.id, roll_number="10B05", full_name="Pooja Verma"),
        ]

        for s in students_a + students_b:
            db.add(s)

        await db.commit()
        print("Demo data seeded successfully.")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed())
