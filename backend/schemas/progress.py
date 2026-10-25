from pydantic import BaseModel

class ProgressCreate(BaseModel):
    user_id: int
    topic_id: int
    completion_percentage: int
    status: str

class ProgressUpdate(BaseModel):
    completion_percentage: int | None = None
    status: str | None = None