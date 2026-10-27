import shutil
import tempfile
import re
import uuid
from pathlib import Path
import logging

from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, require_roles
from app.core.config import settings
from app.db.session import get_db
from app.models.user import User, RoleEnum
from app.models.recruitment import Candidate, JobOpening
from app.rag.gemini_client import GeminiConfigurationError, GeminiServiceError
from app.rag.ingestion import ingest_document
from app.rag.query import answer_policy_question
from app.rag.candidate_profiles import answer_candidate_search, search_candidate_profiles, sync_open_job_profiles
from app.schemas.assistant import AskRequest, AskResponse, CandidateSearchRequest, IngestResponse

router = APIRouter(prefix="/assistant", tags=["assistant"])

HR_ROLES = [RoleEnum.SUPER_ADMIN, RoleEnum.HR_ADMIN, RoleEnum.HR_MANAGER]
RECRUIT_ROLES = [*HR_ROLES, RoleEnum.RECRUITER]
logger = logging.getLogger(__name__)


@router.post("/candidates/search")
async def search_applicants(
    payload: CandidateSearchRequest,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(RECRUIT_ROLES)),
):
    """Refresh one open role's SQL applicants in Chroma, retrieve evidence, and summarize it."""
    job = await db.get(JobOpening, payload.job_id)
    if not job or job.status != "OPEN":
        raise HTTPException(status_code=404, detail="Open job not found")
    try:
        indexed_count = await sync_open_job_profiles(db, job)
        evidence = search_candidate_profiles(job, payload.question.strip())
        if not evidence:
            return {
                "job_id": job.id,
                "job_title": job.title,
                "indexed_profiles": indexed_count,
                "candidates": [],
                "answer": "No applicants are recorded for this open role yet.",
            }
        answer = answer_candidate_search(job, payload.question.strip(), evidence)
    except GeminiConfigurationError:
        raise HTTPException(status_code=503, detail="Candidate search needs a valid GEMINI_API_KEY")
    except GeminiServiceError as exc:
        logger.exception("Candidate profile retrieval or analysis failed")
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    candidates = []
    by_application = {}
    for item in evidence:
        metadata = item["metadata"]
        application_id = int(metadata["application_id"])
        candidate = by_application.setdefault(application_id, {
            "application_id": application_id,
            "candidate_id": int(metadata["candidate_id"]),
            "candidate_name": metadata["candidate_name"],
        })
    candidate_ids = {candidate["candidate_id"] for candidate in by_application.values()}
    candidate_result = await db.execute(select(Candidate).where(Candidate.id.in_(candidate_ids)))
    candidate_by_id = {candidate.id: candidate for candidate in candidate_result.scalars().all()}
    candidates = []
    for candidate in by_application.values():
        database_candidate = candidate_by_id.get(candidate["candidate_id"])
        candidates.append({
            **candidate,
            "resume_text": database_candidate.resume_text if database_candidate and database_candidate.resume_text else "No resume text was submitted.",
        })
    return {
        "job_id": job.id,
        "job_title": job.title,
        "indexed_profiles": indexed_count,
        "retrieved_profiles": len(candidates),
        "candidates": candidates,
        "answer": answer,
    }


@router.post("/ask", response_model=AskResponse)
async def ask(
    payload: AskRequest,
    _: User = Depends(get_current_user),  # any logged-in employee can ask
):
    """
    Ask a question about HR policy (leave, WFH, benefits, etc). Answers are
    grounded in whatever documents have been ingested via /assistant/upload —
    this does NOT query employee-specific data like leave balances.
    """
    try:
        result = answer_policy_question(payload.question)
    except GeminiConfigurationError:
        raise HTTPException(
            status_code=503,
            detail="HR policy assistant needs a valid GEMINI_API_KEY. Set it in hrms/.env and restart the backend.",
        )
    except GeminiServiceError:
        raise HTTPException(
            status_code=502,
            detail=(
                "Gemini rejected the request. Check that the Google Cloud project "
                "linked to GEMINI_API_KEY has Gemini API access. If the error is "
                "403 PERMISSION_DENIED, review the project status in Google Cloud Console."
            ),
        )
    return AskResponse(**result)


@router.post("/upload", response_model=IngestResponse)
async def upload_policy_document(
    title: str = Form(...),
    category: str = Form("general"),
    file: UploadFile = File(...),
    _: User = Depends(require_roles(HR_ROLES)),  # only HR can add policy docs
):
    """
    Upload a PDF (employee handbook, leave policy, WFH policy, etc). It gets
    chunked and embedded into ChromaDB so /assistant/ask can retrieve from it.
    """
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name

    safe_name = re.sub(r"[^A-Za-z0-9._-]+", "_", Path(file.filename.replace("\\", "/")).name)[:120].strip("._") or "policy.pdf"
    documents_dir = Path(settings.POLICY_DOCUMENTS_DIR)
    documents_dir.mkdir(parents=True, exist_ok=True)
    saved_path = documents_dir / f"{uuid.uuid4().hex}_{safe_name}"
    upload_succeeded = False
    try:
        chunk_count = ingest_document(
            tmp_path,
            doc_title=title,
            category=category,
            source_name=file.filename,
        )
        if chunk_count == 0:
            raise HTTPException(status_code=400, detail="No extractable text found in PDF")
        shutil.copyfile(tmp_path, saved_path)
        upload_succeeded = True
    except GeminiConfigurationError:
        raise HTTPException(
            status_code=503,
            detail="PDF upload needs a valid GEMINI_API_KEY for text embeddings. Set it in hrms/.env and restart the backend.",
        )
    except GeminiServiceError:
        raise HTTPException(
            status_code=502,
            detail=(
                "Gemini could not create embeddings for this PDF. Check that the "
                "Google Cloud project linked to GEMINI_API_KEY has Gemini API access. "
                "If the error is 403 PERMISSION_DENIED, review the project status "
                "in Google Cloud Console."
            ),
        )
    finally:
        Path(tmp_path).unlink(missing_ok=True)
        if not upload_succeeded:
            saved_path.unlink(missing_ok=True)

    return IngestResponse(filename=file.filename, chunks_ingested=chunk_count, saved_as=saved_path.name)
