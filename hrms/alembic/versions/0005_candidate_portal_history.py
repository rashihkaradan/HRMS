"""Add candidate portal identity and application stage history.

Revision ID: 0005_candidate_portal_history
Revises: 0004_voice_interviews
"""
from alembic import op
import sqlalchemy as sa

revision = "0005_candidate_portal_history"
down_revision = "0004_voice_interviews"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TYPE roleenum ADD VALUE IF NOT EXISTS 'CANDIDATE'")
    for stage in ("RESUME_SHORTLISTED", "HR_SCREENING", "TECHNICAL_INTERVIEW", "MANAGERIAL_INTERVIEW", "FINAL_INTERVIEW", "OFFER_ACCEPTED", "BACKGROUND_VERIFICATION", "ON_HOLD", "WITHDRAWN", "OFFER_DECLINED"):
        op.execute(f"ALTER TYPE applicationstage ADD VALUE IF NOT EXISTS '{stage}'")
    op.add_column("candidates", sa.Column("user_id", sa.Integer(), nullable=True))
    op.add_column("candidates", sa.Column("employee_id", sa.Integer(), nullable=True))
    op.add_column("candidates", sa.Column("profile_data", sa.JSON(), nullable=True))
    op.add_column("job_openings", sa.Column("location", sa.String(length=255), nullable=True))
    op.add_column("job_openings", sa.Column("employment_type", sa.String(length=80), nullable=True))
    op.add_column("job_openings", sa.Column("experience_required", sa.String(length=120), nullable=True))
    op.add_column("job_openings", sa.Column("responsibilities", sa.Text(), nullable=True))
    op.add_column("job_openings", sa.Column("education_requirements", sa.Text(), nullable=True))
    op.add_column("job_openings", sa.Column("vacancies", sa.Integer(), server_default="1", nullable=False))
    op.add_column("job_openings", sa.Column("application_deadline", sa.Date(), nullable=True))
    op.create_foreign_key("fk_candidates_user_id_users", "candidates", "users", ["user_id"], ["id"], ondelete="SET NULL")
    op.create_foreign_key("fk_candidates_employee_id_employees", "candidates", "employees", ["employee_id"], ["id"], ondelete="SET NULL")
    op.create_unique_constraint("uq_candidates_user_id", "candidates", ["user_id"])
    op.create_unique_constraint("uq_candidates_employee_id", "candidates", ["employee_id"])
    op.create_table(
        "application_status_history",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("application_id", sa.Integer(), sa.ForeignKey("applications.id", ondelete="CASCADE"), nullable=False),
        sa.Column("stage", sa.String(length=40), nullable=False),
        sa.Column("internal_remarks", sa.Text(), nullable=True),
        sa.Column("candidate_remarks", sa.Text(), nullable=True),
        sa.Column("changed_by_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("changed_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_application_status_history_application_id", "application_status_history", ["application_id"])
    op.create_unique_constraint("uq_application_job_candidate", "applications", ["job_id", "candidate_id"])
    op.execute("""
        INSERT INTO application_status_history (application_id, stage, candidate_remarks, changed_at)
        SELECT id, stage::text, CASE WHEN stage::text = 'APPLIED' THEN 'Your application was received and is awaiting review.' ELSE NULL END,
               COALESCE(applied_at, now())
        FROM applications
    """)


def downgrade() -> None:
    op.drop_constraint("uq_application_job_candidate", "applications", type_="unique")
    op.drop_index("ix_application_status_history_application_id", table_name="application_status_history")
    op.drop_table("application_status_history")
    op.drop_constraint("uq_candidates_user_id", "candidates", type_="unique")
    op.drop_constraint("uq_candidates_employee_id", "candidates", type_="unique")
    op.drop_constraint("fk_candidates_user_id_users", "candidates", type_="foreignkey")
    op.drop_constraint("fk_candidates_employee_id_employees", "candidates", type_="foreignkey")
    op.drop_column("candidates", "profile_data")
    op.drop_column("candidates", "user_id")
    op.drop_column("candidates", "employee_id")
    for column in ("location", "employment_type", "experience_required", "responsibilities", "education_requirements", "vacancies", "application_deadline"):
        op.drop_column("job_openings", column)
    # PostgreSQL enum values cannot be removed safely; keep CANDIDATE for forward compatibility.
