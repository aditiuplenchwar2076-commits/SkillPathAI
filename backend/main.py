import os
from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI, HTTPException, Depends
from database.mysql import SessionLocal
from models.user import User
from schemas.user import UserCreate, UserResponse
from models.profile import Profile
from schemas.profile import ProfileCreate, ProfileUpdate
from models.assessment import Assessment
from schemas.assessment import AssessmentCreate
from models.roadmap import Roadmap
from schemas.roadmap import RoadmapCreate, AIRoadmapRequest
from models.topic import Topic
from schemas.topic import TopicCreate, TopicUpdate 
from models.progress import Progress
from schemas.progress import ProgressCreate, ProgressUpdate
from models.quiz_result import QuizResult
from schemas.quiz_result import QuizResultCreate
from services.ai_services import test_gemini, generate_roadmap, explain_topic
from schemas.ai import TopicExplanationRequest
from auth import verify_token

app = FastAPI()

# Configurable CORS origins supporting production deployment, Vercel deployments, and localhost
cors_origins_env = os.getenv("CORS_ORIGINS", "")
allowed_origins = [origin.strip() for origin in cors_origins_env.split(",") if origin.strip()]

default_origins = [
    "http://localhost:5500",
    "http://127.0.0.1:5500",
    "https://skillpathai-frontend-fmhrbvpgv.vercel.app",
    "https://skillpathai-frontend.vercel.app"
]
for default_origin in default_origins:
    if default_origin not in allowed_origins:
        allowed_origins.append(default_origin)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"^https:\/\/.*\.vercel\.app$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



@app.get("/")
def home():
    return {"message": "SkillPathAI Backend is running!"}


@app.get("/db-test")
def db_test():
    db = SessionLocal()
    try:
        from sqlalchemy import text
        version = db.execute(text("SELECT VERSION()")).scalar()
        database_name = db.execute(text("SELECT DATABASE()")).scalar()
        tables = db.execute(text("SHOW TABLES")).scalars().all()
        return {
            "message": "FastAPI connected to MySQL!",
            "database": database_name,
            "version": version,
            "tables": tables
        }
    except Exception as e:
        return {"error": str(e), "type": type(e).__name__}
    finally:
        db.close()


def get_authenticated_user(token: dict, db) -> User:
    firebase_uid = token.get("uid")
    if not firebase_uid:
        raise HTTPException(status_code=401, detail="Invalid token: missing UID")
    user = db.query(User).filter(User.firebase_uid == firebase_uid).first()
    if not user:
        raise HTTPException(
            status_code=404,
            detail="Authenticated user not found in database. Please sync user first."
        )
    return user

@app.post("/users/sync", response_model=UserResponse)
def sync_user(token: dict = Depends(verify_token)):
    firebase_uid = token.get("uid")
    email = token.get("email")
    name = token.get("name") or (email.split("@")[0] if email else "User")

    if not firebase_uid:
        raise HTTPException(status_code=400, detail="Invalid token: missing UID")

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.firebase_uid == firebase_uid).first()
        if user:
            return user

        if email:
            existing_by_email = db.query(User).filter(User.email == email).first()
            if existing_by_email:
                if existing_by_email.firebase_uid is None:
                    existing_by_email.firebase_uid = firebase_uid
                    db.commit()
                    db.refresh(existing_by_email)
                    return existing_by_email
                elif existing_by_email.firebase_uid != firebase_uid:
                    raise HTTPException(
                        status_code=409,
                        detail="An account with this email is already linked to another Firebase identity."
                    )

        fallback_email = str(firebase_uid) + "@skillpath.local"
        new_user = User(
            name=name,
            email=email if email else fallback_email,
            firebase_uid=firebase_uid,
            career_goal="Not Set"
        )
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        return new_user

    finally:
        db.close()

@app.post("/users")
def create_user(user: UserCreate):
    db = SessionLocal()

    try:
        new_user = User(
            name=user.name,
            email=user.email,
            career_goal=user.career_goal
        )

        db.add(new_user)
        db.commit()
        db.refresh(new_user)

        return {
            "message": "User created successfully!",
            "user_id": new_user.user_id
        }

    finally:
        db.close()

