"""Create the initial HRMS schema, including application assessments.

Revision ID: 0001_initial_schema
Revises:
Create Date: 2026-09-03
"""

from alembic import op
import sqlalchemy as sa


revision = "0001_initial_schema"
down_revision = None
branch_labels = None
depends_on = None


role_enum = sa.Enum(
    "SUPER_ADMIN", "HR_ADMIN", "RECRUITER", "HR_MANAGER", "MANAGER", "EMPLOYEE", name="roleenum"
)
employment_status_enum = sa.Enum("ACTIVE", "ON_LEAVE", "TERMINATED", "RESIGNED", name="employmentstatus")
job_status_enum = sa.Enum("OPEN", "ON_HOLD", "CLOSED", name="jobstatus")
application_stage_enum = sa.Enum(
    "APPLIED", "SCREENING", "INTERVIEW", "OFFER", "HIRED", "REJECTED", name="applicationstage"
)


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("hashed_password", sa.String(length=255), nullable=False),
        sa.Column("full_name", sa.String(length=255), nullable=False),
        sa.Column("role", role_enum, nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("email"),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=False)

    op.create_table(
        "departments",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.UniqueConstraint("name"),
    )
    op.create_table(
        "employees",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True, unique=True),
        sa.Column("full_name", sa.String(length=255), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("phone", sa.String(length=50), nullable=True),
        sa.Column("department_id", sa.Integer(), sa.ForeignKey("departments.id"), nullable=True),
        sa.Column("designation", sa.String(length=255), nullable=True),
        sa.Column("manager_id", sa.Integer(), sa.ForeignKey("employees.id"), nullable=True),
        sa.Column("joining_date", sa.Date(), nullable=True),
        sa.Column("employment_status", employment_status_enum, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("email"),
    )
    op.create_table(
        "job_openings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("department_id", sa.Integer(), sa.ForeignKey("departments.id"), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("required_skills", sa.Text(), nullable=True),
        sa.Column("status", job_status_enum, nullable=False),
        sa.Column("created_by_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_table(
        "candidates",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("full_name", sa.String(length=255), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("phone", sa.String(length=50), nullable=True),
        sa.Column("resume_path", sa.String(length=500), nullable=True),
        sa.Column("skills", sa.Text(), nullable=True),
        sa.Column("years_experience", sa.Float(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("email"),
    )
    op.create_table(
        "applications",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("job_id", sa.Integer(), sa.ForeignKey("job_openings.id"), nullable=False),
        sa.Column("candidate_id", sa.Integer(), sa.ForeignKey("candidates.id"), nullable=False),
        sa.Column("stage", application_stage_enum, nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("assessment_answers", sa.JSON(), nullable=True),
        sa.Column("assessment_submitted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("applied_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("applications")
    op.drop_table("candidates")
    op.drop_table("job_openings")
    op.drop_table("employees")
    op.drop_table("departments")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")
    application_stage_enum.drop(op.get_bind(), checkfirst=True)
    job_status_enum.drop(op.get_bind(), checkfirst=True)
    employment_status_enum.drop(op.get_bind(), checkfirst=True)
    role_enum.drop(op.get_bind(), checkfirst=True)
