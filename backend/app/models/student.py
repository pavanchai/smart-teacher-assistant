import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Student(Base):
    __tablename__ = "students"

    __table_args__ = (UniqueConstraint("section_id", "roll_number", name="uq_student_section_roll"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    section_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("sections.id"), nullable=False)
    roll_number: Mapped[str] = mapped_column(String(50), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(default=lambda: datetime.utcnow(), server_default=func.now())

    section: Mapped["Section"] = relationship("Section", back_populates="students")
    attendance_records: Mapped[list["AttendanceRecord"]] = relationship("AttendanceRecord", back_populates="student")
