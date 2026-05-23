import enum
import uuid
from datetime import date, datetime, timezone

from sqlalchemy import Date, DateTime, Enum, ForeignKey, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class AttendanceMode(str, enum.Enum):
    voice = "voice"
    camera = "camera"
    manual = "manual"


class SessionStatus(str, enum.Enum):
    in_progress = "in_progress"
    submitted = "submitted"


class RecordStatus(str, enum.Enum):
    present = "present"
    absent = "absent"
    late = "late"


class MarkedBy(str, enum.Enum):
    voice = "voice"
    manual = "manual"


class AttendanceSession(Base):
    __tablename__ = "attendance_sessions"

    __table_args__ = (UniqueConstraint("section_id", "date", name="uq_session_section_date"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    section_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("sections.id"), nullable=False)
    teacher_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("teachers.id"), nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    mode: Mapped[AttendanceMode] = mapped_column(Enum(AttendanceMode), nullable=False)
    status: Mapped[SessionStatus] = mapped_column(
        Enum(SessionStatus), nullable=False, default=SessionStatus.in_progress
    )
    created_at: Mapped[datetime] = mapped_column(default=lambda: datetime.utcnow(), server_default=func.now())
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    section: Mapped["Section"] = relationship("Section", back_populates="sessions")
    teacher: Mapped["Teacher"] = relationship("Teacher", back_populates="sessions")
    records: Mapped[list["AttendanceRecord"]] = relationship(
        "AttendanceRecord", back_populates="session", cascade="all, delete-orphan"
    )


class AttendanceRecord(Base):
    __tablename__ = "attendance_records"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("attendance_sessions.id"), nullable=False)
    student_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("students.id"), nullable=False)
    status: Mapped[RecordStatus] = mapped_column(Enum(RecordStatus), nullable=False)
    marked_by: Mapped[MarkedBy] = mapped_column(Enum(MarkedBy), nullable=False)
    created_at: Mapped[datetime] = mapped_column(default=lambda: datetime.utcnow(), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        default=lambda: datetime.utcnow(),
        onupdate=lambda: datetime.utcnow(),
        server_default=func.now(),
    )

    session: Mapped["AttendanceSession"] = relationship("AttendanceSession", back_populates="records")
    student: Mapped["Student"] = relationship("Student", back_populates="attendance_records")
