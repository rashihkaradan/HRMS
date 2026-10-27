"""Store extracted resume text with candidate records.

Revision ID: 0002_candidate_resume_text
Revises: 0001_initial_schema
"""

from alembic import op
import sqlalchemy as sa


revision = "0002_candidate_resume_text"
down_revision = "0001_initial_schema"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("candidates", sa.Column("resume_text", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("candidates", "resume_text")
