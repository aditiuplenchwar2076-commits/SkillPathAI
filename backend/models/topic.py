from sqlalchemy import Column, Integer, String
from database.mysql import Base


class Topic(Base):
    __tablename__ = "topics"

    topic_id = Column(Integer, primary_key=True, autoincrement=True)
    roadmap_id = Column(Integer, nullable=False)
    topic_name = Column(String(150), nullable=False)
    sequence_no = Column(Integer)
    status = Column(String(30), default="Not Started")