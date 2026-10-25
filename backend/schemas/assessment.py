from pydantic import BaseModel


class AssessmentCreate(BaseModel):
    user_id: int
    score: float
    skill_level: str