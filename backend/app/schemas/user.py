from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime
from app.models.user import UserRole
from app.schemas.department import DepartmentOut

class UserBase(BaseModel):
    username: str
    email: EmailStr
    full_name: str
    role: UserRole = UserRole.STAFF
    position: Optional[str] = None
    phone: Optional[str] = None
    department_id: Optional[int] = None
    permissions: List[str] = []
    is_active: bool = True

class UserCreate(UserBase):
    password: str

class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    role: Optional[UserRole] = None
    position: Optional[str] = None
    phone: Optional[str] = None
    department_id: Optional[int] = None
    permissions: Optional[List[str]] = None
    password: Optional[str] = None
    is_active: Optional[bool] = None

class UserPermissionsUpdate(BaseModel):
    permissions: List[str]

class UserOut(BaseModel):
    id: int
    username: str
    email: EmailStr
    full_name: str
    role: UserRole
    position: Optional[str] = None
    phone: Optional[str] = None
    department_id: Optional[int] = None
    department: Optional[DepartmentOut] = None
    permissions: List[str] = []
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
