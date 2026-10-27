from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import require_roles
from app.db.session import get_db
from app.models.recruitment import Application
from app.models.user import RoleEnum, User

router = APIRouter(prefix="/interviews", tags=["interview review"])
RECRUIT_ROLES = [RoleEnum.SUPER_ADMIN, RoleEnum.HR_ADMIN, RoleEnum.RECRUITER, RoleEnum.HR_MANAGER]


@router.get("/{application_id}/evaluation")
async def get_evaluation(
    application_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(RECRUIT_ROLES)),
):
    result = await db.execute(
        select(Application).options(selectinload(Application.job), selectinload(Application.candidate))
        .where(Application.id == application_id)
    )
    application = result.scalar_one_or_none()
    if application is None:
        raise HTTPException(status_code=404, detail="Application not found")
    session = application.interview_session or {}
    if session.get("status") != "completed":
        raise HTTPException(status_code=409, detail="Evaluation is available only after the interview is complete")
    return {
        "application_id": application.id,
        "candidate_name": application.candidate.full_name,
        "job_title": application.job.title,
        "completed_at": session.get("completed_at"),
        "rubric": "Human reviewer rubric per response: 1 = no relevant evidence; 2 = limited or partly relevant evidence; 3 = adequate, role-related evidence; 4 = strong, specific role-related evidence. Leave a score unavailable when the transcript is unclear or evidence is insufficient. Do not score voice characteristics or protected traits. HR makes all hiring decisions.",
        "responses": [
            {
                "question": item["question"], "answer": item["answer"],
                "skills_assessed": [item["skill"]],
                "evidence": "See the candidate's recorded response above; no unsupported claims are inferred.",
                "score": None, "score_status": "pending human review",
                "missing_information": "HR reviewer to assess against the rubric.",
            }
            for item in session.get("answers", [])
        ],
    }