@app.post("/profiles")
def create_profile(profile: ProfileCreate):
    db = SessionLocal()

    try:
        new_profile = Profile(
            user_id=profile.user_id,
            education=profile.education,
            interests=profile.interests,
            current_skills=profile.current_skills,
            skill_level=profile.skill_level
        )

        db.add(new_profile)
        db.commit()
        db.refresh(new_profile)

        return {
            "message": "Profile created successfully!",
            "profile_id": new_profile.profile_id
        }

    finally:
        db.close()

@app.get("/profiles/{user_id}")
def get_profile(user_id: int, token: dict = Depends(verify_token)):
    db = SessionLocal()

    try:
        profile = db.query(Profile).filter(Profile.user_id == user_id).first()

        if not profile:
            return {"message": "Profile not found"}

        return {
            "profile_id": profile.profile_id,
            "user_id": profile.user_id,
            "education": profile.education,
            "interests": profile.interests,
            "current_skills": profile.current_skills,
            "skill_level": profile.skill_level
        }

    finally:
        db.close()    
@app.patch("/profiles/{user_id}")
def update_profile(user_id: int, profile: ProfileUpdate):
    db = SessionLocal()

    try:
        existing_profile = db.query(Profile).filter(
            Profile.user_id == user_id
        ).first()

        if not existing_profile:
            return {"message": "Profile not found"}

        if profile.education is not None:
            existing_profile.education = profile.education

        if profile.interests is not None:
            existing_profile.interests = profile.interests

        if profile.current_skills is not None:
            existing_profile.current_skills = profile.current_skills

        if profile.skill_level is not None:
            existing_profile.skill_level = profile.skill_level

        db.commit()
        db.refresh(existing_profile)

        return {
            "message": "Profile updated successfully!",
            "profile_id": existing_profile.profile_id
        }

    finally:
        db.close()

@app.post("/assessments")
def create_assessment(
    assessment: AssessmentCreate,
    token: dict = Depends(verify_token)
):
    firebase_uid = token.get("uid")
    if not firebase_uid:
        raise HTTPException(status_code=400, detail="Invalid token: missing UID")

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.firebase_uid == firebase_uid).first()
        if not user:
            raise HTTPException(status_code=404, detail="Authenticated user not found in database. Please sync user first.")

        if user.user_id != assessment.user_id:
            raise HTTPException(status_code=403, detail="Forbidden: Cannot submit assessment for another user.")

        new_assessment = Assessment(
            user_id=user.user_id,
            score=assessment.score,
            skill_level=assessment.skill_level
        )

        db.add(new_assessment)
        db.commit()
        db.refresh(new_assessment)

        return {
            "message": "Assessment created successfully!",
            "assessment_id": new_assessment.assessment_id,
            "user_id": new_assessment.user_id,
            "score": float(new_assessment.score),
            "skill_level": new_assessment.skill_level
        }

    finally:
        db.close()
@app.get("/assessments/{user_id}")
def get_assessments(user_id: int, token: dict = Depends(verify_token)):
    db = SessionLocal()

    try:
        current_user = get_authenticated_user(token, db)
        if current_user.user_id != user_id:
            raise HTTPException(status_code=403, detail="Forbidden: Cannot view assessments of another user.")

        assessments = db.query(Assessment).filter(
            Assessment.user_id == user_id
        ).order_by(Assessment.assessment_id.desc()).all()

        return [
            {
                "assessment_id": assessment.assessment_id,
                "user_id": assessment.user_id,
                "score": float(assessment.score),
                "skill_level": assessment.skill_level,
                "completed_at": assessment.completed_at
            }
            for assessment in assessments
        ]

    finally:
        db.close()

@app.post("/roadmaps")
def create_roadmap(roadmap: RoadmapCreate, token: dict = Depends(verify_token)):
    db = SessionLocal()

    try:
        current_user = get_authenticated_user(token, db)
        if current_user.user_id != roadmap.user_id:
            raise HTTPException(status_code=403, detail="Forbidden: Cannot create roadmap for another user.")

        new_roadmap = Roadmap(
            user_id=roadmap.user_id,
            career_path=roadmap.career_path
        )

        db.add(new_roadmap)
        db.commit()
        db.refresh(new_roadmap)

        return {
            "message": "Roadmap created successfully!",
            "roadmap_id": new_roadmap.roadmap_id
        }

    finally:
        db.close()

