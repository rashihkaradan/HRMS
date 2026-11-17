"""Add scheduled recruitment interviews."""
from alembic import op
import sqlalchemy as sa

revision = "0006_interview_schedules"
down_revision = "0005_candidate_portal_history"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "interview_schedules",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("application_id", sa.Integer(), sa.ForeignKey("applications.id", ondelete="CASCADE"), nullable=False),
        sa.Column("scheduled_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("round_name", sa.String(length=100), nullable=False),
        sa.Column("interviewer_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("mode", sa.String(length=20), nullable=False),
        sa.Column("meeting_details", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="SCHEDULED"),
        sa.Column("feedback", sa.Text(), nullable=True),
        sa.Column("result", sa.String(length=40), nullable=True),
        sa.Column("created_by_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_interview_schedules_application_id", "interview_schedules", ["application_id"])


def downgrade() -> None:
    op.drop_index("ix_interview_schedules_application_id", table_name="interview_schedules")
    op.drop_table("interview_schedules")
