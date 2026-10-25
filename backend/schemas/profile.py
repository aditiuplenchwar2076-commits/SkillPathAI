from pydantic import BaseModel


class ProfileCreate(BaseModel):
    user_id: int
    education: str
    interests: str
    current_skills: str
    skill_level: str

class ProfileUpdate(BaseModel):
    education: str | None = None
    interests: str | None = None
    current_skills: str | None = None
    skill_level: str | None = None