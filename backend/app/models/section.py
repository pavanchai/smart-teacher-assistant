import uuid
from datetime import datetime, timezone

from sqlalchemy import ForeignKey, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Section(Base):
    __tablename__ = "sections"

    __table_args__ = (UniqueConstraint("class_id", "name", name="uq_section_class_name"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    class_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("classes.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    created_at: Mapped[datetime] = mapped_column(default=lambda: datetime.utcnow(), server_default=func.now())

    class_: Mapped["Class"] = relationship("Class", back_populates="sections")
    students: Mapped[list["Student"]] = relationship("Student", back_populates="section")
    sessions: Mapped[list["AttendanceSession"]] = relationship("AttendanceSession", back_populates="section")
