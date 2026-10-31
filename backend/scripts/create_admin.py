"""Create the first admin user.

Usage:  python -m scripts.create_admin
"""

import getpass

from sqlalchemy import select

from app.core.enums import UserRole
from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models import User


def main() -> None:
    name = input("Full name: ").strip()
    username = input("Username: ").strip().lower()
    email = input("Email: ").strip().lower()
    password = getpass.getpass("Password (min 8 chars): ")

    if len(password) < 8:
        raise SystemExit("Password must be at least 8 characters.")

    with SessionLocal() as db:
        exists = db.scalars(
            select(User).where(
                (User.username == username) | (User.email == email), User.deleted_at.is_(None)
            )
        ).first()
        if exists:
            raise SystemExit("A user with that username or email already exists.")

        admin = User(
            name=name,
            username=username,
            email=email,
            role=UserRole.ADMIN,
            hashed_password=hash_password(password),
        )
        db.add(admin)
        db.commit()
        print(f"Admin '{username}' created with id {admin.id}")


if __name__ == "__main__":
    main()
