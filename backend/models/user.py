from sqlalchemy import Column, Integer, String, Text
from database.mysql import Base


class User(Base):
    __tablename__ = "users"

    user_id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    email = Column(String(150), unique=True, nullable=False)
    firebase_uid = Column(String(128), unique=True, nullable=True)
    career_goal = Column(String(150))