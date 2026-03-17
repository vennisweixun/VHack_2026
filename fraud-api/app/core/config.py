from pydantic_settings import BaseSettings
from pydantic import Field
from functools import lru_cache


class Settings(BaseSettings):
    # MongoDB
    mongodb_url: str = Field(default="mongodb://localhost:27017", alias="MONGODB_URL")
    mongodb_db_name: str = Field(default="fraudshield", alias="MONGODB_DB_NAME")

    # XGBoost model path (from fraud_model_pipeline.py + patch_pkl.py)
    model_path: str = Field(default=r"C:\FraudShield\fraud_model.pkl", alias="MODEL_PATH")

    # Risk thresholds
    approved_threshold: float = Field(default=0.40, alias="APPROVED_THRESHOLD")
    block_threshold:    float = Field(default=0.75, alias="BLOCK_THRESHOLD")

    # JWT / Auth
    jwt_secret: str = Field(default="change-me-in-production-use-a-long-random-string", alias="JWT_SECRET")
    jwt_algorithm: str = Field(default="HS256", alias="JWT_ALGORITHM")
    jwt_expire_minutes: int = Field(default=60 * 24, alias="JWT_EXPIRE_MINUTES")  # 24 hours

    # App
    app_env:    str = Field(default="development", alias="APP_ENV")
    api_prefix: str = Field(default="/api/v1",     alias="API_PREFIX")

    model_config = {"env_file": ".env", "populate_by_name": True}


@lru_cache()
def get_settings() -> Settings:
    return Settings()
