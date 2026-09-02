from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime

class DepartmentBase(BaseModel):
    code: str
    name: str
    description: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    is_active: bool = True
    parent_id: Optional[int] = None
    path: Optional[str] = None
    type: Optional[str] = "DEPARTMENT" # DEPARTMENT, FACULTY, CENTER, SECTION, WORKSHOP, BGH
    order_index: Optional[int] = 0

class DepartmentCreate(DepartmentBase):
    pass

class DepartmentUpdate(BaseModel):
    code: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    is_active: Optional[bool] = None
    parent_id: Optional[int] = None
    path: Optional[str] = None
    type: Optional[str] = None
    order_index: Optional[int] = None

class DepartmentOut(DepartmentBase):
    id: int
    parent_code: Optional[str] = None
    parent_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

