import enum
from datetime import datetime, date
from typing import Optional

from sqlalchemy import JSON, String, Text, DateTime, ForeignKey, Enum, func, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class JobStatus(str, enum.Enum):
    OPEN = "OPEN"
    ON_HOLD = "ON_HOLD"
    CLOSED = "CLOSED"


class ApplicationStage(str, enum.Enum):
    APPLIED = "APPLIED"
    SCREENING = "SCREENING"
    RESUME_SHORTLISTED = "RESUME_SHORTLISTED"
    HR_SCREENING = "HR_SCREENING"
    INTERVIEW = "INTERVIEW"
    TECHNICAL_INTERVIEW = "TECHNICAL_INTERVIEW"
    MANAGERIAL_INTERVIEW = "MANAGERIAL_INTERVIEW"
    FINAL_INTERVIEW = "FINAL_INTERVIEW"
    OFFER = "OFFER"
    OFFER_ACCEPTED = "OFFER_ACCEPTED"
    BACKGROUND_VERIFICATION = "BACKGROUND_VERIFICATION"
    HIRED = "HIRED"
    REJECTED = "REJECTED"
    ON_HOLD = "ON_HOLD"
    WITHDRAWN = "WITHDRAWN"
    OFFER_DECLINED = "OFFER_DECLINED"


class JobOpening(Base):
    __tablename__ = "job_openings"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    department_id: Mapped[Optional[int]] = mapped_column(ForeignKey("departments.id"), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    required_skills: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # comma-separated for now
    location: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    employment_type: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)
    experience_required: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    responsibilities: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    education_requirements: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    vacancies: Mapped[int] = mapped_column(default=1, nullable=False)
    application_deadline: Mapped[Optional[date]] = mapped_column(nullable=True)
    assessment_questions: Mapped[Optional[list[dict]]] = mapped_column(JSON, nullable=True)
    interview_duration: Mapped[int] = mapped_column(default=20, nullable=False)
    interview_language: Mapped[str] = mapped_column(String(32), default="en-US", nullable=False)
    interview_question_plan: Mapped[Optional[list[dict]]] = mapped_column(JSON, nullable=True)
    status: Mapped[JobStatus] = mapped_column(Enum(JobStatus), default=JobStatus.OPEN)
    created_by_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    applications: Mapped[list["Application"]] = relationship(back_populates="job")


class Candidate(Base):
    __tablename__ = "candidates"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), unique=True, nullable=True)
    employee_id: Mapped[Optional[int]] = mapped_column(ForeignKey("employees.id", ondelete="SET NULL"), unique=True, nullable=True)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    resume_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    resume_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    skills: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # comma-separated for now
    years_experience: Mapped[Optional[float]] = mapped_column(nullable=True)
    profile_data: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    applications: Mapped[list["Application"]] = relationship(back_populates="candidate")


class Application(Base):
    __tablename__ = "applications"
    __table_args__ = (UniqueConstraint("job_id", "candidate_id", name="uq_application_job_candidate"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    job_id: Mapped[int] = mapped_column(ForeignKey("job_openings.id"), nullable=False)
    candidate_id: Mapped[int] = mapped_column(ForeignKey("candidates.id"), nullable=False)
    stage: Mapped[ApplicationStage] = mapped_column(Enum(ApplicationStage), default=ApplicationStage.APPLIED)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    assessment_answers: Mapped[Optional[dict[str, str]]] = mapped_column(JSON, nullable=True)
    assessment_submitted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    assessment_result: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    interview_session: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    applied_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    job: Mapped["JobOpening"] = relationship(back_populates="applications")
    candidate: Mapped["Candidate"] = relationship(back_populates="applications")


class ApplicationStatusHistory(Base):
    __tablename__ = "application_status_history"

    id: Mapped[int] = mapped_column(primary_key=True)
    application_id: Mapped[int] = mapped_column(ForeignKey("applications.id", ondelete="CASCADE"), index=True, nullable=False)
    stage: Mapped[str] = mapped_column(String(40), nullable=False)
    internal_remarks: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    candidate_remarks: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    changed_by_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    changed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class InterviewSchedule(Base):
    __tablename__ = "interview_schedules"

    id: Mapped[int] = mapped_column(primary_key=True)
    application_id: Mapped[int] = mapped_column(ForeignKey("applications.id", ondelete="CASCADE"), index=True, nullable=False)
    scheduled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    round_name: Mapped[str] = mapped_column(String(100), nullable=False)
    interviewer_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    mode: Mapped[str] = mapped_column(String(20), nullable=False)
    meeting_details: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="SCHEDULED", nullable=False)
    feedback: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    result: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    created_by_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
