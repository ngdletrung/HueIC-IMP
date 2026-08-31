from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, Enum as SQLEnum, Float, JSON
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import enum
from app.db.session import Base

class TaskPriority(str, enum.Enum):
    THAP = "THAP"                   # Thấp
    TRUNG_BINH = "TRUNG_BINH"       # Trung bình
    CAO = "CAO"                     # Cao
    KHAN_CAP = "KHAN_CAP"           # Khẩn cấp / Hỏa tốc

class TaskStatus(str, enum.Enum):
    CHUA_BAT_DAU = "CHUA_BAT_DAU"   # Chưa bắt đầu
    DANG_THUC_HIEN = "DANG_THUC_HIEN" # Đang thực hiện
    CHO_DUYET = "CHO_DUYET"         # Chờ nghiệm thu / duyệt
    HOAN_THANH = "HOAN_THANH"       # Đã hoàn thành
    TRE_HAN = "TRE_HAN"             # [DEPRECATED] Trễ hạn - giữ để compat dữ liệu cũ; xác định qua due_date
    TAM_DUNG = "TAM_DUNG"           # Tạm dừng (chờ kinh phí/chỉ đạo)
    HUY_BO = "HUY_BO"               # Hủy bỏ (lưu vết, chỉ Admin/người giao)

class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)

    # Đơn vị và Nhân sự thực hiện
    leading_dept_id = Column(Integer, ForeignKey("departments.id", ondelete="SET NULL"), nullable=True)
    assisting_dept_id = Column(Integer, ForeignKey("departments.id", ondelete="SET NULL"), nullable=True)
    assignee_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    # Trạng thái, Tiến độ & Quy trình các bước mốc (Workflow Steps)
    workflow_name = Column(String(255), nullable=True) # Tên quy trình chuẩn (ví dụ: Quy trình Mua sắm QTĐT 8 bước)
    priority = Column(SQLEnum(TaskPriority), default=TaskPriority.TRUNG_BINH, nullable=False)
    status = Column(SQLEnum(TaskStatus), default=TaskStatus.CHUA_BAT_DAU, nullable=False)
    progress_percent = Column(Integer, default=0, nullable=False) # 0 -> 100%
    workflow_steps = Column(JSON, default=list, nullable=True) # Danh sách các bước mốc [ {id, title, is_completed, ...} ]

    # Thời hạn
    start_date = Column(DateTime(timezone=True), nullable=True)
    due_date = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Quan hệ
    leading_department = relationship("Department", foreign_keys=[leading_dept_id], back_populates="leading_tasks")
    assisting_department = relationship("Department", foreign_keys=[assisting_dept_id], back_populates="assisting_tasks")
    assignee = relationship("User", foreign_keys=[assignee_id], back_populates="assigned_tasks")
    creator = relationship("User", foreign_keys=[created_by_id], back_populates="created_tasks")
    comments = relationship("TaskComment", back_populates="task", cascade="all, delete-orphan")

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
