from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.models.task import Task, TaskStatus, TaskPriority
from app.models.kpi import WorkloadSnapshot, KpiFormulaVersion
from app.kpi_engine.base_scorer import BaseScorer

class WorkloadEngine:
    """
    Engine đo lường và chụp ảnh tải công việc (Point-in-time Workload Snapshot).
    Nguyên tắc Invariant I-04: Workload phải được chốt tại thời điểm giao việc.
    """

    DEFAULT_CAPACITY = 10.0 # Tải trọng chuẩn 10.0 Base Score

    @classmethod
    def calculate_current_workload_index(cls, user_id: int, db: Session) -> float:
        """
        Tính chỉ số tải hiện tại của user dựa trên tổng Base Score của các task đang chạy.
        """
        if not user_id:
            return 1.0

        # Lấy các task đang hoạt động (CHUA_BAT_DAU, DANG_THUC_HIEN, CHO_DUYET)
        active_tasks = db.query(Task).filter(
            Task.assignee_id == user_id,
            Task.status.in_([TaskStatus.CHUA_BAT_DAU, TaskStatus.DANG_THUC_HIEN, TaskStatus.CHO_DUYET])
        ).all()

        current_load = 0.0
        for t in active_tasks:
            if t.base_score is None:
                t.base_score = BaseScorer.calculate_base_score(t.priority, t.weight)
            # Tải trọng giảm dần theo % tiến độ còn lại
            remaining_ratio = max(0.1, 1.0 - (float(t.progress_percent or 0.0) / 100.0))
            current_load += float(t.base_score or 1.0) * remaining_ratio

        # Chỉ số tải: (Tổng tải / Tải chuẩn)
        workload_index = round(current_load / cls.DEFAULT_CAPACITY, 2)
        # Giới hạn tối thiểu 0.5 (50%), tối đa 3.0 (300%)
        return max(0.5, workload_index)

    @classmethod
    def capture_snapshot(cls, task_id: int, assignee_id: int, db: Session) -> WorkloadSnapshot:
        """
        Chụp ảnh snapshot và lưu vào DB.
        """
        version = BaseScorer.get_active_formula_version(db)
        workload_index = cls.calculate_current_workload_index(assignee_id, db)

        threshold_overload = float(version.workload_overload_threshold or 1.20)
        threshold_warning = float(version.workload_warning_threshold or 1.00)

        if workload_index >= threshold_overload:
            status = "OVERLOAD"
        elif workload_index >= threshold_warning:
            status = "WARNING"
        else:
            status = "NORMAL"

        snapshot = WorkloadSnapshot(
            task_id=task_id,
            assignee_id=assignee_id,
            workload_index=workload_index,
            overload_status=status,
            formula_version_id=version.id,
            captured_at=datetime.now(timezone.utc)
        )
        db.add(snapshot)
        db.flush()
        return snapshot
