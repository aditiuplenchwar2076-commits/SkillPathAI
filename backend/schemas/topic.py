from pydantic import BaseModel


class TopicCreate(BaseModel):
    roadmap_id: int
    topic_name: str
    sequence_no: int
    status: str = "Not Started"


class TopicUpdate(BaseModel):
    topic_name: str | None = None
    sequence_no: int | None = None
    status: str | None = None


