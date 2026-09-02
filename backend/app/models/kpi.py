from sqlalchemy import Column, Integer, String, Boolean, Numeric, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime, timezone

from app.db.session import Base

class KpiFormulaVersion(Base):
    __tablename__ = "kpi_formula_versions"

    id = Column(Integer, primary_key=True, index=True)
    version_name = Column(String(50), nullable=False, default="v1.0")
    version_number = Column(Integer, nullable=False, default=1)
    
    # Các tham số công thức
    late_penalty_rate = Column(Numeric(5, 2), default=0.15)        # 15% / ngày trễ
    early_bonus_rate = Column(Numeric(5, 2), default=0.10)         # 10% khi sớm >= 2 ngày
    early_bonus_cap = Column(Numeric(5, 2), default=0.15)          # Trần thưởng sớm 15%
    late_severe_floor = Column(Numeric(5, 2), default=0.50)        # Sàn khi trễ > 3 ngày (50%)
    reject_penalty_rate = Column(Numeric(5, 2), default=0.15)      # Phạt trả hồ sơ (nhân 0.85)
    assignment_reject_factor = Column(Numeric(5, 2), default=0.50) # Từ chối nhận việc (0.50)
    
    proposal_bonus_points = Column(Numeric(5, 2), default=15.0)    # Thưởng đề xuất (+15 điểm)
    proposal_bonus_cap = Column(Numeric(5, 2), default=30.0)       # Trần thưởng đề xuất (+30 điểm)
    
    # Tham số điều phối (Governance)
    escalation_penalty_24h = Column(Numeric(5, 2), default=0.05)   # Ngâm việc 24h (-5%)
    escalation_penalty_48h = Column(Numeric(5, 2), default=0.10)   # Ngâm việc 48h (-10%)
    escalation_penalty_72h = Column(Numeric(5, 2), default=0.15)   # Ngâm việc 72h / Escalate (-15%)
    coordination_penalty_cap = Column(Numeric(5, 2), default=0.30) # Trần trừ điều phối tối đa 30%
    
    # Ngưỡng tải công việc
    workload_overload_threshold = Column(Numeric(5, 2), default=1.20) # Ngưỡng quá tải bật khiên (>120%)
    workload_warning_threshold = Column(Numeric(5, 2), default=1.00)  # Ngưỡng cảnh báo tải (>100%)
    
    kpi_floor = Column(Numeric(5, 2), default=0.0)                 # Sàn KPI 0%
    kpi_ceiling = Column(Numeric(5, 2), default=1.20)              # Trần KPI 120%
    
    is_active = Column(Boolean, default=True)
    effective_date = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class WorkloadSnapshot(Base):
    __tablename__ = "workload_snapshots"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False, index=True)
    assignee_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    workload_index = Column(Numeric(5, 2), nullable=False, default=1.0) # VD: 1.25 = 125%
    overload_status = Column(String(20), nullable=False, default="NORMAL") # NORMAL / WARNING / OVERLOAD
    formula_version_id = Column(Integer, ForeignKey("kpi_formula_versions.id"), nullable=True)
    captured_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    task = relationship("Task", foreign_keys=[task_id])
    assignee = relationship("User", foreign_keys=[assignee_id])
    formula_version = relationship("KpiFormulaVersion", foreign_keys=[formula_version_id])


class RequestExtension(Base):
    __tablename__ = "request_extensions"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False, index=True)
    requested_by_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    original_deadline = Column(DateTime(timezone=True), nullable=True)
    requested_new_deadline = Column(DateTime(timezone=True), nullable=False)
    reason = Column(Text, nullable=False)
    approved_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    status = Column(String(20), default="PENDING") # PENDING / APPROVED / REJECTED
    note = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    resolved_at = Column(DateTime(timezone=True), nullable=True)

    task = relationship("Task", foreign_keys=[task_id])
    requested_by = relationship("User", foreign_keys=[requested_by_id])
    approved_by = relationship("User", foreign_keys=[approved_by_id])


class KpiLog(Base):
    __tablename__ = "kpi_logs"

    id = Column(Integer, primary_key=True, index=True)
    subject_type = Column(String(20), nullable=False) # INDIVIDUAL / UNIT / SCHOOL
    subject_id = Column(Integer, nullable=False, index=True)
    period = Column(String(20), nullable=False, index=True) # VD: '2026-09' hoặc '2026-Q3'
    kpi_value = Column(Numeric(6, 2), nullable=False)
    base_score_total = Column(Numeric(8, 2), default=0.0)
    actual_score_total = Column(Numeric(8, 2), default=0.0)
    is_final = Column(Boolean, default=False)
    formula_version_id = Column(Integer, ForeignKey("kpi_formula_versions.id"), nullable=True)
    evidence_task_id = Column(Integer, ForeignKey("tasks.id", ondelete="SET NULL"), nullable=True)
    details = Column(Text, nullable=True) # JSON chi tiết
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    formula_version = relationship("KpiFormulaVersion", foreign_keys=[formula_version_id])
    evidence_task = relationship("Task", foreign_keys=[evidence_task_id])
