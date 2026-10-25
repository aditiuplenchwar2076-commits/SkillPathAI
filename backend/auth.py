import os
import json
import firebase_admin
from firebase_admin import auth, credentials
from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials


# Initialize Firebase Admin only once
if not firebase_admin._apps:
    env_service_account = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON")
    
    if env_service_account and env_service_account.strip():
        # Production deployment: Read credentials directly from environment variable
        try:
            cred_dict = json.loads(env_service_account.strip())
            credential = credentials.Certificate(cred_dict)
            firebase_admin.initialize_app(credential)
        except json.JSONDecodeError as jde:
            raise ValueError(f"Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON environment variable: {jde}")
        except Exception as e:
            raise RuntimeError(f"Failed to initialize Firebase Admin from environment variable: {e}")
    else:
        # Local development default: Load from local service account JSON file
        credential_path = os.path.join(
            os.path.dirname(os.path.abspath(__file__)),
            "firebase-service-account.json"
        )

        if not os.path.exists(credential_path):
            raise FileNotFoundError(
                "Firebase service account JSON file not found and FIREBASE_SERVICE_ACCOUNT_JSON is not configured."
            )

        credential = credentials.Certificate(credential_path)
        firebase_admin.initialize_app(credential)


bearer_scheme = HTTPBearer()


def verify_token(
    credentials_header: HTTPAuthorizationCredentials = Depends(bearer_scheme)
):
    try:
        decoded_token = auth.verify_id_token(credentials_header.credentials)
        return decoded_token

    except Exception:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired Firebase authentication token."
        )
