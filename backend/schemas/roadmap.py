from pydantic import BaseModel


class RoadmapCreate(BaseModel):
    user_id: int
    career_path: str


class AIRoadmapRequest(BaseModel):
    user_id: int
    career_goal: str
    current_skills: str
    interests: str
    skill_level: str
    assessment_score: float