from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from app.schemas.department import DepartmentOut

class WorkflowTemplateBase(BaseModel):
    code: str = Field(..., max_length=50, description="Mã quy trình (VD: QT_QTDT_01)")
    name: str = Field(..., max_length=255, description="Tên quy trình")
    department_id: Optional[int] = Field(None, description="ID đơn vị áp dụng (None = Toàn trường)")
    description: Optional[str] = None
    steps: List[Dict[str, Any]] = Field(default_factory=list, description="Danh sách các bước [{id, title, description}]")
    is_active: bool = True

class WorkflowTemplateCreate(WorkflowTemplateBase):
    pass

class WorkflowTemplateUpdate(BaseModel):
    code: Optional[str] = None
    name: Optional[str] = None
    department_id: Optional[int] = None
    description: Optional[str] = None
    steps: Optional[List[Dict[str, Any]]] = None
    is_active: Optional[bool] = None

class WorkflowTemplateOut(WorkflowTemplateBase):
    id: int
    created_at: datetime
    updated_at: datetime
    department: Optional[DepartmentOut] = None

    class Config:
        from_attributes = True
