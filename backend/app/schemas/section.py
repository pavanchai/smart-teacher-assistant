import uuid
from datetime import datetime

from pydantic import BaseModel


class SectionCreate(BaseModel):
    name: str


class SectionRead(BaseModel):
    id: uuid.UUID
    class_id: uuid.UUID
    name: str
    created_at: datetime

    model_config = {"from_attributes": True}


class SectionDetail(SectionRead):
    student_count: int
