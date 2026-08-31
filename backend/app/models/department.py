from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.db.session import Base

class Department(Base):
    __tablename__ = "departments"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, index=True, nullable=False) # VD: BGH, P_DAO_TAO, K_CNTT
    name = Column(String(255), nullable=False)                         # Tên phòng ban / đơn vị
    description = Column(Text, nullable=True)
    phone = Column(String(50), nullable=True)
    email = Column(String(100), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Quan hệ
    users = relationship("User", back_populates="department", cascade="all, delete-orphan")
    leading_tasks = relationship("Task", foreign_keys="Task.leading_dept_id", back_populates="leading_department")
    assisting_tasks = relationship("Task", foreign_keys="Task.assisting_dept_id", back_populates="assisting_department")
