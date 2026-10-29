from pydantic import BaseModel
from typing import Optional


class UserCreate(BaseModel):
    name: str
    email: str
    career_goal: str


class UserUpdate(BaseModel):
    name: Optional[str] = None
    career_goal: Optional[str] = None


class UserResponse(BaseModel):
    user_id: int
    name: str
    email: str
    firebase_uid: Optional[str] = None
    career_goal: Optional[str] = None

    class Config:
        from_attributes = True
