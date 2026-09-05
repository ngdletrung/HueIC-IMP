from sqlalchemy import Column, Integer, String, Boolean, Float, DateTime, ForeignKey, JSON, UniqueConstraint
from sqlalchemy.orm import relationship
from datetime import datetime, timezone

from app.db.session import Base

class KpiPeriodSnapshot(Base):
    __tablename__ = 'kpi_period_snapshots'

    id = Column(Integer, primary_key=True, index=True)
    period_type = Column(String(20), nullable=False, index=True) # MONTH, QUARTER, YEAR
    period_key = Column(String(50), nullable=False, index=True)  # e.g., '2026-09', '2026-Q3', '2025-2026'
    department_id = Column(Integer, ForeignKey('departments.id', ondelete='CASCADE'), nullable=True, index=True) # None = School-wide
    is_closed = Column(Boolean, default=False, index=True) # True = past closed period, False = active

    start_date = Column(DateTime(timezone=True), nullable=False)
    end_date = Column(DateTime(timezone=True), nullable=False)

    # Core Metric Scores
    spi_score = Column(Float, default=0.0)
    execution_score = Column(Float, default=0.0)
    governance_score = Column(Float, default=0.0)
    on_time_rate = Column(Float, default=100.0)
    completion_rate = Column(Float, default=0.0)
    quality_rate = Column(Float, default=100.0)
    responsiveness_rate = Column(Float, default=100.0)

    # 6 Lifecycle Counts
    total_tasks = Column(Integer, default=0)
    not_started_tasks = Column(Integer, default=0)
    in_progress_tasks = Column(Integer, default=0)
    review_tasks = Column(Integer, default=0)
    overdue_tasks = Column(Integer, default=0)
    completed_tasks = Column(Integer, default=0)
    paused_tasks = Column(Integer, default=0)

    # Full serialized JSON payload for zero-lag client delivery
    payload_data = Column(JSON, nullable=True)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    department = relationship('Department', foreign_keys=[department_id])

    __table_args__ = (
        UniqueConstraint('period_type', 'period_key', 'department_id', name='uq_period_snapshot_target'),
    )
