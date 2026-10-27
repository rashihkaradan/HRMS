from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.recruitment import JobStatus, ApplicationStage


class JobOpeningCreate(BaseModel):
    title: str
    department_id: Optional[int] = None
    description: Optional[str] = None
    required_skills: Optional[str] = None
    assessment_questions: Optional[list[dict]] = None
    interview_duration: int = Field(default=20, ge=5, le=120)
    interview_language: str = Field(default="en-US", max_length=32)
    interview_question_plan: Optional[list[dict]] = None


class JobInterviewConfigUpdate(BaseModel):
    interview_duration: int = Field(ge=5, le=120)
    interview_language: str = Field(max_length=32)
    interview_question_plan: list[dict] = Field(min_length=1)


class JobOpeningOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    title: str
    department_id: Optional[int]
    description: Optional[str]
    required_skills: Optional[str]
    assessment_questions: Optional[list[dict]]
    interview_duration: int = 20
    interview_language: str = "en-US"
    interview_question_plan: Optional[list[dict]] = None
    status: JobStatus
    created_at: datetime


class CandidateCreate(BaseModel):
    full_name: str
    email: EmailStr
    phone: Optional[str] = None
    skills: Optional[str] = None
    years_experience: Optional[float] = None


class CandidateOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    full_name: str
    email: EmailStr
    phone: Optional[str]
    resume_path: Optional[str]
    skills: Optional[str]
    years_experience: Optional[float]
    created_at: datetime


class AssessmentQuestionOut(BaseModel):
    id: str
    category: str
    prompt: str
    language: Optional[str] = None


class AssessmentAnswer(BaseModel):
    question_id: str
    answer: str = Field(min_length=1, max_length=10000)


class ApplicationCreate(BaseModel):
    job_id: int
    candidate_id: int
    notes: Optional[str] = None
    assessment_answers: list[AssessmentAnswer] = Field(min_length=1)


class PublicApplicationCreate(BaseModel):
    job_id: int
    full_name: str = Field(min_length=2, max_length=255)
    email: EmailStr
    phone: Optional[str] = Field(default=None, max_length=50)
    skills: Optional[str] = None
    years_experience: Optional[float] = Field(default=None, ge=0, le=80)


class PublicApplicationOut(BaseModel):
    application_id: int
    access_token: str
    job_title: str
    assessment: list[AssessmentQuestionOut]


class PublicAssessmentSubmit(BaseModel):
    access_token: str
    assessment_answers: list[AssessmentAnswer] = Field(min_length=1)


class PublicInterviewToken(BaseModel):
    interview_token: str


class PublicInterviewAnswer(BaseModel):
    interview_token: str
    answer: str = Field(min_length=1, max_length=20000)


class ApplicationStageUpdate(BaseModel):
    stage: ApplicationStage
    notes: Optional[str] = None


class ApplicationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    job_id: int
    candidate_id: int
    stage: ApplicationStage
    notes: Optional[str]
    assessment_answers: Optional[dict[str, str]]
    assessment_submitted_at: Optional[datetime]
    assessment_result: Optional[dict]
    interview_session: Optional[dict] = None
    match_percentage: Optional[int] = None
    match_basis: Optional[str] = None
    applied_at: datetime


