"""Seed script for initial data setup.

Usage:
    python seed.py --create-admin           Create an admin user interactively
    python seed.py --create-admin --email admin@example.com --username admin --password 'MyP@ss1'
"""

import argparse
import getpass
import sys

from sqlmodel import Session, select

from app.auth import hash_password
from app.database import create_db_and_tables, engine
from app.models.user import User


def create_admin(email: str, username: str, password: str) -> None:
    create_db_and_tables()

    with Session(engine) as session:
        existing = session.exec(
            select(User).where((User.email == email) | (User.username == username))
        ).first()
        if existing:
            print(f"ERROR: User with email '{email}' or username '{username}' already exists.")
            sys.exit(1)

        user = User(
            email=email,
            username=username,
            hashed_password=hash_password(password),
            is_active=True,
            is_admin=True,
        )
        session.add(user)
        session.commit()
        print(f"Admin user '{username}' created successfully.")


def main() -> None:
    parser = argparse.ArgumentParser(description="iotivate.dev seed script")
    parser.add_argument("--create-admin", action="store_true", help="Create an admin user")
    parser.add_argument("--email", type=str, help="Admin email address")
    parser.add_argument("--username", type=str, help="Admin username")
    parser.add_argument("--password", type=str, help="Admin password")

    args = parser.parse_args()

    if not args.create_admin:
        parser.print_help()
        sys.exit(0)

    email = args.email or input("Email: ").strip()
    username = args.username or input("Username: ").strip()
    password = args.password or getpass.getpass("Password: ")

    if not all([email, username, password]):
        print("ERROR: All fields (email, username, password) are required.")
        sys.exit(1)

    create_admin(email, username, password)


if __name__ == "__main__":
    main()
