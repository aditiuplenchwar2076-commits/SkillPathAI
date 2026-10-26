import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.engine import make_url
from sqlalchemy.orm import sessionmaker, declarative_base

load_dotenv()

raw_database_url = os.getenv("DATABASE_URL")

# Resolve CA certificate path: DB_SSL_CA, backend/ca.pem, or root ca.pem
default_ca_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "ca.pem")
if not os.path.exists(default_ca_path):
    default_ca_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ca.pem")

env_ca_path = os.getenv("DB_SSL_CA")
ssl_ca_path = env_ca_path if (env_ca_path and os.path.exists(env_ca_path)) else (default_ca_path if os.path.exists(default_ca_path) else None)

# Also support embedding CA cert directly in environment variable (e.g. AIVEN_CA_CERT)
env_ca_content = os.getenv("AIVEN_CA_CERT") or os.getenv("DB_CA_CERT")
if not ssl_ca_path and env_ca_content and env_ca_content.strip():
    temp_ca_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "aiven_ca_runtime.pem")
    try:
        with open(temp_ca_path, "w", encoding="utf-8") as f:
            f.write(env_ca_content.strip())
        ssl_ca_path = temp_ca_path
    except Exception as _ca_write_err:
        print(f"Warning: unable to write runtime CA certificate: {_ca_write_err}")

ssl_mode = os.getenv("DB_SSL_MODE", "").lower()

connect_args = {
    "connect_timeout": 15
}

if raw_database_url and raw_database_url.strip():
    # If a full DATABASE_URL is provided (e.g. from Aiven or cloud host)
    raw_str = raw_database_url.strip()
    if raw_str.startswith("mysql://"):
        raw_str = raw_str.replace("mysql://", "mysql+pymysql://", 1)

    parsed_url = make_url(raw_str)
    query_dict = dict(parsed_url.query)
    
    # PyMySQL does not accept 'ssl-mode' as a connection keyword argument; strip it safely
    ssl_mode_in_url = query_dict.pop("ssl-mode", None) or query_dict.pop("ssl_mode", None)
    clean_url = parsed_url._replace(query=query_dict)
    database_url = clean_url.render_as_string(hide_password=False)

    # Configure SSL for hosted/remote database
    if ssl_ca_path and os.path.exists(ssl_ca_path):
        connect_args["ssl"] = {"ca": ssl_ca_path}
    elif ssl_mode in ("required", "true", "1") or ssl_mode_in_url or "aivencloud.com" in database_url:
        import certifi
        connect_args["ssl"] = {"ca": certifi.where()}
else:
    # Fallback to discrete environment variables (local development default)
    DB_USER = os.getenv("DB_USER", "root")
    DB_PASSWORD = os.getenv("DB_PASSWORD", "")
    DB_HOST = os.getenv("DB_HOST", "localhost")
    DB_PORT = os.getenv("DB_PORT", "3306")
    DB_NAME = os.getenv("DB_NAME", "skillpathai")

    database_url = (
        f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}"
        f"@{DB_HOST}:{DB_PORT}/{DB_NAME}"
    )

    # For local discrete variables, only apply SSL if explicitly requested or if connecting to a remote host
    is_remote_host = DB_HOST.lower() not in ("localhost", "127.0.0.1", "")
    if is_remote_host or ssl_mode in ("required", "true", "1") or env_ca_path:
        if ssl_ca_path and os.path.exists(ssl_ca_path):
            connect_args["ssl"] = {"ca": ssl_ca_path}
        elif ssl_mode in ("required", "true", "1"):
            import certifi
            connect_args["ssl"] = {"ca": certifi.where()}

engine_kwargs = {
    "pool_pre_ping": True,
    "pool_recycle": 1800,
}
if connect_args:
    engine_kwargs["connect_args"] = connect_args

engine = create_engine(database_url, **engine_kwargs)

Base = declarative_base()

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

print("MySQL connection configured successfully!")
