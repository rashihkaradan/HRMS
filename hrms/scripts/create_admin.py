"""
One-off script to create the first SUPER_ADMIN user, since /auth/register
requires an existing admin to call it.

Usage:
    python -m scripts.create_admin admin@company.com yourpassword "Admin Name"
"""
import asyncio
import sys

from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models.user import User, RoleEnum


async def main(email: str, password: str, full_name: str):
    async with SessionLocal() as db:
        user = User(
            email=email,
            hashed_password=hash_password(password),
            full_name=full_name,
            role=RoleEnum.SUPER_ADMIN,
        )
        db.add(user)
        await db.commit()
        print(f"Created SUPER_ADMIN: {email}")


if __name__ == "__main__":
    if len(sys.argv) != 4:
        print("Usage: python -m scripts.create_admin <email> <password> <full_name>")
        sys.exit(1)
    asyncio.run(main(sys.argv[1], sys.argv[2], sys.argv[3]))