@app.get("/roadmaps/{user_id}")
def get_roadmaps(user_id: int, token: dict = Depends(verify_token)):
    db = SessionLocal()

    try:
        current_user = get_authenticated_user(token, db)
        if current_user.user_id != user_id:
            raise HTTPException(status_code=403, detail="Forbidden: Cannot view roadmaps of another user.")

        roadmaps = db.query(Roadmap).filter(
            Roadmap.user_id == user_id
        ).order_by(Roadmap.roadmap_id.desc()).all()

        return [
            {
                "roadmap_id": roadmap.roadmap_id,
                "user_id": roadmap.user_id,
                "career_path": roadmap.career_path,
                "created_at": roadmap.created_at
            }
            for roadmap in roadmaps
        ]

    finally:
        db.close()

@app.post("/topics")
def create_topic(topic: TopicCreate, token: dict = Depends(verify_token)):
    db = SessionLocal()

    try:
        current_user = get_authenticated_user(token, db)
        roadmap = db.query(Roadmap).filter(Roadmap.roadmap_id == topic.roadmap_id).first()
        if not roadmap:
            raise HTTPException(status_code=404, detail="Roadmap not found")
        if roadmap.user_id != current_user.user_id:
            raise HTTPException(status_code=403, detail="Forbidden: Cannot add topics to another user's roadmap.")

        new_topic = Topic(
            roadmap_id=topic.roadmap_id,
            topic_name=topic.topic_name,
            sequence_no=topic.sequence_no,
            status=topic.status
        )

        db.add(new_topic)
        db.commit()
        db.refresh(new_topic)

        return {
            "message": "Topic created successfully!",
            "topic_id": new_topic.topic_id
        }

    finally:
        db.close()
@app.get("/topics/{roadmap_id}")
def get_topics(roadmap_id: int, token: dict = Depends(verify_token)):
    db = SessionLocal()

    try:
        current_user = get_authenticated_user(token, db)
        roadmap = db.query(Roadmap).filter(Roadmap.roadmap_id == roadmap_id).first()
        if not roadmap:
            raise HTTPException(status_code=404, detail="Roadmap not found")
        if roadmap.user_id != current_user.user_id:
            raise HTTPException(status_code=403, detail="Forbidden: Cannot view topics of another user's roadmap.")

        topics = db.query(Topic).filter(
            Topic.roadmap_id == roadmap_id
        ).order_by(Topic.sequence_no).all()

        return [
            {
                "topic_id": topic.topic_id,
                "roadmap_id": topic.roadmap_id,
                "topic_name": topic.topic_name,
                "sequence_no": topic.sequence_no,
                "status": topic.status
            }
            for topic in topics
        ]

    finally:
        db.close()

@app.get("/topics/by-id/{topic_id}")
def get_topic_by_id(topic_id: int, token: dict = Depends(verify_token)):
    db = SessionLocal()

    try:
        current_user = get_authenticated_user(token, db)
        topic = db.query(Topic).filter(Topic.topic_id == topic_id).first()
        if not topic:
            raise HTTPException(status_code=404, detail="Topic not found")

        roadmap = db.query(Roadmap).filter(Roadmap.roadmap_id == topic.roadmap_id).first()
        if not roadmap or roadmap.user_id != current_user.user_id:
            raise HTTPException(status_code=403, detail="Forbidden: Cannot access topic from another user's roadmap.")

        return {
            "topic_id": topic.topic_id,
            "roadmap_id": topic.roadmap_id,
            "topic_name": topic.topic_name,
            "sequence_no": topic.sequence_no,
            "status": topic.status
        }

    finally:
        db.close()

