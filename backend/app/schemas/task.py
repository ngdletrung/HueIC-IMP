from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from app.models.task import (
    TaskPriority, TaskStatus, TaskType, VisibilityScope, ProgressRule,
    TaskAssignmentRole, TaskAssignmentStatus
)
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

class TaskAssignmentOut(BaseModel):
    id: int
    task_id: int
    role: TaskAssignmentRole
    assigned_by_id: Optional[int] = None
    assigned_to_id: Optional[int] = None
    department_id: Optional[int] = None
    status: TaskAssignmentStatus
    assigned_deadline: Optional[datetime] = None
    note: Optional[str] = None
    assigned_by: Optional[UserOut] = None
    assigned_to: Optional[UserOut] = None
    department: Optional[DepartmentOut] = None
    created_at: datetime

    class Config:
        from_attributes = True

class TaskBase(BaseModel):
    title: str
    description: Optional[str] = None
    type: TaskType = TaskType.ROUTINE
    visibility: VisibilityScope = VisibilityScope.DEPARTMENT
    priority: TaskPriority = TaskPriority.TRUNG_BINH
    status: TaskStatus = TaskStatus.CHUA_BAT_DAU
    progress_percent: float = Field(default=0.0, ge=0.0, le=100.0)
    weight: float = 1.0
    progress_rule: ProgressRule = ProgressRule.AVERAGE
    parent_id: Optional[int] = None
    workflow_template_id: Optional[int] = None
    workflow_name: Optional[str] = None
    workflow_steps: Optional[List[Dict[str, Any]]] = []
    series_id: Optional[int] = None
    escalation_level: int = 0
    leading_dept_id: Optional[int] = None
    assisting_dept_id: Optional[int] = None
    assignee_id: Optional[int] = None
    start_date: Optional[datetime] = None
    due_date: Optional[datetime] = None
    received_at: Optional[datetime] = None

class TaskCreate(TaskBase):
    steps: Optional[List[Dict[str, Any]]] = None # Cho phép gửi danh sách bước để tự sinh task con
    collaborator_ids: Optional[List[int]] = None # Danh sách ID cán bộ phối hợp cùng thực hiện

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    type: Optional[TaskType] = None
    visibility: Optional[VisibilityScope] = None
    leading_dept_id: Optional[int] = None
    assisting_dept_id: Optional[int] = None
    assignee_id: Optional[int] = None
    workflow_template_id: Optional[int] = None
    workflow_name: Optional[str] = None
    priority: Optional[TaskPriority] = None
    status: Optional[TaskStatus] = None
    progress_percent: Optional[float] = Field(default=None, ge=0.0, le=100.0)
    weight: Optional[float] = None
    progress_rule: Optional[ProgressRule] = None
    workflow_steps: Optional[List[Dict[str, Any]]] = None
    start_date: Optional[datetime] = None
    due_date: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    escalation_level: Optional[int] = None

class SubTaskSummaryOut(BaseModel):
    id: int
    title: str
    status: TaskStatus
    progress_percent: float
    weight: float
    due_date: Optional[datetime] = None
    assignee_id: Optional[int] = None

    class Config:
        from_attributes = True

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
    assignments: List[TaskAssignmentOut] = []
    children: List[SubTaskSummaryOut] = []

    class Config:
        from_attributes = True

