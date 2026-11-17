from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4
import zipfile
from io import BytesIO

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, require_roles
from app.core.security import create_access_token, hash_password
from app.db.session import get_db
from app.models.recruitment import (
    Application, ApplicationStage, ApplicationStatusHistory, Candidate, JobOpening,
    InterviewSchedule,
)
from app.models.user import RoleEnum, User
from app.models.employee import Employee
from app.schemas.recruitment import CandidateApply, CandidateProfileUpdate, CandidateRegistration, HireConversion
from app.rag.candidate_profiles import sync_open_job_profiles
from app.rag.gemini_client import GeminiConfigurationError, GeminiServiceError
from pypdf import PdfReader

router = APIRouter(prefix="/candidate-portal", tags=["candidate portal"])
RESUME_DIR = Path("documents/resumes").resolve()
MAX_RESUME_BYTES = 10 * 1024 * 1024


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register_candidate(payload: CandidateRegistration, db: AsyncSession = Depends(get_db)):
    if not payload.terms_accepted:
        raise HTTPException(status_code=422, detail="Accept the terms and conditions to create an account")
    email = str(payload.email).strip().casefold()
    user_exists = await db.scalar(select(User.id).where(func.lower(User.email) == email))
    if user_exists:
        raise HTTPException(status_code=409, detail="An account already exists for this email")
    candidate = await db.scalar(select(Candidate).where(func.lower(Candidate.email) == email))
    if candidate is not None and candidate.user_id is not None:
        raise HTTPException(status_code=409, detail="A candidate account already exists for this email")

    user = User(email=email, hashed_password=hash_password(payload.password), full_name=payload.full_name.strip(), role=RoleEnum.CANDIDATE)
    db.add(user)
    await db.flush()
    if candidate is None:
        candidate = Candidate(full_name=user.full_name, email=email, phone=payload.phone, user_id=user.id, profile_data={})
        db.add(candidate)
    else:
        candidate.full_name = user.full_name
        candidate.phone = payload.phone
        candidate.user_id = user.id
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=409, detail="An account already exists for this email") from exc
    token = create_access_token({"sub": str(user.id), "role": user.role.value})
    return {"access_token": token, "token_type": "bearer", "full_name": user.full_name}


async def get_candidate(user: User, db: AsyncSession) -> Candidate:
    if user.role != RoleEnum.CANDIDATE:
        raise HTTPException(status_code=403, detail="Candidate account required")
    candidate = await db.scalar(select(Candidate).where(Candidate.user_id == user.id))
    if candidate is None:
        raise HTTPException(status_code=404, detail="Candidate profile not found")
    return candidate


