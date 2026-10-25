from pydantic import BaseModel


class QuizResultCreate(BaseModel):
    user_id: int
    topic_id: int
    score: float
    total_questions: int
    attempt_no: int = 1