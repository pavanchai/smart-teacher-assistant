import csv
import io
import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.attendance import AttendanceRecord, AttendanceSession, MarkedBy, RecordStatus, SessionStatus
from app.repositories.attendance_repo import AttendanceRepository
from app.repositories.student_repo import StudentRepository
from app.schemas.attendance import (
    AttendanceSessionDetail,
    AttendanceSessionRead,
    BulkRecordUpsert,
    SessionCreate,
)
from app.services.section_service import SectionService


class AttendanceService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.repo = AttendanceRepository(db)
        self.section_service = SectionService(db)
        self.student_repo = StudentRepository(db)

    async def create_session(
        self, section_id: uuid.UUID, school_id: uuid.UUID, teacher_id: uuid.UUID, payload: SessionCreate
    ) -> AttendanceSessionRead:
        await self.section_service.get_section_for_school(section_id, school_id)

        existing = await self.repo.get_session_by_section_and_date(section_id, payload.date)
        if existing:
            if existing.status == SessionStatus.in_progress:
                return AttendanceSessionRead.model_validate(existing)
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A submitted session already exists for this date",
            )

        session = AttendanceSession(
            section_id=section_id,
            teacher_id=teacher_id,
            date=payload.date,
            mode=payload.mode,
            status=SessionStatus.in_progress,
        )
        created = await self.repo.create_session(session)
        return AttendanceSessionRead.model_validate(created)

    async def list_sessions(
        self, section_id: uuid.UUID, school_id: uuid.UUID
    ) -> list[AttendanceSessionRead]:
        await self.section_service.get_section_for_school(section_id, school_id)
        sessions = await self.repo.get_sessions_by_section(section_id)
        return [AttendanceSessionRead.model_validate(s) for s in sessions]

    async def get_session(
        self, session_id: uuid.UUID, school_id: uuid.UUID
    ) -> AttendanceSessionDetail:
        session = await self.repo.get_session_with_records(session_id)
        if not session:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
        await self.section_service.get_section_for_school(session.section_id, school_id)
        return AttendanceSessionDetail.model_validate(session)

    async def upsert_records(
        self, session_id: uuid.UUID, school_id: uuid.UUID, payload: BulkRecordUpsert
    ) -> AttendanceSessionDetail:
        session = await self.repo.get_session_by_id(session_id)
        if not session:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
        await self.section_service.get_section_for_school(session.section_id, school_id)

        if session.status == SessionStatus.submitted:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Cannot modify a submitted session",
            )

        records_data = [
            {
                "student_id": r.student_id,
                "status": r.status,
                "marked_by": r.marked_by,
            }
            for r in payload.records
        ]
        await self.repo.upsert_records(session_id, records_data)
        return await self.get_session(session_id, school_id)

    async def submit_session(
        self, session_id: uuid.UUID, school_id: uuid.UUID
    ) -> AttendanceSessionDetail:
        session = await self.repo.get_session_with_records(session_id)
        if not session:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
        await self.section_service.get_section_for_school(session.section_id, school_id)

        if session.status == SessionStatus.submitted:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Session is already submitted",
            )

        all_students = await self.student_repo.get_by_section(session.section_id)
        marked_ids = {r.student_id for r in session.records}
        unmarked = [s for s in all_students if s.id not in marked_ids]

        if unmarked:
            absent_records = []
            for student in unmarked:
                absent_records.append(
                    AttendanceRecord(
                        session_id=session_id,
                        student_id=student.id,
                        status=RecordStatus.absent,
                        marked_by=MarkedBy.manual,
                    )
                )
            await self.repo.create_records(absent_records)

        session.status = SessionStatus.submitted
        session.submitted_at = datetime.now(timezone.utc)
        await self.repo.update_session(session)

        return await self.get_session(session_id, school_id)

    async def export_session_csv(self, session_id: uuid.UUID, school_id: uuid.UUID) -> str:
        from sqlalchemy import select
        from app.models.student import Student

        detail = await self.get_session(session_id, school_id)

        student_ids = [r.student_id for r in detail.records]
        student_map: dict[uuid.UUID, tuple[str, str]] = {}
        if student_ids:
            result = await self.db.execute(
                select(Student).where(Student.id.in_(student_ids))
            )
            for s in result.scalars().all():
                student_map[s.id] = (s.roll_number, s.full_name)

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["roll_number", "full_name", "status", "marked_by"])

        for record in sorted(
            detail.records,
            key=lambda r: student_map.get(r.student_id, ("", ""))[0],
        ):
            roll, name = student_map.get(record.student_id, ("", ""))
            writer.writerow([roll, name, record.status.value, record.marked_by.value])

        return output.getvalue()
