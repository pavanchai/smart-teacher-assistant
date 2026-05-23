import uuid

from fastapi import APIRouter, Depends, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_teacher
from app.database import get_db
from app.models.teacher import Teacher
from app.schemas.attendance import (
    AttendanceSessionDetail,
    AttendanceSessionRead,
    BulkRecordUpsert,
    SessionCreate,
)
from app.services.attendance_service import AttendanceService

router = APIRouter(tags=["attendance"])


@router.post(
    "/sections/{section_id}/sessions",
    response_model=AttendanceSessionRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_session(
    section_id: uuid.UUID,
    payload: SessionCreate,
    current_teacher: Teacher = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db),
) -> AttendanceSessionRead:
    service = AttendanceService(db)
    return await service.create_session(section_id, current_teacher.school_id, current_teacher.id, payload)


@router.get("/sections/{section_id}/sessions", response_model=list[AttendanceSessionRead])
async def list_sessions(
    section_id: uuid.UUID,
    current_teacher: Teacher = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db),
) -> list[AttendanceSessionRead]:
    service = AttendanceService(db)
    return await service.list_sessions(section_id, current_teacher.school_id)


@router.get("/sessions/{session_id}", response_model=AttendanceSessionDetail)
async def get_session(
    session_id: uuid.UUID,
    current_teacher: Teacher = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db),
) -> AttendanceSessionDetail:
    service = AttendanceService(db)
    return await service.get_session(session_id, current_teacher.school_id)


@router.put("/sessions/{session_id}/records", response_model=AttendanceSessionDetail)
async def upsert_records(
    session_id: uuid.UUID,
    payload: BulkRecordUpsert,
    current_teacher: Teacher = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db),
) -> AttendanceSessionDetail:
    service = AttendanceService(db)
    return await service.upsert_records(session_id, current_teacher.school_id, payload)


@router.post("/sessions/{session_id}/submit", response_model=AttendanceSessionDetail)
async def submit_session(
    session_id: uuid.UUID,
    current_teacher: Teacher = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db),
) -> AttendanceSessionDetail:
    service = AttendanceService(db)
    return await service.submit_session(session_id, current_teacher.school_id)


@router.get("/sessions/{session_id}/export")
async def export_session(
    session_id: uuid.UUID,
    current_teacher: Teacher = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    service = AttendanceService(db)
    csv_content = await service.export_session_csv(session_id, current_teacher.school_id)

    import io
    return StreamingResponse(
        io.StringIO(csv_content),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=attendance_{session_id}.csv"},
    )
