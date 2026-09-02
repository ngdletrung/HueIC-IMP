from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from app.models.task import (
    TaskPriority, TaskStatus, TaskType, VisibilityScope, ProgressRule,
    TaskAssignmentRole, TaskAssignmentStatus, CollaborationStatus
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
    author_id: Optional[int] = None
    author: Optional[UserOut] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

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
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class TaskBase(BaseModel):
    title: str
    description: Optional[str] = None
    type: TaskType = TaskType.ROUTINE
    visibility: VisibilityScope = VisibilityScope.DEPARTMENT
    priority: TaskPriority = TaskPriority.TRUNG_BINH
    status: TaskStatus = TaskStatus.CHUA_BAT_DAU
    collaboration_status: CollaborationStatus = CollaborationStatus.NONE
    collaboration_reject_reason: Optional[str] = None
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
    assisting_assignee_id: Optional[int] = None
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
    assisting_assignee_id: Optional[int] = None
    collaboration_status: Optional[CollaborationStatus] = None
    collaboration_reject_reason: Optional[str] = None
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

class CollaborationAcceptRequest(BaseModel):
    assisting_assignee_id: Optional[int] = None
    note: Optional[str] = None

class CollaborationRejectRequest(BaseModel):
    reason: str

class CollaborationEscalateRequest(BaseModel):
    note: Optional[str] = None

class AssignmentAcceptRequest(BaseModel):
    note: Optional[str] = None

class AssignmentRejectRequest(BaseModel):
    reason: str

class ProposalApproveRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[TaskPriority] = None
    target_type: TaskType = TaskType.ROUTINE
    assignee_id: Optional[int] = None
    assisting_dept_id: Optional[int] = None
    due_date: Optional[datetime] = None
    note: Optional[str] = None

class ProposalRejectRequest(BaseModel):
    reason: str

class ProposalRequestChangesRequest(BaseModel):
    feedback: str

class ProposalResubmitRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[TaskPriority] = None
    due_date: Optional[datetime] = None
    resubmit_note: Optional[str] = None

class TaskNotificationOut(BaseModel):
    id: int
    task_id: Optional[int] = None
    user_id: int
    type: str
    title: str
    message: str
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True

class TaskNotificationListOut(BaseModel):
    total: int
    unread_count: int
    items: List[TaskNotificationOut]

class TaskAssignmentCreate(BaseModel):
    assigned_to_id: int
    role: TaskAssignmentRole = TaskAssignmentRole.RESPONSIBLE
    department_id: Optional[int] = None
    assigned_deadline: Optional[datetime] = None
    note: Optional[str] = None

class TaskAssignmentUpdate(BaseModel):
    role: Optional[TaskAssignmentRole] = None
    status: Optional[TaskAssignmentStatus] = None
    assigned_deadline: Optional[datetime] = None
    note: Optional[str] = None

class TaskEscalateRequest(BaseModel):
    reason: str
    target_level: Optional[int] = 1
    note: Optional[str] = None

class TaskRecurringRuleBase(BaseModel):
    cron_expression: Optional[str] = None
    frequency: str = "WEEKLY" # DAILY, WEEKLY, MONTHLY, QUARTERLY, YEARLY
    start_date: datetime
    end_date: Optional[datetime] = None
    is_active: bool = True

class TaskRecurringRuleCreate(TaskRecurringRuleBase):
    pass

class TaskRecurringRuleUpdate(BaseModel):
    cron_expression: Optional[str] = None
    frequency: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    is_active: Optional[bool] = None

class TaskRecurringRuleOut(TaskRecurringRuleBase):
    id: int
    next_run_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True

class TaskActionLogOut(BaseModel):
    id: int
    task_id: Optional[int] = None
    actor_id: Optional[int] = None
    action: str
    details: Optional[Dict[str, Any]] = None
    created_at: datetime
    actor: Optional[UserOut] = None

    class Config:
        from_attributes = True

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
    approved_by_id: Optional[int] = None
    approved_at: Optional[datetime] = None
    assigned_by_id: Optional[int] = None
    assigned_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    collaboration_accepted_at: Optional[datetime] = None
    collaboration_rejected_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    leading_department: Optional[DepartmentOut] = None
    assisting_department: Optional[DepartmentOut] = None
    assignee: Optional[UserOut] = None
    assisting_assignee: Optional[UserOut] = None
    creator: Optional[UserOut] = None
    approver: Optional[UserOut] = None
    assigned_by: Optional[UserOut] = None
    comments: List[TaskCommentOut] = []
    assignments: List[TaskAssignmentOut] = []
    action_logs: List[TaskActionLogOut] = []
    children: List[SubTaskSummaryOut] = []

    class Config:
        from_attributes = True

