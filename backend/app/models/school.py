import uuid
from datetime import datetime, timezone

from sqlalchemy import String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class School(Base):
    __tablename__ = "schools"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(default=lambda: datetime.utcnow(), server_default=func.now())

    teachers: Mapped[list["Teacher"]] = relationship("Teacher", back_populates="school")
    classes: Mapped[list["Class"]] = relationship("Class", back_populates="school")
