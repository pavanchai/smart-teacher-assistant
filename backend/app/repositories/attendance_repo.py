import uuid
from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.attendance import AttendanceRecord, AttendanceSession


class AttendanceRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_session_by_id(self, session_id: uuid.UUID) -> AttendanceSession | None:
        result = await self.db.execute(
            select(AttendanceSession).where(AttendanceSession.id == session_id)
        )
        return result.scalar_one_or_none()

    async def get_session_with_records(self, session_id: uuid.UUID) -> AttendanceSession | None:
        result = await self.db.execute(
            select(AttendanceSession)
            .options(selectinload(AttendanceSession.records))
            .where(AttendanceSession.id == session_id)
        )
        return result.scalar_one_or_none()

    async def get_session_by_section_and_date(
        self, section_id: uuid.UUID, session_date: date
    ) -> AttendanceSession | None:
        result = await self.db.execute(
            select(AttendanceSession).where(
                AttendanceSession.section_id == section_id,
                AttendanceSession.date == session_date,
            )
        )
        return result.scalar_one_or_none()

    async def get_sessions_by_section(self, section_id: uuid.UUID) -> list[AttendanceSession]:
        result = await self.db.execute(
            select(AttendanceSession)
            .where(AttendanceSession.section_id == section_id)
            .order_by(AttendanceSession.date.desc())
        )
        return list(result.scalars().all())

    async def create_session(self, session: AttendanceSession) -> AttendanceSession:
        self.db.add(session)
        await self.db.commit()
        await self.db.refresh(session)
        return session

    async def get_record_by_session_and_student(
        self, session_id: uuid.UUID, student_id: uuid.UUID
    ) -> AttendanceRecord | None:
        result = await self.db.execute(
            select(AttendanceRecord).where(
                AttendanceRecord.session_id == session_id,
                AttendanceRecord.student_id == student_id,
            )
        )
        return result.scalar_one_or_none()

    async def upsert_records(
        self,
        session_id: uuid.UUID,
        records_data: list[dict],
    ) -> list[AttendanceRecord]:
        upserted = []
        for data in records_data:
            existing = await self.get_record_by_session_and_student(session_id, data["student_id"])
            if existing:
                existing.status = data["status"]
                existing.marked_by = data["marked_by"]
                upserted.append(existing)
            else:
                record = AttendanceRecord(
                    session_id=session_id,
                    student_id=data["student_id"],
                    status=data["status"],
                    marked_by=data["marked_by"],
                )
                self.db.add(record)
                upserted.append(record)
        await self.db.commit()
        for record in upserted:
            await self.db.refresh(record)
        return upserted

    async def create_records(self, records: list[AttendanceRecord]) -> list[AttendanceRecord]:
        for record in records:
            self.db.add(record)
        await self.db.commit()
        for record in records:
            await self.db.refresh(record)
        return records

    async def update_session(self, session: AttendanceSession) -> AttendanceSession:
        await self.db.commit()
        await self.db.refresh(session)
        return session
