from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.core.deps import get_current_teacher
from app.models.teacher import Teacher
from app.services.pose_service import detect_faces_and_gesture

router = APIRouter(tags=["pose"])


class FaceBox(BaseModel):
    x: float
    y: float
    w: float
    h: float


class PoseDetectRequest(BaseModel):
    frame: str   # base64-encoded JPEG


class PoseDetectResponse(BaseModel):
    faces: list[FaceBox]
    hand_raised: bool


@router.post("/pose/detect", response_model=PoseDetectResponse)
async def detect_pose(
    payload: PoseDetectRequest,
    _: Teacher = Depends(get_current_teacher),
) -> PoseDetectResponse:
    result = detect_faces_and_gesture(payload.frame)
    return PoseDetectResponse(**result)
