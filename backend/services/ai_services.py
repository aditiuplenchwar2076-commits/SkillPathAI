import os
from dotenv import load_dotenv
from google import genai
from google.genai import types
from pydantic import BaseModel
from typing import List

load_dotenv()

api_key = os.getenv("GEMINI_API_KEY")

# Configure sensible client timeout (default 25s) and limited retry policy (max 2 attempts)
# to prevent upstream Gemini latency spikes from stalling requests for 2-3 minutes.
GEMINI_TIMEOUT_MS = int(os.getenv("GEMINI_TIMEOUT_SECONDS", "25")) * 1000

http_options = types.HttpOptions(
    timeout=GEMINI_TIMEOUT_MS,
    retry_options=types.HttpRetryOptions(
        attempts=2,
        initial_delay=1.0,
        max_delay=3.0,
        exp_base=1.5
    )
)

client = genai.Client(api_key=api_key, http_options=http_options)


class RoadmapTopic(BaseModel):
    topic_name: str
    sequence_no: int


class RoadmapResponse(BaseModel):
    career_path: str
    topics: List[RoadmapTopic]


def test_gemini():
    response = client.interactions.create(
        model="gemini-3.8-flash",
        input="Explain what Python is in one simple sentence."
    )

    return response.output_text


def generate_roadmap(
    career_goal: str,
    current_skills: str,
    interests: str,
    skill_level: str,
    assessment_score: float
):
    prompt = f"""
Create a personalized learning roadmap for a student.

Career goal: {career_goal}
Current skills: {current_skills}
Interests: {interests}
Skill level: {skill_level}
Assessment score: {assessment_score}

Create 8 to 10 learning topics in a logical order.
Start with topics suitable for the student's current level
and gradually move toward advanced topics.

Return only the roadmap information.
"""

    response = client.interactions.create(
        model="gemini-3.8-flash",
        input=prompt,
        response_format={
            "type": "text",
            "mime_type": "application/json",
            "schema": RoadmapResponse.model_json_schema()
        }
    )

    return RoadmapResponse.model_validate_json(response.output_text)
def explain_topic(topic_name: str, skill_level: str):

    prompt = f"""
    Explain the following programming/technical topic to a student.

    Topic: {topic_name}
    Student skill level: {skill_level}

    Requirements:
    - Explain in simple language
    - Start with a basic definition
    - Explain the important concepts
    - Give a simple real-world example
    - Give a small coding example if applicable
    - Keep it suitable for the student's skill level
    """

    response = client.interactions.create(
        model="gemini-3.8-flash",
        input=prompt
    )

    return response.output_text

