"""Initial data required for a new HRMS installation."""

from sqlalchemy import select

from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models.user import RoleEnum, User

ADMIN_EMAIL = "admin@company.com"
ADMIN_PASSWORD = "admin123"
ADMIN_NAME = "Administrator"


async def ensure_default_admin() -> None:
    """Create the built-in administrator once, if it does not exist yet."""
    async with SessionLocal() as db:
        existing = await db.execute(select(User).where(User.email == ADMIN_EMAIL))
        if existing.scalar_one_or_none() is not None:
            return

        db.add(
            User(
                email=ADMIN_EMAIL,
                hashed_password=hash_password(ADMIN_PASSWORD),
                full_name=ADMIN_NAME,
                role=RoleEnum.SUPER_ADMIN,
                is_active=True,
            )
        )
        await db.commit()
