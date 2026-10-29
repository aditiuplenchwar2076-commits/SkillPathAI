import os
from dotenv import load_dotenv
from google import genai
from google.genai import types
from pydantic import BaseModel
from typing import List

env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".env")
if os.path.exists(env_path):
    load_dotenv(env_path)
else:
    load_dotenv()

# Default to gemini-3.1-flash-lite for fast, reliable, low-latency responses
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.1-flash-lite")


def get_gemini_client():
    """
    Lazily initializes and returns the Google GenAI client.
    Prevents application startup crashes if GEMINI_API_KEY is unset or invalid.
    """
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key or not api_key.strip():
        raise RuntimeError("GEMINI_API_KEY is not configured on the server.")

    # Enforce minimum 10s deadline required by Gemini API
    timeout_sec = max(int(os.getenv("GEMINI_TIMEOUT_SECONDS", "20")), 10)
    timeout_ms = timeout_sec * 1000

    http_options = types.HttpOptions(
        timeout=timeout_ms,
        retry_options=types.HttpRetryOptions(
            attempts=2,
            initial_delay=1.0,
            max_delay=3.0,
            exp_base=1.5
        )
    )
    return genai.Client(api_key=api_key.strip(), http_options=http_options)


class RoadmapTopic(BaseModel):
    topic_name: str
    sequence_no: int


class RoadmapResponse(BaseModel):
    career_path: str
    topics: List[RoadmapTopic]


def test_gemini():
    """
    Simple connectivity test using the standard models.generate_content API.
    """
    client = get_gemini_client()
    response = client.models.generate_content(
        model=GEMINI_MODEL,
        contents="Explain what Python is in one simple sentence.",
        config=types.GenerateContentConfig(
            max_output_tokens=100
        )
    )

    if not response.text:
        raise RuntimeError("Gemini returned an empty test response.")

    return response.text.strip()


def generate_roadmap(
    career_goal: str,
    current_skills: str,
    interests: str,
    skill_level: str,
    assessment_score: float
):
    """
    Generates a personalized learning roadmap with structured JSON schema.
    Bounded to 800 tokens to guarantee fast response times (< 3 seconds).
    """
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

    client = get_gemini_client()
    response = client.models.generate_content(
        model=GEMINI_MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=RoadmapResponse,
            max_output_tokens=800
        )
    )

    if not response.text:
        raise RuntimeError("Gemini returned an empty roadmap response.")

    return RoadmapResponse.model_validate_json(response.text)


def explain_topic(topic_name: str, skill_level: str):
    """
    Explains a technical topic to a student.
    Bounded to 500 tokens to prevent multi-minute essay generation and guarantee fast response (< 4 seconds).
    """
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

    client = get_gemini_client()
    response = client.models.generate_content(
        model=GEMINI_MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(
            max_output_tokens=500
        )
    )

    if not response.text:
        raise RuntimeError("Gemini returned an empty explanation response.")

    return response.text.strip()
