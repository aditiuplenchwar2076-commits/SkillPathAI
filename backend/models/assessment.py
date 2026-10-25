from sqlalchemy import Column, Integer, DECIMAL, String, TIMESTAMP, text
from database.mysql import Base


class Assessment(Base):
    __tablename__ = "assessments"

    assessment_id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, nullable=False)
    score = Column(DECIMAL(5, 2))
    skill_level = Column(String(50))
    completed_at = Column(TIMESTAMP, server_default=text("CURRENT_TIMESTAMP"))