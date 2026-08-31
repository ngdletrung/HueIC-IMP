import os
import urllib.parse
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "HueIC Internal Management Portal"
    API_V1_STR: str = "/api/v1"
    
    # PostgreSQL Configuration
    POSTGRES_SERVER: str = os.getenv("POSTGRES_SERVER", "db")
    POSTGRES_PORT: str = os.getenv("POSTGRES_PORT", "5432")
    POSTGRES_USER: str = os.getenv("POSTGRES_USER", "hueic_admin")
    POSTGRES_PASSWORD: str = os.getenv("POSTGRES_PASSWORD", "HueIC_SecurePass2026")
    POSTGRES_DB: str = os.getenv("POSTGRES_DB", "hueic_imp_db")
    
    @property
    def DATABASE_URL(self) -> str:
        env_url = os.getenv("DATABASE_URL")
        if env_url:
            return env_url
        pwd = urllib.parse.quote_plus(self.POSTGRES_PASSWORD)
        user = urllib.parse.quote_plus(self.POSTGRES_USER)
        return f"postgresql://{user}:{pwd}@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"

    # JWT Authentication
    SECRET_KEY: str = os.getenv("SECRET_KEY", "hueic_super_secret_jwt_key_random_string_2026_change_in_production")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "480"))
    
    # Security Policy: Account Lockout & Rate Limit
    MAX_FAILED_LOGIN_ATTEMPTS: int = int(os.getenv("MAX_FAILED_LOGIN_ATTEMPTS", "5"))
    LOCKOUT_DURATION_MINUTES: int = int(os.getenv("LOCKOUT_DURATION_MINUTES", "15"))

    # Initial SuperAdmin
    FIRST_SUPERADMIN_EMAIL: str = os.getenv("FIRST_SUPERADMIN_EMAIL", "admin@hueic.edu.vn")
    FIRST_SUPERADMIN_USERNAME: str = os.getenv("FIRST_SUPERADMIN_USERNAME", "admin")
    FIRST_SUPERADMIN_PASSWORD: str = os.getenv("FIRST_SUPERADMIN_PASSWORD", "HueIC@2026!")
    FIRST_SUPERADMIN_FULLNAME: str = os.getenv("FIRST_SUPERADMIN_FULLNAME", "Quản Trị Viên Hệ Thống HueIC")

    class Config:
        case_sensitive = True
        env_file = ".env"
        extra = "allow"

settings = Settings()

