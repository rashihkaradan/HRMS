"""Add configured voice interview plans and saved interview sessions."""

from alembic import op
import sqlalchemy as sa

revision = "0004_voice_interviews"
down_revision = "0003_opening_assessments"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("job_openings", sa.Column("interview_duration", sa.Integer(), nullable=False, server_default="20"))
    op.add_column("job_openings", sa.Column("interview_language", sa.String(length=32), nullable=False, server_default="en-US"))
    op.add_column("job_openings", sa.Column("interview_question_plan", sa.JSON(), nullable=True))
    op.add_column("applications", sa.Column("interview_session", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("applications", "interview_session")
    op.drop_column("job_openings", "interview_question_plan")
    op.drop_column("job_openings", "interview_language")
    op.drop_column("job_openings", "interview_duration")
