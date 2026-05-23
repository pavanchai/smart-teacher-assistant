import uuid
from datetime import datetime

from pydantic import BaseModel


class ClassCreate(BaseModel):
    name: str


class ClassRead(BaseModel):
    id: uuid.UUID
    school_id: uuid.UUID
    name: str
    created_at: datetime

    model_config = {"from_attributes": True}
