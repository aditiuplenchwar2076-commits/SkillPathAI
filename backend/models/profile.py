from sqlalchemy import Column, Integer, Text, String
from database.mysql import Base


class Profile(Base):
    __tablename__ = "profiles"

    profile_id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, nullable=False)
    education = Column(String(100))
    interests = Column(Text)
    current_skills = Column(Text)
    skill_level = Column(String(50))