from datetime import datetime, date
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.recruitment import JobStatus, ApplicationStage


class JobOpeningCreate(BaseModel):
    title: str
    department_id: Optional[int] = None
    description: Optional[str] = None
    required_skills: Optional[str] = None
    location: Optional[str] = Field(default=None, max_length=255)
    employment_type: Optional[str] = Field(default=None, max_length=80)
    experience_required: Optional[str] = Field(default=None, max_length=120)
    responsibilities: Optional[str] = None
    education_requirements: Optional[str] = None
    vacancies: int = Field(default=1, ge=1, le=10000)
    application_deadline: Optional[date] = None
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
    location: Optional[str] = None
    employment_type: Optional[str] = None
    experience_required: Optional[str] = None
    responsibilities: Optional[str] = None
    education_requirements: Optional[str] = None
    vacancies: int = 1
    application_deadline: Optional[date] = None
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
    candidate_remarks: Optional[str] = Field(default=None, max_length=2000)


class CandidateRegistration(BaseModel):
    full_name: str = Field(min_length=2, max_length=255)
    email: EmailStr
    phone: str = Field(min_length=5, max_length=50)
    password: str = Field(min_length=10, max_length=128)
    terms_accepted: bool


class CandidateProfileUpdate(BaseModel):
    full_name: str = Field(min_length=2, max_length=255)
    phone: Optional[str] = Field(default=None, max_length=50)
    skills: Optional[str] = Field(default=None, max_length=4000)
    years_experience: Optional[float] = Field(default=None, ge=0, le=80)
    profile_data: dict = Field(default_factory=dict)


class CandidateApply(BaseModel):
    job_id: int


class HireConversion(BaseModel):
    joining_date: Optional[date] = None


class InterviewScheduleCreate(BaseModel):
    scheduled_at: datetime
    round_name: str = Field(min_length=2, max_length=100)
    interviewer_id: Optional[int] = None
    mode: str = Field(pattern="^(ONLINE|OFFLINE)$")
    meeting_details: Optional[str] = Field(default=None, max_length=2000)


class InterviewScheduleUpdate(BaseModel):
    scheduled_at: Optional[datetime] = None
    round_name: Optional[str] = Field(default=None, min_length=2, max_length=100)
    interviewer_id: Optional[int] = None
    mode: Optional[str] = Field(default=None, pattern="^(ONLINE|OFFLINE)$")
    meeting_details: Optional[str] = Field(default=None, max_length=2000)
    status: Optional[str] = Field(default=None, pattern="^(SCHEDULED|CANCELLED|COMPLETED)$")
    feedback: Optional[str] = Field(default=None, max_length=10000)
    result: Optional[str] = Field(default=None, pattern="^(PENDING|PASSED|FAILED|ON_HOLD)$")


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


