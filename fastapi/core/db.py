import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Use an async driver by default. For Postgres, expect: postgresql+asyncpg://user:pass@host:port/db
# For local, SQLite async fallback: sqlite+aiosqlite:///./app.db
DATABASE_URL = "postgresql://fastapi:fastapi@localhost:5433/fastapi"
SECRET_KEY = "lJ43fZtwCfh2qNM0uFx3mHSYGh/qrfXUtrM4Vl/kiZE="
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_SECONDS = 3600
JWT_COOKIE_NAME = "ACCESS_TOKEN"
SECURE_COOKIES = "false"


# Create async engine
engine = create_engine(
    DATABASE_URL
)

# Async session factory
SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False,
    expire_on_commit=False,
)