@app.patch("/topics/{topic_id}")
def update_topic(topic_id: int, topic: TopicUpdate, token: dict = Depends(verify_token)):
    db = SessionLocal()

    try:
        current_user = get_authenticated_user(token, db)
        existing_topic = db.query(Topic).filter(
            Topic.topic_id == topic_id
        ).first()

        if not existing_topic:
            raise HTTPException(status_code=404, detail="Topic not found")

        roadmap = db.query(Roadmap).filter(Roadmap.roadmap_id == existing_topic.roadmap_id).first()
        if not roadmap or roadmap.user_id != current_user.user_id:
            raise HTTPException(status_code=403, detail="Forbidden: Cannot modify topic of another user's roadmap.")

        if topic.topic_name is not None:
            existing_topic.topic_name = topic.topic_name

        if topic.sequence_no is not None:
            existing_topic.sequence_no = topic.sequence_no

        if topic.status is not None:
            existing_topic.status = topic.status

        db.commit()
        db.refresh(existing_topic)

        return {
            "message": "Topic updated successfully!",
            "topic_id": existing_topic.topic_id
        }

    finally:
        db.close()

@app.post("/progress")
def create_progress(progress: ProgressCreate, token: dict = Depends(verify_token)):
    db = SessionLocal()

    try:
        current_user = get_authenticated_user(token, db)
        if current_user.user_id != progress.user_id:
            raise HTTPException(status_code=403, detail="Forbidden: Cannot record progress for another user.")

        new_progress = Progress(
            user_id=progress.user_id,
            topic_id=progress.topic_id,
            completion_percentage=progress.completion_percentage,
            status=progress.status
        )

        db.add(new_progress)
        db.commit()
        db.refresh(new_progress)

        return {
            "message": "Progress created successfully!",
            "progress_id": new_progress.progress_id
        }

    finally:
        db.close()


@app.get("/progress/{user_id}")
def get_progress(user_id: int, token: dict = Depends(verify_token)):
    db = SessionLocal()

    try:
        current_user = get_authenticated_user(token, db)
        if current_user.user_id != user_id:
            raise HTTPException(status_code=403, detail="Forbidden: Cannot view progress of another user.")

        progress_data = db.query(Progress).filter(
            Progress.user_id == user_id
        ).all()

        return [
            {
                "progress_id": progress.progress_id,
                "user_id": progress.user_id,
                "topic_id": progress.topic_id,
                "completion_percentage": progress.completion_percentage,
                "status": progress.status,
                "last_updated": progress.last_updated
            }
            for progress in progress_data
        ]

    finally:
        db.close()


@app.patch("/progress/{progress_id}")
def update_progress(progress_id: int, progress: ProgressUpdate, token: dict = Depends(verify_token)):
    db = SessionLocal()

    try:
        current_user = get_authenticated_user(token, db)
        existing_progress = db.query(Progress).filter(
            Progress.progress_id == progress_id
        ).first()

        if not existing_progress:
            raise HTTPException(status_code=404, detail="Progress not found")

        if existing_progress.user_id != current_user.user_id:
            raise HTTPException(status_code=403, detail="Forbidden: Cannot modify progress of another user.")

        if progress.completion_percentage is not None:
            existing_progress.completion_percentage = progress.completion_percentage

        if progress.status is not None:
            existing_progress.status = progress.status

        db.commit()
        db.refresh(existing_progress)

        return {
            "message": "Progress updated successfully!",
            "progress_id": existing_progress.progress_id
        }

    finally:
        db.close()

