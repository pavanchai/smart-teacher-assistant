import uuid
from datetime import datetime, timezone

from sqlalchemy import ForeignKey, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Class(Base):
    __tablename__ = "classes"

    __table_args__ = (UniqueConstraint("school_id", "name", name="uq_class_school_name"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    school_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("schools.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    created_at: Mapped[datetime] = mapped_column(default=lambda: datetime.utcnow(), server_default=func.now())

    school: Mapped["School"] = relationship("School", back_populates="classes")
    sections: Mapped[list["Section"]] = relationship("Section", back_populates="class_")
