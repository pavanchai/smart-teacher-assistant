from fastapi import APIRouter

from app.api.v1 import auth, attendance, classes, pose, sections, students

router = APIRouter()

router.include_router(auth.router)
router.include_router(classes.router)
router.include_router(sections.router)
router.include_router(students.router)
router.include_router(attendance.router)
router.include_router(pose.router)
