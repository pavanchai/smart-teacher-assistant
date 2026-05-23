import uuid
from datetime import datetime

from pydantic import BaseModel


class StudentCreate(BaseModel):
    roll_number: str
    full_name: str


class StudentUpdate(BaseModel):
    roll_number: str | None = None
    full_name: str | None = None


class StudentRead(BaseModel):
    id: uuid.UUID
    section_id: uuid.UUID
    roll_number: str
    full_name: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class BulkUploadResult(BaseModel):
    created: int
    skipped: int
    errors: list[str]
