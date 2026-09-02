from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import text
import math

from app.models.task import Task, TaskStatus, TaskType
from app.models.user import User, UserRole
from app.models.kpi import KpiFormulaVersion, WorkloadSnapshot
from app.kpi_engine.base_scorer import BaseScorer

class GovernanceEngine:
    """
    Engine đo lường Năng Lực Điều Phối & Quản Trị Trách Nhiệm (30% KPI Trưởng Đơn Vị).
    Công thức: Điểm Điều Phối = 100% - Điểm phạt hành vi + Thưởng phân công cân bằng.
    """

    @classmethod
    def calculate_governance_score(cls, head_id: int, dept_id: int, start_date: Optional[datetime], end_date: Optional[datetime], db: Session) -> Dict[str, Any]:
        version = BaseScorer.get_active_formula_version(db)
        base_governance = 100.0
        penalties = 0.0
        bonuses = 0.0
        penalty_details = []

        # 1. Kiểm tra các Task bị ngâm không phân công (>24h, >48h, >72h / Escalated)
        query_tasks = db.query(Task).filter(
            Task.leading_dept_id == dept_id,
            Task.parent_id.is_(None) # Chỉ xét task cha cấp phòng/trường giao về
        )
        if start_date:
            query_tasks = query_tasks.filter(Task.created_at >= start_date)
        if end_date:
            query_tasks = query_tasks.filter(Task.created_at <= end_date)

        dept_tasks = query_tasks.all()

        p_24h = float(version.escalation_penalty_24h or 0.05) * 100
        p_48h = float(version.escalation_penalty_48h or 0.10) * 100
        p_72h = float(version.escalation_penalty_72h or 0.15) * 100

        for t in dept_tasks:
            # Nếu nhiệm vụ bị leo thang
            if t.escalation_level == 1:
                penalties += p_24h
                penalty_details.append(f"Task #{t.id} ngâm quá 24h (-{p_24h:.0f}%)")
            elif t.escalation_level == 2:
                penalties += p_48h
                penalty_details.append(f"Task #{t.id} ngâm quá 48h (-{p_48h:.0f}%)")
            elif t.escalation_level >= 3 or t.is_escalated:
                penalties += p_72h
                penalty_details.append(f"Task #{t.id} ngâm quá 72h / BGH chỉ đạo (-{p_72h:.0f}%)")

        # 2. Phạt do kích hoạt Khiên Quá Tải cho nhân viên (Giao quá tải làm trễ hạn)
        overload_snapshots = db.query(WorkloadSnapshot).join(Task, WorkloadSnapshot.task_id == Task.id).filter(
            Task.leading_dept_id == dept_id,
            WorkloadSnapshot.overload_status == "OVERLOAD",
            Task.status == TaskStatus.HOAN_THANH
        )
        if start_date:
            overload_snapshots = overload_snapshots.filter(Task.created_at >= start_date)
        if end_date:
            overload_snapshots = overload_snapshots.filter(Task.created_at <= end_date)

        for snap in overload_snapshots.all():
            task = snap.task
            deadline = task.effective_deadline or task.due_date
            if task.completed_at and deadline:
                days_late = (task.completed_at.date() - deadline.date()).days
                if days_late > 0:
                    # Trưởng phòng gánh điểm phạt trễ hạn thay cho nhân viên
                    transferred_penalty = min(50.0, float(version.late_penalty_rate or 0.15) * days_late * 100)
                    penalties += transferred_penalty
                    penalty_details.append(f"Chuyển phạt từ Task #{task.id} (nhân viên quá tải bị trễ {days_late} ngày: -{transferred_penalty:.0f}%)")

        # Giới hạn trần phạt tối đa 30%
        penalties_capped = min(float(version.coordination_penalty_cap or 0.30) * 100, penalties)

        # 3. Thưởng Phân Công Hợp Lý (Tối đa +15%)
        # Lấy độ lệch chuẩn tải của nhân viên trong đơn vị
        staff_members = db.query(User).filter(User.department_id == dept_id, User.is_active == True).all()
        if len(staff_members) >= 2:
            loads = []
            for s in staff_members:
                # Đếm số task đang chạy
                cnt = db.query(Task).filter(
                    Task.assignee_id == s.id,
                    Task.status.in_([TaskStatus.CHUA_BAT_DAU, TaskStatus.DANG_THUC_HIEN])
                ).count()
                loads.append(cnt)
            
            # Tính độ lệch chuẩn
            mean_load = sum(loads) / len(loads)
            variance = sum((x - mean_load) ** 2 for x in loads) / len(loads)
            std_dev = math.sqrt(variance)

            # Độ lệch chuẩn <= 1.0 -> Thưởng tối đa 15%, giảm dần
            if std_dev <= 1.0:
                bonuses = 15.0
            elif std_dev <= 2.0:
                bonuses = 10.0
            elif std_dev <= 3.0:
                bonuses = 5.0
            else:
                bonuses = 0.0

        # Tổng hợp điểm điều phối
        governance_score = max(0.0, min(115.0, base_governance - penalties_capped + bonuses))

        return {
            "governance_score": round(governance_score, 2),
            "base_score": base_governance,
            "penalties_raw": penalties,
            "penalties_capped": penalties_capped,
            "bonuses": bonuses,
            "penalty_details": penalty_details
        }
