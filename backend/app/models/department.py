from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.db.session import Base

class Department(Base):
    __tablename__ = "departments"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(100), unique=True, index=True, nullable=False) # VD: BGH, HCTH, CNTT, BM_PM, TO_TB
    name = Column(String(255), nullable=False)                         # Tên phòng ban / đơn vị / bộ môn / tổ
    description = Column(Text, nullable=True)
    phone = Column(String(50), nullable=True)
    email = Column(String(100), nullable=True)
    is_active = Column(Boolean, default=True)
    
    # Cấu trúc Cây Cơ Cấu Đa Tầng (Hierarchy)
    parent_id = Column(Integer, ForeignKey("departments.id", ondelete="SET NULL"), nullable=True)
    path = Column(String(255), nullable=True, index=True) # Materialized Path: /BGH/CNTT/BM_PM
    type = Column(String(50), default="DEPARTMENT", nullable=False) # 'DEPARTMENT', 'FACULTY', 'CENTER', 'SECTION', 'WORKSHOP'
    order_index = Column(Integer, default=0, nullable=False)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Quan hệ Cây Đơn Vị Cha - Con
    parent = relationship("Department", remote_side=[id], backref="children")

    # Quan hệ nghiệp vụ
    users = relationship("User", back_populates="department", cascade="all, delete-orphan")
    leading_tasks = relationship("Task", foreign_keys="Task.leading_dept_id", back_populates="leading_department")
    assisting_tasks = relationship("Task", foreign_keys="Task.assisting_dept_id", back_populates="assisting_department")