@app.post("/quiz-results")
def create_quiz_result(result: QuizResultCreate, token: dict = Depends(verify_token)):
    db = SessionLocal()

    try:
        current_user = get_authenticated_user(token, db)
        if current_user.user_id != result.user_id:
            raise HTTPException(status_code=403, detail="Forbidden: Cannot submit quiz results for another user.")

        # Validate total_questions and score bounds
        if result.total_questions <= 0:
            raise HTTPException(status_code=400, detail="Invalid quiz result: total_questions must be greater than zero.")
        if result.score < 0:
            raise HTTPException(status_code=400, detail="Invalid quiz result: score cannot be negative.")
        if result.score > result.total_questions:
            raise HTTPException(status_code=400, detail="Invalid quiz result: score cannot exceed total_questions.")

        # Validate topic exists and belongs to a roadmap owned by the authenticated user
        topic = db.query(Topic).filter(Topic.topic_id == result.topic_id).first()
        if not topic:
            raise HTTPException(status_code=404, detail="Topic not found.")

        roadmap = db.query(Roadmap).filter(Roadmap.roadmap_id == topic.roadmap_id).first()
        if not roadmap or roadmap.user_id != current_user.user_id:
            raise HTTPException(status_code=403, detail="Forbidden: Cannot submit quiz results for a topic that does not belong to your roadmap.")

        # Calculate attempt_no on the backend
        existing_attempts_count = db.query(QuizResult).filter(
            QuizResult.user_id == current_user.user_id,
            QuizResult.topic_id == result.topic_id
        ).count()
        next_attempt_no = existing_attempts_count + 1

        new_result = QuizResult(
            user_id=current_user.user_id,
            topic_id=result.topic_id,
            score=result.score,
            total_questions=result.total_questions,
            attempt_no=next_attempt_no
        )

        db.add(new_result)
        db.commit()
        db.refresh(new_result)

        return {
            "message": "Quiz result created successfully!",
            "result_id": new_result.result_id,
            "user_id": new_result.user_id,
            "topic_id": new_result.topic_id,
            "score": float(new_result.score),
            "total_questions": new_result.total_questions,
            "attempt_no": new_result.attempt_no
        }

    finally:
        db.close()


@app.get("/quiz-results/{user_id}")
def get_quiz_results(user_id: int, token: dict = Depends(verify_token)):
    db = SessionLocal()

    try:
        current_user = get_authenticated_user(token, db)
        if current_user.user_id != user_id:
            raise HTTPException(status_code=403, detail="Forbidden: Cannot view quiz results of another user.")

        results = db.query(QuizResult).filter(
            QuizResult.user_id == user_id
        ).order_by(QuizResult.result_id.desc()).all()

        return [
            {
                "result_id": result.result_id,
                "user_id": result.user_id,
                "topic_id": result.topic_id,
                "score": float(result.score),
                "total_questions": result.total_questions,
                "attempt_no": result.attempt_no,
                "completed_at": result.completed_at
            }
            for result in results
        ]

    finally:
        db.close()

@app.get("/ai-test")
def ai_test():
    response = test_gemini()

    return {
        "message": "Gemini is working!",
        "response": response
    }
@app.post("/generate-roadmap")
def generate_ai_roadmap(data: AIRoadmapRequest):

    db = SessionLocal()

    try:
        # Generate roadmap using Gemini
        roadmap = generate_roadmap(
            career_goal=data.career_goal,
            current_skills=data.current_skills,
            interests=data.interests,
            skill_level=data.skill_level,
            assessment_score=data.assessment_score
        )

        # Save roadmap
        new_roadmap = Roadmap(
            user_id=data.user_id,
            career_path=roadmap.career_path
        )

        db.add(new_roadmap)
        db.flush()

        # Save each topic
        for topic in roadmap.topics:
            new_topic = Topic(
                roadmap_id=new_roadmap.roadmap_id,
                topic_name=topic.topic_name,
                sequence_no=topic.sequence_no,
                status="Not Started"
            )

            db.add(new_topic)

        db.commit()

        return {
            "message": "AI roadmap generated and saved successfully!",
            "roadmap_id": new_roadmap.roadmap_id,
            "career_path": roadmap.career_path,
            "topics": roadmap.topics
        }

    except Exception as e:
        db.rollback()
        return {
            "error": str(e)
        }

    finally:
        db.close()

