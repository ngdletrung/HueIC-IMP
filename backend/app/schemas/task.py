from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from app.models.task import TaskPriority, TaskStatus
from app.schemas.department import DepartmentOut
from app.schemas.user import UserOut

class WorkflowStepSchema(BaseModel):
    id: int
    title: str
    is_completed: bool = False
    completed_at: Optional[datetime] = None
    completed_by_name: Optional[str] = None
    note: Optional[str] = None

class TaskCommentBase(BaseModel):
    content: str

class TaskCommentCreate(TaskCommentBase):
    pass

class TaskCommentOut(TaskCommentBase):
    id: int
    task_id: int
    author_id: int
    author: Optional[UserOut] = None
    created_at: datetime

    class Config:
        from_attributes = True

class TaskBase(BaseModel):
    title: str
    description: Optional[str] = None
    leading_dept_id: Optional[int] = None
    assisting_dept_id: Optional[int] = None
    assignee_id: Optional[int] = None
    workflow_name: Optional[str] = None
    priority: TaskPriority = TaskPriority.TRUNG_BINH
    status: TaskStatus = TaskStatus.CHUA_BAT_DAU
    progress_percent: int = Field(default=0, ge=0, le=100)
    workflow_steps: Optional[List[Dict[str, Any]]] = []
    start_date: Optional[datetime] = None
    due_date: Optional[datetime] = None

class TaskCreate(TaskBase):
    pass

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    leading_dept_id: Optional[int] = None
    assisting_dept_id: Optional[int] = None
    assignee_id: Optional[int] = None
    workflow_name: Optional[str] = None
    priority: Optional[TaskPriority] = None
    status: Optional[TaskStatus] = None
    progress_percent: Optional[int] = Field(default=None, ge=0, le=100)
    workflow_steps: Optional[List[Dict[str, Any]]] = None
    start_date: Optional[datetime] = None
    due_date: Optional[datetime] = None
    completed_at: Optional[datetime] = None

class TaskOut(TaskBase):
    id: int
    created_by_id: Optional[int] = None
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    leading_department: Optional[DepartmentOut] = None
    assisting_department: Optional[DepartmentOut] = None
    assignee: Optional[UserOut] = None
    creator: Optional[UserOut] = None
    comments: List[TaskCommentOut] = []

    class Config:
        from_attributes = True
