from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, Enum as SQLEnum, Float, JSON
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import enum
from app.db.session import Base

class TaskPriority(str, enum.Enum):
    THAP = "THAP"                   # Thấp (LOW)
    TRUNG_BINH = "TRUNG_BINH"       # Trung bình (MEDIUM)
    CAO = "CAO"                     # Cao (HIGH)
    KHAN_CAP = "KHAN_CAP"           # Khẩn cấp / Hỏa tốc (URGENT)

class TaskStatus(str, enum.Enum):
    CHUA_BAT_DAU = "CHUA_BAT_DAU"   # Chưa bắt đầu (PENDING)
    DANG_THUC_HIEN = "DANG_THUC_HIEN" # Đang thực hiện (IN_PROGRESS)
    CHO_DUYET = "CHO_DUYET"         # Chờ nghiệm thu / duyệt (UNDER_REVIEW)
    HOAN_THANH = "HOAN_THANH"       # Đã hoàn thành (COMPLETED)
    TU_CHOI = "TU_CHOI"             # Từ chối / Trả lại (REJECTED)
    TRE_HAN = "TRE_HAN"             # [DEPRECATED] Trễ hạn
    TAM_DUNG = "TAM_DUNG"           # Tạm dừng (ON_HOLD)
    HUY_BO = "HUY_BO"               # Hủy bỏ (CANCELLED)

class TaskType(str, enum.Enum):
    STRATEGIC = "STRATEGIC"         # Nhiệm vụ chiến lược cấp trường
    ROUTINE = "ROUTINE"             # Nhiệm vụ chuyên môn thường xuyên
    SELF = "SELF"                   # Việc cá nhân (To-Do)
    PROPOSAL = "PROPOSAL"           # Đề xuất từ cấp dưới
    ESCALATION = "ESCALATION"       # Nhiệm vụ cảnh báo / leo thang

class VisibilityScope(str, enum.Enum):
    PRIVATE = "PRIVATE"             # Việc cá nhân (ẩn khỏi dashboard chung)
    DEPARTMENT = "DEPARTMENT"       # Nội bộ đơn vị (tính KPI phòng, ẩn khỏi BGH)
    ORGANIZATIONAL = "ORGANIZATIONAL" # Toàn trường (hiển thị trên Dashboard BGH)

class ProgressRule(str, enum.Enum):
    AVERAGE = "AVERAGE"             # Trung bình cộng tiến độ các task con
    WEIGHTED = "WEIGHTED"           # Tính theo trọng số (weight)
    ALL = "ALL"                     # Chỉ 100% khi tất cả task con 100%

class TaskAssignmentRole(str, enum.Enum):
    RESPONSIBLE = "RESPONSIBLE"     # Người thực hiện chính (R)
    ACCOUNTABLE = "ACCOUNTABLE"     # Người chịu trách nhiệm phê duyệt (A)
    CONSULTED = "CONSULTED"         # Người được tham vấn / phối hợp (C)
    INFORMED = "INFORMED"           # Người nhận thông tin theo dõi (I)

class TaskAssignmentStatus(str, enum.Enum):
    TRANSFERRING = "TRANSFERRING"   # Đang chờ tiếp nhận / phân bổ
    ACCEPTED = "ACCEPTED"           # Đã chấp nhận thực hiện
    REJECTED = "REJECTED"           # Từ chối tiếp nhận (kèm lý do)
    WAITING_APPROVAL = "WAITING_APPROVAL" # Đang trình duyệt
    COMPLETED = "COMPLETED"         # Đã hoàn thành