@app.post("/generate-roadmap/{user_id}")
def generate_roadmap_for_user(user_id: int):

    db = SessionLocal()

    try:
        # Get user
        user = db.query(User).filter(User.user_id == user_id).first()

        if not user:
            raise HTTPException(
                status_code=404,
                detail="User not found"
            )

        # Get profile
        profile = db.query(Profile).filter(
            Profile.user_id == user_id
        ).first()

        if not profile:
            raise HTTPException(
                status_code=404,
                detail="Profile not found for this user"
            )

        # Get latest assessment
        assessment = (
            db.query(Assessment)
            .filter(Assessment.user_id == user_id)
            .order_by(Assessment.assessment_id.desc())
            .first()
        )

        if not assessment:
            raise HTTPException(
                status_code=404,
                detail="Assessment not found for this user"
            )

        # Generate roadmap using user's database data
        roadmap = generate_roadmap(
            career_goal=user.career_goal,
            current_skills=profile.current_skills,
            interests=profile.interests,
            skill_level=profile.skill_level,
            assessment_score=float(assessment.score)
        )

        # Save roadmap
        new_roadmap = Roadmap(
            user_id=user_id,
            career_path=roadmap.career_path
        )

        db.add(new_roadmap)
        db.flush()

        # Save topics
        for topic in roadmap.topics:
            new_topic = Topic(
                roadmap_id=new_roadmap.roadmap_id,
                topic_name=topic.topic_name,
                sequence_no=topic.sequence_no,
                status="Not Started"
            )

            db.add(new_topic)

        db.commit()

        return {
            "message": "Personalized roadmap generated successfully!",
            "user_id": user_id,
            "roadmap_id": new_roadmap.roadmap_id,
            "career_path": roadmap.career_path,
            "topics": roadmap.topics
        }

    except HTTPException:
        raise

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

    finally:
        db.close()
@app.post("/explain-topic")
def explain_topic_api(data: TopicExplanationRequest, token: dict = Depends(verify_token)):
    try:
        explanation = explain_topic(
            topic_name=data.topic_name,
            skill_level=data.skill_level
        )
    except Exception as e:
        err_msg = str(e)
        if "timed out" in err_msg.lower() or "timeout" in err_msg.lower():
            raise HTTPException(
                status_code=504,
                detail="AI request timed out. The upstream model took too long to respond. Please try again."
            )
        if "503" in err_msg or "service_unavailable" in err_msg or "high demand" in err_msg:
            raise HTTPException(
                status_code=503,
                detail="The AI assistant is temporarily experiencing high demand. Please try again in a few moments."
            )
        raise HTTPException(
            status_code=500,
            detail=f"Unable to generate explanation: {err_msg}"
        )

    return {
        "topic": data.topic_name,
        "skill_level": data.skill_level,
        "explanation": explanation
    }
@app.get("/auth-test")
def auth_test(token: dict = Depends(verify_token)):
    return {
        "message": "Firebase authentication successful!",
        "uid": token["uid"],
        "email": token.get("email")
    }
@app.get("/performance/{user_id}")
def get_performance(user_id: int, token: dict = Depends(verify_token)):
    db = SessionLocal()

    try:
        current_user = get_authenticated_user(token, db)
        if current_user.user_id != user_id:
            raise HTTPException(status_code=403, detail="Forbidden: Cannot view performance of another user.")

        results = (
            db.query(QuizResult)
            .filter(QuizResult.user_id == user_id)
            .all()
        )

        if not results:
            return {
                "user_id": user_id,
                "performance": []
            }

        topic_data = {}

        for result in results:
            if result.topic_id not in topic_data:
                topic_data[result.topic_id] = {
                    "total_percentage": 0,
                    "attempts": 0
                }

            percentage = (
                float(result.score) / result.total_questions
            ) * 100

            topic_data[result.topic_id]["total_percentage"] += percentage
            topic_data[result.topic_id]["attempts"] += 1

        performance = []

        for topic_id, data in topic_data.items():

            average_percentage = (
                data["total_percentage"] / data["attempts"]
            )

            if average_percentage < 50:
                level = "Weak"
                needs_practice = True

            elif average_percentage < 75:
                level = "Needs Improvement"
                needs_practice = True

            else:
                level = "Good"
                needs_practice = False

            performance.append({
                "topic_id": topic_id,
                "average_percentage": round(average_percentage, 2),
                "attempts": data["attempts"],
                "performance_level": level,
                "needs_practice": needs_practice
            })

        return {
            "user_id": user_id,
            "performance": performance
        }

    finally:

        db.close()
   