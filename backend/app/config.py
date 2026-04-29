"""Configuration de l'application GrowManager"""
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Settings centralisés de l'application"""

    database_url: str = "mysql+pymysql://grow:grow2024@localhost:3306/growmanager"
    secret_key: str = "changeme-in-production"

    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()
