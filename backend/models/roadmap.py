from sqlalchemy import Column, Integer, String, TIMESTAMP, text
from database.mysql import Base


class Roadmap(Base):
    __tablename__ = "roadmaps"

    roadmap_id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, nullable=False)
    career_path = Column(String(150), nullable=False)
    created_at = Column(TIMESTAMP, server_default=text("CURRENT_TIMESTAMP"))