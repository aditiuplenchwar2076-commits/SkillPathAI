from sqlalchemy import Column, Integer, DECIMAL, TIMESTAMP, text
from database.mysql import Base


class QuizResult(Base):
    __tablename__ = "quiz_results"

    result_id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, nullable=False)
    topic_id = Column(Integer, nullable=False)
    score = Column(DECIMAL(5, 2))
    total_questions = Column(Integer)
    attempt_no = Column(Integer, default=1)
    completed_at = Column(
        TIMESTAMP,
        server_default=text("CURRENT_TIMESTAMP")
    )