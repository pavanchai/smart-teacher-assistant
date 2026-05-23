import io
import uuid

import pandas as pd
from fastapi import HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.student import Student
from app.repositories.student_repo import StudentRepository
from app.schemas.student import BulkUploadResult, StudentCreate, StudentRead, StudentUpdate
from app.services.section_service import SectionService


class StudentService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.repo = StudentRepository(db)
        self.section_service = SectionService(db)

    async def list_students(self, section_id: uuid.UUID, school_id: uuid.UUID) -> list[StudentRead]:
        await self.section_service.get_section_for_school(section_id, school_id)
        students = await self.repo.get_by_section(section_id)
        return [StudentRead.model_validate(s) for s in students]

    async def create_student(
        self, section_id: uuid.UUID, school_id: uuid.UUID, payload: StudentCreate
    ) -> StudentRead:
        await self.section_service.get_section_for_school(section_id, school_id)
        existing = await self.repo.get_by_section_and_roll(section_id, payload.roll_number)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Roll number '{payload.roll_number}' already exists in this section",
            )
        student = Student(
            section_id=section_id,
            roll_number=payload.roll_number,
            full_name=payload.full_name,
        )
        created = await self.repo.create(student)
        return StudentRead.model_validate(created)

    async def bulk_upload_students(
        self, section_id: uuid.UUID, school_id: uuid.UUID, file: UploadFile
    ) -> BulkUploadResult:
        await self.section_service.get_section_for_school(section_id, school_id)

        content = await file.read()
        errors: list[str] = []

        try:
            filename = file.filename or ""
            if filename.endswith(".csv"):
                df = pd.read_csv(io.BytesIO(content), dtype=str)
            elif filename.endswith((".xlsx", ".xls")):
                df = pd.read_excel(io.BytesIO(content), dtype=str)
            else:
                df = pd.read_csv(io.BytesIO(content), dtype=str)
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Could not parse file: {exc}",
            )

        required_cols = {"roll_number", "full_name"}
        missing = required_cols - set(df.columns.str.strip().str.lower())
        if missing:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Missing required columns: {missing}",
            )

        df.columns = df.columns.str.strip().str.lower()
        df = df[["roll_number", "full_name"]].dropna(how="all")

        created_count = 0
        skipped_count = 0
        to_create: list[Student] = []

        for idx, row in df.iterrows():
            roll = str(row["roll_number"]).strip()
            name = str(row["full_name"]).strip()

            if not roll or roll == "nan":
                errors.append(f"Row {idx + 2}: missing roll_number")
                continue
            if not name or name == "nan":
                errors.append(f"Row {idx + 2}: missing full_name")
                continue

            existing = await self.repo.get_by_section_and_roll(section_id, roll)
            if existing:
                skipped_count += 1
                continue

            to_create.append(Student(section_id=section_id, roll_number=roll, full_name=name))

        if to_create:
            await self.repo.create_many(to_create)
            created_count = len(to_create)

        return BulkUploadResult(created=created_count, skipped=skipped_count, errors=errors)

    async def update_student(
        self, student_id: uuid.UUID, school_id: uuid.UUID, payload: StudentUpdate
    ) -> StudentRead:
        student = await self._get_student_for_school(student_id, school_id)

        if payload.roll_number is not None:
            existing = await self.repo.get_by_section_and_roll(student.section_id, payload.roll_number)
            if existing and existing.id != student.id:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Roll number '{payload.roll_number}' already exists in this section",
                )
            student.roll_number = payload.roll_number

        if payload.full_name is not None:
            student.full_name = payload.full_name

        updated = await self.repo.update(student)
        return StudentRead.model_validate(updated)

    async def delete_student(self, student_id: uuid.UUID, school_id: uuid.UUID) -> None:
        student = await self._get_student_for_school(student_id, school_id)
        student.is_active = False
        await self.repo.update(student)

    async def _get_student_for_school(self, student_id: uuid.UUID, school_id: uuid.UUID) -> Student:
        student = await self.repo.get_by_id(student_id)
        if not student:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")
        section = await self.section_service.repo.get_by_id(student.section_id)
        if not section:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")
        from app.repositories.class_repo import ClassRepository
        class_repo = ClassRepository(self.db)
        class_ = await class_repo.get_by_id(section.class_id)
        if not class_ or class_.school_id != school_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")
        return student
