"""Store opening-specific questions and per-application assessment marks."""

from alembic import op
import sqlalchemy as sa


revision = "0003_opening_assessments"
down_revision = "0002_candidate_resume_text"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("job_openings", sa.Column("assessment_questions", sa.JSON(), nullable=True))
    op.add_column("applications", sa.Column("assessment_result", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("applications", "assessment_result")
    op.drop_column("job_openings", "assessment_questions")