class TaskRecurringRule(Base):
    __tablename__ = "task_recurring_rules"

    id = Column(Integer, primary_key=True, index=True)
    cron_expression = Column(String(100), nullable=True)
    frequency = Column(String(50), default="WEEKLY", nullable=False) # DAILY, WEEKLY, MONTHLY, QUARTERLY, YEARLY
    start_date = Column(DateTime(timezone=True), nullable=False)
    end_date = Column(DateTime(timezone=True), nullable=True)
    next_run_at = Column(DateTime(timezone=True), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)

    # Phân loại hình thái & Phạm vi hiển thị
    type = Column(SQLEnum(TaskType), default=TaskType.ROUTINE, nullable=False, index=True)
    visibility = Column(SQLEnum(VisibilityScope), default=VisibilityScope.DEPARTMENT, nullable=False, index=True)
    priority = Column(SQLEnum(TaskPriority), default=TaskPriority.TRUNG_BINH, nullable=False)
    status = Column(SQLEnum(TaskStatus), default=TaskStatus.CHUA_BAT_DAU, nullable=False, index=True)

    # Phân rã mốc & Single Source of Truth (parent_id)
    parent_id = Column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=True, index=True)
    workflow_template_id = Column(Integer, nullable=True)
    workflow_name = Column(String(255), nullable=True)
    workflow_steps = Column(JSON, default=list, nullable=True)

    # Thuộc tính đo lường & Lũy kế tiến độ
    progress_percent = Column(Float, default=0.0, nullable=False) # 0 -> 100%
    weight = Column(Float, default=1.0, nullable=False)
    progress_rule = Column(SQLEnum(ProgressRule), default=ProgressRule.AVERAGE, nullable=False)

    # Định kỳ & Escalation
    series_id = Column(Integer, ForeignKey("task_recurring_rules.id", ondelete="SET NULL"), nullable=True, index=True)
    escalation_level = Column(Integer, default=0, nullable=False) # 0: None, 1: 24h, 2: 48h, 3: 72h
    received_at = Column(DateTime(timezone=True), nullable=True)

    # Đơn vị và Nhân sự thực hiện
    leading_dept_id = Column(Integer, ForeignKey("departments.id", ondelete="SET NULL"), nullable=True)
    assisting_dept_id = Column(Integer, ForeignKey("departments.id", ondelete="SET NULL"), nullable=True)
    assignee_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    # Thời hạn
    start_date = Column(DateTime(timezone=True), nullable=True)
    due_date = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Quan hệ
    parent = relationship("Task", remote_side=[id], back_populates="children")
    children = relationship("Task", back_populates="parent", cascade="all, delete-orphan")
    leading_department = relationship("Department", foreign_keys=[leading_dept_id], back_populates="leading_tasks")
    assisting_department = relationship("Department", foreign_keys=[assisting_dept_id], back_populates="assisting_tasks")
    assignee = relationship("User", foreign_keys=[assignee_id], back_populates="assigned_tasks")
    creator = relationship("User", foreign_keys=[created_by_id], back_populates="created_tasks")
    comments = relationship("TaskComment", back_populates="task", cascade="all, delete-orphan")
    assignments = relationship("TaskAssignment", back_populates="task", cascade="all, delete-orphan")
    recurring_rule = relationship("TaskRecurringRule", foreign_keys=[series_id])

class TaskAssignment(Base):
    __tablename__ = "task_assignments"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(SQLEnum(TaskAssignmentRole), default=TaskAssignmentRole.RESPONSIBLE, nullable=False)
    assigned_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    assigned_to_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    department_id = Column(Integer, ForeignKey("departments.id", ondelete="SET NULL"), nullable=True)
    status = Column(SQLEnum(TaskAssignmentStatus), default=TaskAssignmentStatus.TRANSFERRING, nullable=False)
    assigned_deadline = Column(DateTime(timezone=True), nullable=True)
    note = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # Quan hệ
    task = relationship("Task", back_populates="assignments")
    assigned_by = relationship("User", foreign_keys=[assigned_by_id])
    assigned_to = relationship("User", foreign_keys=[assigned_to_id])
    department = relationship("Department", foreign_keys=[department_id])

class TaskComment(Base):
    __tablename__ = "task_comments"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False)
    author_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # Quan hệ
    task = relationship("Task", back_populates="comments")
    author = relationship("User", back_populates="comments")

