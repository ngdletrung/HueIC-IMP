from datetime import datetime, timezone
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.models.task import Task, TaskStatus
from app.kpi_engine.base_scorer import BaseScorer

class ParentScorer:
    """
    Engine tính điểm Weighted Parent Score cho Task Cha (Quy tắc Invariant I-01).
    Parent Score = [Σ(Child_Base_Score × Child_Completion_Rate)] / Σ(Child_Base_Score) × Parent_Base_Score
    """

    @classmethod
    def update_parent_score(cls, parent_id: int, db: Session) -> None:
        if not parent_id:
            return

        # 1. Row-level Lock trên Task Cha chống Race Condition
        parent = db.query(Task).filter(Task.id == parent_id).with_for_update().first()
        if not parent:
            return

        # 2. Lấy toàn bộ Task Con
        children = db.query(Task).filter(Task.parent_id == parent_id).all()
        if not children:
            return

        total_child_base = 0.0
        total_child_actual = 0.0
        all_children_finished = True

        for child in children:
            # Nếu con chưa có base_score thì tự tính
            if child.base_score is None:
                child.base_score = BaseScorer.calculate_base_score(child.priority, child.weight)
            
            c_base = float(child.base_score or 1.0)
            total_child_base += c_base

            if child.status in [TaskStatus.HOAN_THANH, TaskStatus.HUY_BO, TaskStatus.TU_CHOI]:
                # Đã kết thúc
                c_actual = float(child.actual_score or 0.0)
                total_child_actual += c_actual
            else:
                all_children_finished = False
                # Nếu đang chạy: Tạm tính theo % tiến độ (Projected)
                progress_rate = float(child.progress_percent or 0.0) / 100.0
                total_child_actual += (c_base * progress_rate)

        # 3. Tính Điểm Cha
        if parent.base_score is None:
            parent.base_score = BaseScorer.calculate_base_score(parent.priority, parent.weight)

        p_base = float(parent.base_score or 1.0)

        if total_child_base > 0:
            weighted_rate = total_child_actual / total_child_base
            parent.actual_score = round(weighted_rate * p_base, 2)
        else:
            parent.actual_score = 0.0

        parent.is_final = all_children_finished
        parent.last_calculated_at = datetime.now(timezone.utc)
        db.flush()

        # 4. Đệ quy lên Task Ông nội (nếu có)
        if parent.parent_id:
            cls.update_parent_score(parent.parent_id, db)
