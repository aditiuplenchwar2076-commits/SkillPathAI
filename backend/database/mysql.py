import os
import re
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.engine import make_url
from sqlalchemy.orm import sessionmaker, declarative_base

# Load environment from backend/.env or root .env
_backend_dir = os.path.dirname(os.path.abspath(__file__))
_env_path = os.path.join(_backend_dir, "..", ".env")
if os.path.exists(_env_path):
    load_dotenv(_env_path)
load_dotenv()

raw_database_url = os.getenv("DATABASE_URL")

# Resolve optional custom CA certificate path: DB_SSL_CA or backend/ca.pem
default_ca_path = os.path.join(_backend_dir, "..", "ca.pem")
if not os.path.exists(default_ca_path):
    default_ca_path = os.path.join(_backend_dir, "ca.pem")

env_ca_path = os.getenv("DB_SSL_CA")
ssl_ca_path = env_ca_path if (env_ca_path and os.path.exists(env_ca_path)) else (default_ca_path if os.path.exists(default_ca_path) else None)

ssl_mode = os.getenv("DB_SSL_MODE", "").lower()

connect_args = {
    "connect_timeout": 15
}

if raw_database_url and raw_database_url.strip():
    # Primary configuration: Environment-based DATABASE_URL (TiDB Cloud Starter / Cloud MySQL)
    # Strip any whitespace and quotes (e.g. from pasted environment variables)
    raw_str = raw_database_url.strip().strip("'\"")

    # Normalize scheme to mysql+pymysql (handles mysql://, mysql+mysqldb://, mysql+pymysql://, etc.)
    raw_str = re.sub(r"^mysql(\+[a-zA-Z0-9_]+)?://", "mysql+pymysql://", raw_str, flags=re.IGNORECASE)

    parsed_url = make_url(raw_str)

    # Explicitly enforce drivername='mysql+pymysql' on the SQLAlchemy URL object to prevent
    # SQLAlchemy from ever attempting to import the C-extension 'MySQLdb'
    if parsed_url.get_backend_name() == "mysql":
        parsed_url = parsed_url.set(drivername="mysql+pymysql")

    query_dict = dict(parsed_url.query)

    # PyMySQL does not accept 'ssl-mode' or 'ssl_mode' as direct keyword arguments; strip safely
    ssl_mode_in_url = query_dict.pop("ssl-mode", None) or query_dict.pop("ssl_mode", None)

    # If ssl_ca is specified in URL query, ensure the file actually exists on this host OS
    url_ssl_ca = query_dict.get("ssl_ca")
    if url_ssl_ca and not os.path.exists(url_ssl_ca):
        import certifi
        query_dict["ssl_ca"] = certifi.where()

    clean_url = parsed_url._replace(query=query_dict)

    # Configure SSL/TLS for TiDB Cloud and hosted/remote databases
    host_lower = (clean_url.host or "").lower()
    is_remote_host = host_lower not in ("localhost", "127.0.0.1", "")
    is_cloud_db = "tidbcloud.com" in host_lower or clean_url.port == 4000 or "aivencloud.com" in host_lower

    if "ssl_ca" not in query_dict:
        if ssl_ca_path and os.path.exists(ssl_ca_path):
            connect_args["ssl"] = {"ca": ssl_ca_path}
        elif is_cloud_db or is_remote_host or ssl_mode in ("required", "true", "1") or ssl_mode_in_url:
            import certifi
            connect_args["ssl"] = {"ca": certifi.where()}

    target_engine_url = clean_url
else:
    # Fallback configuration: Discrete environment variables (Local development default)
    DB_USER = os.getenv("DB_USER", "root")
    DB_PASSWORD = os.getenv("DB_PASSWORD", "")
    DB_HOST = os.getenv("DB_HOST", "localhost")
    DB_PORT = os.getenv("DB_PORT", "3306")
    DB_NAME = os.getenv("DB_NAME", "skillpathai")

    target_engine_url = (
        f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}"
        f"@{DB_HOST}:{DB_PORT}/{DB_NAME}"
    )

    is_remote_host = DB_HOST.lower() not in ("localhost", "127.0.0.1", "")
    if is_remote_host or ssl_mode in ("required", "true", "1") or env_ca_path:
        if ssl_ca_path and os.path.exists(ssl_ca_path):
            connect_args["ssl"] = {"ca": ssl_ca_path}
        elif ssl_mode in ("required", "true", "1"):
            import certifi
            connect_args["ssl"] = {"ca": certifi.where()}

# TiDB Cloud Serverless / Starter recommends pool_recycle=300 (5 mins) and pool_pre_ping=True
# to prevent stale dropped connections from cloud load balancers.
engine_kwargs = {
    "pool_pre_ping": True,
    "pool_recycle": 300,
}
if connect_args:
    engine_kwargs["connect_args"] = connect_args

# Create the engine using the validated mysql+pymysql URL
engine = create_engine(target_engine_url, **engine_kwargs)

Base = declarative_base()

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

print("Database connection engine configured successfully!")
