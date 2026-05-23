import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr


class TeacherCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    school_id: uuid.UUID


class TeacherRead(BaseModel):
    id: uuid.UUID
    school_id: uuid.UUID
    email: EmailStr
    full_name: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}