@router.get("/profile")
async def candidate_profile(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    candidate = await get_candidate(user, db)
    return {
        "id": candidate.id, "full_name": candidate.full_name, "email": candidate.email,
        "phone": candidate.phone, "skills": candidate.skills,
        "years_experience": candidate.years_experience, "resume_path": candidate.resume_path,
        "profile_data": candidate.profile_data or {},
    }


@router.put("/profile")
async def update_candidate_profile(payload: CandidateProfileUpdate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    candidate = await get_candidate(user, db)
    candidate.full_name = payload.full_name.strip()
    candidate.phone = payload.phone
    candidate.skills = payload.skills
    candidate.years_experience = payload.years_experience
    candidate.profile_data = payload.profile_data
    user.full_name = candidate.full_name
    await db.commit()
    return await candidate_profile(user, db)


@router.post("/resume")
async def upload_own_resume(resume: UploadFile = File(...), user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    candidate = await get_candidate(user, db)
    extension = Path(resume.filename or "").suffix.lower()
    if extension not in {".pdf", ".doc", ".docx"}:
        raise HTTPException(status_code=415, detail="Resume must be PDF, DOC, or DOCX")
    content = await resume.read(MAX_RESUME_BYTES + 1)
    if not content or len(content) > MAX_RESUME_BYTES:
        raise HTTPException(status_code=413, detail="Resume must be between 1 byte and 10 MB")
    if extension == ".pdf":
        if not content.startswith(b"%PDF-"):
            raise HTTPException(status_code=415, detail="Invalid PDF file")
        try:
            candidate.resume_text = "\n".join(page.extract_text() or "" for page in PdfReader(BytesIO(content)).pages).strip() or None
        except Exception as exc:
            raise HTTPException(status_code=400, detail="Could not read the PDF resume") from exc
    elif extension == ".docx":
        try:
            with zipfile.ZipFile(BytesIO(content)) as archive:
                if "word/document.xml" not in archive.namelist():
                    raise ValueError("not a docx")
        except Exception as exc:
            raise HTTPException(status_code=415, detail="Invalid DOCX file") from exc
    elif not content.startswith(bytes.fromhex("D0CF11E0A1B11AE1")):
        raise HTTPException(status_code=415, detail="Invalid DOC file")
    RESUME_DIR.mkdir(parents=True, exist_ok=True)
    name = f"{uuid4().hex}{extension}"
    (RESUME_DIR / name).write_bytes(content)
    candidate.resume_path = f"resumes/{name}"
    await db.commit()
    return {"filename": Path(resume.filename or "resume").name, "uploaded": True}


@router.get("/resume")
async def download_own_resume(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    candidate = await get_candidate(user, db)
    if not candidate.resume_path:
        raise HTTPException(status_code=404, detail="No resume is on file")
    target = (RESUME_DIR / Path(candidate.resume_path).name).resolve()
    if target.parent != RESUME_DIR or not target.is_file():
        raise HTTPException(status_code=404, detail="Resume file is unavailable")
    return FileResponse(target, filename=f"resume{target.suffix}")


@router.get("/candidates/{candidate_id}/resume")
async def download_candidate_resume(candidate_id: int, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if user.role == RoleEnum.CANDIDATE:
        candidate = await get_candidate(user, db)
        if candidate.id != candidate_id:
            raise HTTPException(status_code=403, detail="You can only access your own resume")
    elif user.role not in {RoleEnum.SUPER_ADMIN, RoleEnum.HR_ADMIN, RoleEnum.RECRUITER, RoleEnum.HR_MANAGER}:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    else:
        candidate = await db.get(Candidate, candidate_id)
    if candidate is None or not candidate.resume_path:
        raise HTTPException(status_code=404, detail="Resume not found")
    target = (RESUME_DIR / Path(candidate.resume_path).name).resolve()
    if target.parent != RESUME_DIR or not target.is_file():
        raise HTTPException(status_code=404, detail="Resume file is unavailable")
    return FileResponse(target, filename=f"{candidate.full_name[:80]}_resume{target.suffix}")


@router.get("/applications")
async def candidate_applications(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    candidate = await get_candidate(user, db)
    result = await db.execute(
        select(Application, JobOpening).join(JobOpening, Application.job_id == JobOpening.id)
        .where(Application.candidate_id == candidate.id).order_by(Application.applied_at.desc())
    )
    rows = result.all()
    data = []
    for application, job in rows:
        history_result = await db.execute(
            select(ApplicationStatusHistory).where(ApplicationStatusHistory.application_id == application.id)
            .order_by(ApplicationStatusHistory.changed_at.asc(), ApplicationStatusHistory.id.asc())
        )
        history = history_result.scalars().all()
        data.append({
            "id": application.id, "application_id": f"APP-{application.id:06d}", "job_id": job.id,
            "job_title": job.title, "department_id": job.department_id,
            "stage": application.stage.value, "applied_at": application.applied_at,
            "history": [{"stage": item.stage, "remarks": item.candidate_remarks, "changed_at": item.changed_at}
                        for item in history],
        })
    return data


@router.get("/interviews")
async def candidate_interviews(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    candidate = await get_candidate(user, db)
    result = await db.execute(
        select(InterviewSchedule, Application, JobOpening)
        .join(Application, InterviewSchedule.application_id == Application.id)
        .join(JobOpening, Application.job_id == JobOpening.id)
        .where(Application.candidate_id == candidate.id)
        .order_by(InterviewSchedule.scheduled_at.desc())
    )
    return [{"id": interview.id, "application_id": application.id, "job_title": job.title,
             "scheduled_at": interview.scheduled_at, "round_name": interview.round_name,
             "mode": interview.mode, "meeting_details": interview.meeting_details,
             "status": interview.status, "result": interview.result}
            for interview, application, job in result.all()]


@router.post("/applications", status_code=status.HTTP_201_CREATED)
async def apply_for_job(payload: CandidateApply, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    candidate = await get_candidate(user, db)
    profile = candidate.profile_data or {}
    if not candidate.resume_path or not candidate.skills or not profile.get("location") or not profile.get("education"):
        raise HTTPException(status_code=409, detail="Complete your profile and upload a resume before applying")
    job = await db.get(JobOpening, payload.job_id)
    if job is None or job.status != "OPEN":
        raise HTTPException(status_code=404, detail="This job opening is not available")
    existing = await db.scalar(select(Application.id).where(
        Application.job_id == job.id, Application.candidate_id == candidate.id
    ))
    if existing is not None:
        raise HTTPException(status_code=409, detail="You have already applied for this opening")
    application = Application(job_id=job.id, candidate_id=candidate.id, stage=ApplicationStage.APPLIED)
    db.add(application)
    await db.flush()
    db.add(ApplicationStatusHistory(
        application_id=application.id, stage=ApplicationStage.APPLIED.value,
        candidate_remarks="Your application was received and is awaiting review.",
        changed_by_id=user.id, changed_at=datetime.now(timezone.utc),
    ))
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=409, detail="You have already applied for this opening") from exc
    try:
        await sync_open_job_profiles(db, job)
    except (GeminiConfigurationError, GeminiServiceError):
        pass
    return {"id": application.id, "application_id": f"APP-{application.id:06d}", "job_title": job.title, "stage": application.stage.value}


@router.post("/applications/{application_id}/convert-to-employee")
async def convert_hired_candidate(application_id: int, payload: HireConversion, user: User = Depends(require_roles([RoleEnum.SUPER_ADMIN, RoleEnum.HR_ADMIN])), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Application).where(Application.id == application_id))
    application = result.scalar_one_or_none()
    if application is None:
        raise HTTPException(status_code=404, detail="Application not found")
    if application.stage != ApplicationStage.HIRED:
        raise HTTPException(status_code=409, detail="Only candidates marked Hired can be converted")
    candidate = await db.get(Candidate, application.candidate_id)
    job = await db.get(JobOpening, application.job_id)
    existing = await db.scalar(select(Employee).where(func.lower(Employee.email) == candidate.email.casefold()))
    if candidate.employee_id:
        existing = await db.get(Employee, candidate.employee_id)
    reused = existing is not None
    if existing is None:
        existing = Employee(full_name=candidate.full_name, email=candidate.email, phone=candidate.phone,
                            department_id=job.department_id, designation=job.title,
                            joining_date=payload.joining_date)
        db.add(existing)
        await db.flush()
    candidate.employee_id = existing.id
    await db.commit()
    return {"employee_id": existing.id, "candidate_id": candidate.id, "application_id": application.id,
            "reused_existing_employee": reused}
