import uuid

from fastapi import APIRouter, Depends, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_teacher
from app.database import get_db
from app.models.teacher import Teacher
from app.schemas.student import BulkUploadResult, StudentCreate, StudentRead, StudentUpdate
from app.services.student_service import StudentService

router = APIRouter(tags=["students"])


@router.get("/sections/{section_id}/students", response_model=list[StudentRead])
async def list_students(
    section_id: uuid.UUID,
    current_teacher: Teacher = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db),
) -> list[StudentRead]:
    service = StudentService(db)
    return await service.list_students(section_id, current_teacher.school_id)


@router.post(
    "/sections/{section_id}/students",
    response_model=StudentRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_student(
    section_id: uuid.UUID,
    payload: StudentCreate,
    current_teacher: Teacher = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db),
) -> StudentRead:
    service = StudentService(db)
    return await service.create_student(section_id, current_teacher.school_id, payload)


@router.post(
    "/sections/{section_id}/students/bulk",
    response_model=BulkUploadResult,
    status_code=status.HTTP_201_CREATED,
)
async def bulk_upload_students(
    section_id: uuid.UUID,
    file: UploadFile,
    current_teacher: Teacher = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db),
) -> BulkUploadResult:
    service = StudentService(db)
    return await service.bulk_upload_students(section_id, current_teacher.school_id, file)


@router.put("/students/{student_id}", response_model=StudentRead)
async def update_student(
    student_id: uuid.UUID,
    payload: StudentUpdate,
    current_teacher: Teacher = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db),
) -> StudentRead:
    service = StudentService(db)
    return await service.update_student(student_id, current_teacher.school_id, payload)


@router.delete("/students/{student_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_student(
    student_id: uuid.UUID,
    current_teacher: Teacher = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db),
) -> None:
    service = StudentService(db)
    await service.delete_student(student_id, current_teacher.school_id)
