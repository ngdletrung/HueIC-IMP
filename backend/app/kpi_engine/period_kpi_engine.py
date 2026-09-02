from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.models.task import Task, TaskStatus, TaskType, VisibilityScope
from app.models.user import User, UserRole
from app.models.department import Department
from app.models.kpi import KpiFormulaVersion, KpiLog
from app.kpi_engine.base_scorer import BaseScorer
from app.kpi_engine.governance_engine import GovernanceEngine

class PeriodKpiEngine:
    """
    Engine tổng hợp KPI Cá nhân, KPI Đơn vị (Trưởng phòng) và Chỉ số SPI Toàn trường (BGH).
    """

    @classmethod
    def calculate_individual_kpi(cls, user_id: int, start_date: Optional[datetime], end_date: Optional[datetime], db: Session) -> Dict[str, Any]:
        version = BaseScorer.get_active_formula_version(db)

        # Lấy tất cả task do user phụ trách chính
        query = db.query(Task).filter(Task.assignee_id == user_id)
        if start_date:
            query = query.filter(Task.created_at >= start_date)
        if end_date:
            query = query.filter(Task.created_at <= end_date)

        tasks = query.all()

        total_base = 0.0
        total_actual = 0.0
        completed_count = 0

        for t in tasks:
            if t.base_score is None:
                t.base_score = BaseScorer.calculate_base_score(t.priority, t.weight)
            
            total_base += float(t.base_score or 1.0)
            if t.status == TaskStatus.HOAN_THANH:
                completed_count += 1
                if t.actual_score is None:
                    BaseScorer.calculate_task_score(t, db)
                total_actual += float(t.actual_score or 0.0)

        # Tỷ lệ thực hiện công việc (%)
        if total_base > 0:
            execution_rate = (total_actual / total_base) * 100.0
        else:
            execution_rate = 100.0 if completed_count > 0 else 0.0

        # Thưởng Đề xuất / Sáng kiến (Proposal Bonus)
        proposal_query = db.query(Task).filter(
            Task.created_by_id == user_id,
            Task.type == TaskType.PROPOSAL,
            Task.status.in_([TaskStatus.DANG_THUC_HIEN, TaskStatus.HOAN_THANH])
        )
        if start_date:
            proposal_query = proposal_query.filter(Task.created_at >= start_date)
        if end_date:
            proposal_query = proposal_query.filter(Task.created_at <= end_date)

        approved_proposals_count = proposal_query.count()
        bonus_points_per_proposal = float(version.proposal_bonus_points or 15.0)
        bonus_cap = float(version.proposal_bonus_cap or 30.0)
        proposal_bonus = min(bonus_cap, approved_proposals_count * bonus_points_per_proposal)

        raw_kpi = execution_rate + proposal_bonus
        # Áp dụng trần & sàn
        final_kpi = max(float(version.kpi_floor or 0.0), min(float(version.kpi_ceiling or 1.20) * 100.0, raw_kpi))

        # Phân loại thi đua
        if final_kpi >= 110.0:
            rank = "A+ (Xuất sắc)"
            badge_color = "emerald"
        elif final_kpi >= 95.0:
            rank = "A (Tốt)"
            badge_color = "green"
        elif final_kpi >= 80.0:
            rank = "B (Hoàn thành)"
            badge_color = "blue"
        elif final_kpi >= 65.0:
            rank = "C (Cần cải thiện)"
            badge_color = "amber"
        else:
            rank = "D (Không đạt)"
            badge_color = "rose"

        return {
            "user_id": user_id,
            "kpi": round(final_kpi, 2),
            "execution_rate": round(execution_rate, 2),
            "proposal_bonus": round(proposal_bonus, 2),
            "approved_proposals_count": approved_proposals_count,
            "total_base_score": round(total_base, 2),
            "total_actual_score": round(total_actual, 2),
            "total_tasks": len(tasks),
            "completed_tasks": completed_count,
            "rank": rank,
            "badge_color": badge_color,
            "formula_version": version.version_name
        }

    @classmethod
    def calculate_department_kpi(cls, dept_id: int, start_date: Optional[datetime], end_date: Optional[datetime], db: Session) -> Dict[str, Any]:
        """
        KPI Trưởng Đơn Vị = 70% Thực thi (Weighted Parent) + 30% Điều phối (Governance).
        """
        version = BaseScorer.get_active_formula_version(db)
        dept = db.query(Department).filter(Department.id == dept_id).first()
        dept_name = dept.name if dept else f"Đơn vị #{dept_id}"

        # Lấy Trưởng phòng
        head = db.query(User).filter(User.department_id == dept_id, User.role == UserRole.DEPT_HEAD, User.is_active == True).first()
        head_id = head.id if head else 0

        # 1. Điểm Thực Thi (70%): Trung bình điểm của các Task Cấp Trường / Cấp Phòng do đơn vị chủ trì
        parent_tasks_query = db.query(Task).filter(
            Task.leading_dept_id == dept_id,
            Task.parent_id.is_(None)
        )
        if start_date:
            parent_tasks_query = parent_tasks_query.filter(Task.created_at >= start_date)
        if end_date:
            parent_tasks_query = parent_tasks_query.filter(Task.created_at <= end_date)

        parent_tasks = parent_tasks_query.all()
        total_p_base = 0.0
        total_p_actual = 0.0

        for pt in parent_tasks:
            if pt.base_score is None:
                pt.base_score = BaseScorer.calculate_base_score(pt.priority, pt.weight)
            total_p_base += float(pt.base_score or 1.0)
            total_p_actual += float(pt.actual_score or 0.0)

        if total_p_base > 0:
            execution_score = min(120.0, (total_p_actual / total_p_base) * 100.0)
        else:
            execution_score = 100.0

        # 2. Điểm Điều Phối (30%)
        gov_res = GovernanceEngine.calculate_governance_score(head_id, dept_id, start_date, end_date, db)
        governance_score = gov_res["governance_score"]

        # 3. Tổng hợp 70% / 30%
        final_dept_kpi = (execution_score * 0.70) + (governance_score * 0.30)
        final_dept_kpi = max(0.0, min(120.0, final_dept_kpi))

        return {
            "department_id": dept_id,
            "department_name": dept_name,
            "head_name": head.full_name if head else "Chưa bổ nhiệm",
            "kpi": round(final_dept_kpi, 2),
            "execution_score_70": round(execution_score, 2),
            "governance_score_30": round(governance_score, 2),
            "governance_details": gov_res,
            "total_parent_tasks": len(parent_tasks)
        }

    @classmethod
    def calculate_school_spi(cls, start_date: Optional[datetime], end_date: Optional[datetime], db: Session) -> Dict[str, Any]:
        """
        SPI Toàn Trường (BGH):
        40% Đúng hạn + 25% Hoàn thành + 20% Chất lượng + 15% Tốc độ phản hồi.
        """
        org_query = db.query(Task).filter(
            Task.visibility == VisibilityScope.ORGANIZATIONAL,
            Task.status != TaskStatus.HUY_BO
        )
        if start_date:
            org_query = org_query.filter(Task.created_at >= start_date)
        if end_date:
            org_query = org_query.filter(Task.created_at <= end_date)

        org_tasks = org_query.all()
        total_tasks = len(org_tasks)

        if total_tasks == 0:
            return {
                "spi": 100.0,
                "on_time_rate": 100.0,
                "completion_rate": 100.0,
                "quality_rate": 100.0,
                "responsiveness_rate": 100.0,
                "total_tasks": 0
            }

        # 1. On-time Rate (40%)
        completed_tasks = [t for t in org_tasks if t.status == TaskStatus.HOAN_THANH]
        on_time_count = 0
        for t in completed_tasks:
            deadline = t.effective_deadline or t.due_date
            if not deadline or (t.completed_at and t.completed_at.date() <= deadline.date()):
                on_time_count += 1
        
        on_time_rate = (on_time_count / len(completed_tasks) * 100.0) if completed_tasks else 100.0

        # 2. Completion Rate (25%)
        completion_rate = (len(completed_tasks) / total_tasks) * 100.0

        # 3. Quality Rate (20%): Nghiệm thu lần đầu không bị reject
        first_pass_count = sum(1 for t in completed_tasks if (t.quality_reject_count or 0) == 0)
        quality_rate = (first_pass_count / len(completed_tasks) * 100.0) if completed_tasks else 100.0

        # 4. Responsiveness Rate (15%): Tỷ lệ không bị ngâm/escalate
        escalated_count = sum(1 for t in org_tasks if (t.escalation_level or 0) >= 2 or t.is_escalated)
        responsiveness_rate = max(0.0, 100.0 - (escalated_count / total_tasks * 100.0))

        spi = (on_time_rate * 0.40) + (completion_rate * 0.25) + (quality_rate * 0.20) + (responsiveness_rate * 0.15)
        spi = round(max(0.0, min(120.0, spi)), 2)

        return {
            "spi": spi,
            "on_time_rate": round(on_time_rate, 2),
            "completion_rate": round(completion_rate, 2),
            "quality_rate": round(quality_rate, 2),
            "responsiveness_rate": round(responsiveness_rate, 2),
            "total_tasks": total_tasks,
            "completed_tasks": len(completed_tasks)
        }
