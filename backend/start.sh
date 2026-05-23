#!/bin/bash
set -e

echo "Running database migrations..."
alembic upgrade head

echo "Seeding demo data (skips if already seeded)..."
python seed_safe.py

echo "Starting server..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
