from pydantic import BaseModel
from typing import Optional
from app.models.user import UserRole

class Token(BaseModel):
    access_token: str
    token_type: str
    user_id: int
    username: str
    full_name: str
    role: UserRole
    department_id: Optional[int] = None
    department_name: Optional[str] = None

class TokenPayload(BaseModel):
    sub: Optional[str] = None

class LoginRequest(BaseModel):
    username: str
    password: str
