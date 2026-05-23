import uuid
from datetime import date, datetime

from pydantic import BaseModel

from app.models.attendance import AttendanceMode, MarkedBy, RecordStatus, SessionStatus


class SessionCreate(BaseModel):
    date: date
    mode: AttendanceMode


class RecordUpsert(BaseModel):
    student_id: uuid.UUID
    status: RecordStatus
    marked_by: MarkedBy


class BulkRecordUpsert(BaseModel):
    records: list[RecordUpsert]


class AttendanceRecordRead(BaseModel):
    id: uuid.UUID
    session_id: uuid.UUID
    student_id: uuid.UUID
    status: RecordStatus
    marked_by: MarkedBy
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AttendanceSessionRead(BaseModel):
    id: uuid.UUID
    section_id: uuid.UUID
    teacher_id: uuid.UUID
    date: date
    mode: AttendanceMode
    status: SessionStatus
    created_at: datetime
    submitted_at: datetime | None

    model_config = {"from_attributes": True}


class AttendanceSessionDetail(AttendanceSessionRead):
    records: list[AttendanceRecordRead]
