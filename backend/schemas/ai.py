from pydantic import BaseModel


class TopicExplanationRequest(BaseModel):
    topic_name: str
    skill_level: str