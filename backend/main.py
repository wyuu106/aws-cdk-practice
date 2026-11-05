import os

from fastapi import FastAPI
from pydantic import BaseModel
from sqlalchemy import create_engine, text

app = FastAPI()

engine = create_engine(os.environ["DATABASE_URL"])


class UserCreate(BaseModel):
    name: str


@app.get("/users")
def get_users():
    with engine.connect() as conn:
        result = conn.execute(
            text("SELECT id, name FROM users ORDER BY id")
        )
        return [dict(row) for row in result.mappings()]


@app.post("/users")
def create_user(user: UserCreate):
    with engine.begin() as conn:
        result = conn.execute(
            text(
                "INSERT INTO users (name) "
                "VALUES (:name) RETURNING id, name"
            ),
            {"name": user.name},
        )
        return dict(result.mappings().one())
    