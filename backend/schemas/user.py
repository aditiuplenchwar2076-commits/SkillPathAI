from pydantic import BaseModel


class UserCreate(BaseModel):
    name: str
    email: str
    career_goal: str

from typing import Optional


class UserResponse(BaseModel):
    user_id: int
    name: str
    email: str
    firebase_uid: Optional[str] = None
    career_goal: Optional[str] = None

    class Config:
        from_attributes = True
