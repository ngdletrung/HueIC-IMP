from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Enum as SQLEnum, JSON
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import enum
from app.db.session import Base

class UserRole(str, enum.Enum):
    SUPERADMIN = "SUPERADMIN"       # Ban Giám hiệu / Quản trị viên cấp cao
    DEPT_HEAD = "DEPT_HEAD"         # Trưởng đơn vị / Trưởng Khoa / Trưởng Phòng
    STAFF = "STAFF"                 # Chuyên viên / Giảng viên / Cán bộ

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=False)
    full_name = Column(String(150), nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(SQLEnum(UserRole), default=UserRole.STAFF, nullable=False)
    position = Column(String(100), nullable=True) # Ví dụ: Trưởng phòng, Phó phòng, Chuyên viên
    phone = Column(String(20), nullable=True)
    is_active = Column(Boolean, default=True)
    department_id = Column(Integer, ForeignKey("departments.id", ondelete="SET NULL"), nullable=True)
    permissions = Column(JSON, default=list, nullable=False) # Danh sách mã quyền chi tiết
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Quan hệ
    department = relationship("Department", back_populates="users")
    assigned_tasks = relationship("Task", foreign_keys="Task.assignee_id", back_populates="assignee")
    created_tasks = relationship("Task", foreign_keys="Task.created_by_id", back_populates="creator")
    comments = relationship("TaskComment", back_populates="author", cascade="all, delete-orphan")
