import uuid

from pydantic import BaseModel, EmailStr


class TeacherPublic(BaseModel):
    id: uuid.UUID
    full_name: str
    email: EmailStr
    school_id: uuid.UUID

    model_config = {"from_attributes": True}


class Token(BaseModel):
    access_token: str
    token_type: str
    teacher: TeacherPublic


class TokenData(BaseModel):
    teacher_id: uuid.UUID | None = None
