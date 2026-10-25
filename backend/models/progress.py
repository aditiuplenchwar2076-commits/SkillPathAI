from sqlalchemy import Column, Integer, String, TIMESTAMP, text
from database.mysql import Base


class Progress(Base):
    __tablename__ = "progress"

    progress_id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, nullable=False)
    topic_id = Column(Integer, nullable=False)
    completion_percentage = Column(Integer, default=0)
    status = Column(String(30), default="Not Started")

    last_updated = Column(
        TIMESTAMP,
        server_default=text("CURRENT_TIMESTAMP"),
        onupdate=text("CURRENT_TIMESTAMP")
    )