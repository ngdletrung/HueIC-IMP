from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.models.task import Task, TaskStatus, TaskPriority
from app.models.kpi import KpiFormulaVersion, WorkloadSnapshot

class BaseScorer:
    """
    Engine chấm điểm chi tiết cho 1 Task độc lập (Task Score).
    Công thức: Actual Score = Base Score × Completion Factor × Time Factor × Quality Factor
    """

    @staticmethod
    def get_active_formula_version(db: Session) -> KpiFormulaVersion:
        version = db.query(KpiFormulaVersion).filter(KpiFormulaVersion.is_active == True).order_by(KpiFormulaVersion.version_number.desc()).first()
        if not version:
            # Fallback v1.0 default
            version = KpiFormulaVersion(
                version_name="v1.0 (Fallback Default)",
                version_number=1,
                late_penalty_rate=0.15,
                early_bonus_rate=0.10,
                early_bonus_cap=0.15,
                late_severe_floor=0.50,
                reject_penalty_rate=0.15,
                assignment_reject_factor=0.50,
                workload_overload_threshold=1.20
            )
        return version

    @staticmethod
    def calculate_base_score(priority: TaskPriority, weight: float = 1.0) -> float:
        """
        Base Score = Priority Factor × Weight
        Priority Factor: THAP=1, TRUNG_BINH=2, CAO=3, KHAN_CAP=5
        """
        priority_map = {
            TaskPriority.THAP: 1.0,
            TaskPriority.TRUNG_BINH: 2.0,
            TaskPriority.CAO: 3.0,
            TaskPriority.KHAN_CAP: 5.0
        }
        factor = priority_map.get(priority, 2.0)
        w = max(0.1, float(weight or 1.0))
        return round(factor * w, 2)

    @classmethod
    def calculate_time_factor(cls, task: Task, snapshot: Optional[WorkloadSnapshot], version: KpiFormulaVersion) -> float:
        """
        Tính Hệ số Thời Gian:
        - Đúng hạn hoặc sớm 1 ngày: 1.0
        - Sớm >= 2 ngày: 1.10 (Trần 1.15)
        - Khiên Quá Tải (Overload Shield): Nếu Workload > 120% tại thời điểm giao -> Giữ nguyên 1.0 (Miễn phạt)
        - Trễ 1-3 ngày: 1.0 - (0.15 × số ngày trễ)
        - Trễ > 3 ngày: Sàn 0.50
        """
        if task.status != TaskStatus.HOAN_THANH or not task.completed_at:
            return 0.0

        deadline = task.effective_deadline or task.due_date
        if not deadline:
            return 1.0 # Không đặt hạn -> Tính đúng hạn

        # Tính chênh lệch ngày (completed_at - deadline)
        comp_date = task.completed_at.date()
        due_date = deadline.date()
        days_diff = (comp_date - due_date).days

        # Sớm >= 2 ngày
        if days_diff <= -2:
            bonus = float(version.early_bonus_rate or 0.10)
            cap = float(version.early_bonus_cap or 0.15)
            return round(min(1.0 + cap, 1.0 + bonus), 2)

        # Đúng hạn (hoặc sớm 1 ngày)
        if days_diff <= 0:
            return 1.0

        # TRƯỜNG HỢP TRỄ HẠN (days_diff > 0):
        # Kiểm tra Khiên Quá Tải (Overload Shield)
        overload_threshold = float(version.workload_overload_threshold or 1.20)
        if snapshot and float(snapshot.workload_index or 1.0) >= overload_threshold:
            # Được kích hoạt khiên quá tải -> Miễn phạt cho nhân viên!
            return 1.0

        # Phạt trễ hạn thông thường
        penalty_rate = float(version.late_penalty_rate or 0.15)
        if 1 <= days_diff <= 3:
            factor = 1.0 - (penalty_rate * days_diff)
            floor = float(version.late_severe_floor or 0.50)
            return round(max(floor, factor), 2)

        # Trễ > 3 ngày: Chặn sàn 0.50
        return float(version.late_severe_floor or 0.50)

    @classmethod
    def calculate_quality_factor(cls, task: Task, version: KpiFormulaVersion) -> float:
        """
        Tính Hệ số Chất Lượng:
        - Nghiệm thu đạt lần đầu: 1.0
        - Bị trả về (Quality Reject): Multiplicative 0.85^n
        - Từ chối nhận việc (Assignment Reject): 0.50
        """
        if task.assignment_reject_count > 0:
            return float(version.assignment_reject_factor or 0.50)

        reject_count = task.quality_reject_count or 0
        if reject_count <= 0:
            return 1.0

        penalty_rate = float(version.reject_penalty_rate or 0.15)
        mult = max(0.0, 1.0 - penalty_rate)
        factor = mult ** reject_count
        return round(max(0.0, factor), 4)

    @classmethod
    def calculate_task_score(cls, task: Task, db: Session) -> float:
        """
        Hàm chính tính điểm thực nhận cho 1 task đã nghiệm thu.
        """
        version = cls.get_active_formula_version(db)

        # 1. Base Score
        if not task.base_score:
            task.base_score = cls.calculate_base_score(task.priority, task.weight)

        # 2. Completion Factor
        if task.status == TaskStatus.HOAN_THANH:
            completion_factor = 1.0
        else:
            completion_factor = 0.0

        if completion_factor == 0.0:
            task.actual_score = 0.0
            task.last_calculated_at = datetime.now(timezone.utc)
            return 0.0

        # 3. Lấy Snapshot Workload tại thời điểm giao việc
        snapshot = db.query(WorkloadSnapshot).filter(
            WorkloadSnapshot.task_id == task.id,
            WorkloadSnapshot.assignee_id == task.assignee_id
        ).order_by(WorkloadSnapshot.captured_at.desc()).first()

        # 4. Time Factor & Quality Factor
        time_factor = cls.calculate_time_factor(task, snapshot, version)
        quality_factor = cls.calculate_quality_factor(task, version)

        # 5. Actual Score
        actual = float(task.base_score) * completion_factor * time_factor * quality_factor
        task.actual_score = round(actual, 2)
        task.formula_version_id = version.id
        task.last_calculated_at = datetime.now(timezone.utc)

        return task.actual_score
