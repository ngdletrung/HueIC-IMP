from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Any, Dict, Optional, List
from datetime import datetime, timezone

from app.db.session import get_db
from app.models.task import Task, TaskStatus, TaskPriority
from app.models.department import Department
from app.models.user import User
from app.api.deps import get_current_user

router = APIRouter()

@router.get("/summary", summary="Thống kê tổng quan tiến độ trường HueIC")
def get_dashboard_summary(
    dept_id: Optional[int] = Query(None, description="Lọc theo ID phòng ban/khoa"),
    user_id: Optional[int] = Query(None, description="Lọc theo ID cán bộ"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    query = db.query(Task)
    if dept_id:
        query = query.filter((Task.leading_dept_id == dept_id) | (Task.assisting_dept_id == dept_id))
    if user_id:
        query = query.filter((Task.assignee_id == user_id) | (Task.created_by_id == user_id))

    all_tasks = query.all()
    total_tasks = len(all_tasks)
    
    now = datetime.now(timezone.utc)

    def check_overdue(t: Task) -> bool:
        if t.status == TaskStatus.TRE_HAN:
            return True
        if not t.due_date or t.status == TaskStatus.HOAN_THANH:
            return False
        due = t.due_date
        if due.tzinfo is None:
            due = due.replace(tzinfo=timezone.utc)
        return due < now

    completed_tasks = sum(1 for t in all_tasks if t.status == TaskStatus.HOAN_THANH)
    in_progress_tasks = sum(1 for t in all_tasks if t.status == TaskStatus.DANG_THUC_HIEN)
    review_tasks = sum(1 for t in all_tasks if t.status == TaskStatus.CHO_DUYET)
    not_started_tasks = sum(1 for t in all_tasks if t.status == TaskStatus.CHUA_BAT_DAU)
    paused_tasks = sum(1 for t in all_tasks if t.status == TaskStatus.TAM_DUNG)
    overdue_tasks = sum(1 for t in all_tasks if check_overdue(t))

    total_departments = db.query(Department).count()
    total_users = db.query(User).count()

    # Thống kê chi tiết Action Queue (Việc cần xử lý ngay)
    action_queue = {
        "overdue": [],
        "due_soon": [],
        "review": []
    }

    # Tính toán danh sách việc quá hạn
    overdue_items = [t for t in all_tasks if check_overdue(t)]
    # Sắp xếp việc quá hạn lâu nhất lên đầu
    overdue_items.sort(key=lambda x: x.due_date if x.due_date else datetime.min.replace(tzinfo=timezone.utc))
    for t in overdue_items[:5]:
        days_od = 0
        if t.due_date:
            due = t.due_date.replace(tzinfo=timezone.utc) if t.due_date.tzinfo is None else t.due_date
            diff = (now - due).total_seconds()
            days_od = max(1, int(diff // 86400))
        action_queue["overdue"].append({
            "id": t.id,
            "title": t.title,
            "dept_code": t.leading_department.code if t.leading_department else "HueIC",
            "dept_name": t.leading_department.name if t.leading_department else "",
            "assignee_name": t.assignee.full_name if t.assignee else "Chưa phân công",
            "due_date": t.due_date.isoformat() if t.due_date else None,
            "days_overdue": days_od,
            "priority": t.priority.value if hasattr(t.priority, "value") else str(t.priority)
        })

    # Tính toán danh sách việc sắp đến hạn trong 3 ngày (72h)
    due_soon_items = []
    for t in all_tasks:
        if t.status in [TaskStatus.HOAN_THANH, TaskStatus.HUY_BO, TaskStatus.TAM_DUNG] or not t.due_date or check_overdue(t):
            continue
        due = t.due_date.replace(tzinfo=timezone.utc) if t.due_date.tzinfo is None else t.due_date
        diff_hours = (due - now).total_seconds() / 3600
        if 0 < diff_hours <= 72:
            due_soon_items.append((t, diff_hours))
    due_soon_items.sort(key=lambda x: x[1])
    for t, hours_left in due_soon_items[:5]:
        days_left = max(1, int(hours_left // 24)) if hours_left >= 24 else 0
        time_text = f"Còn {days_left} ngày" if days_left > 0 else f"Còn {int(hours_left)} giờ"
        action_queue["due_soon"].append({
            "id": t.id,
            "title": t.title,
            "dept_code": t.leading_department.code if t.leading_department else "HueIC",
            "dept_name": t.leading_department.name if t.leading_department else "",
            "assignee_name": t.assignee.full_name if t.assignee else "Chưa phân công",
            "due_date": t.due_date.isoformat() if t.due_date else None,
            "time_text": time_text,
            "priority": t.priority.value if hasattr(t.priority, "value") else str(t.priority)
        })

    # Tính toán danh sách việc chờ nghiệm thu
    review_items = [t for t in all_tasks if t.status == TaskStatus.CHO_DUYET]
    for t in review_items[:5]:
        action_queue["review"].append({
            "id": t.id,
            "title": t.title,
            "dept_code": t.leading_department.code if t.leading_department else "HueIC",
            "dept_name": t.leading_department.name if t.leading_department else "",
            "assignee_name": t.assignee.full_name if t.assignee else "Chưa phân công",
            "progress_percent": t.progress_percent,
            "priority": t.priority.value if hasattr(t.priority, "value") else str(t.priority)
        })

    # Thống kê mức độ ưu tiên kèm số việc quá hạn
    priority_stats = {
        "KHAN_CAP": sum(1 for t in all_tasks if t.priority == TaskPriority.KHAN_CAP),
        "KHAN_CAP_OVERDUE": sum(1 for t in all_tasks if t.priority == TaskPriority.KHAN_CAP and check_overdue(t)),
        "CAO": sum(1 for t in all_tasks if t.priority == TaskPriority.CAO),
        "CAO_OVERDUE": sum(1 for t in all_tasks if t.priority == TaskPriority.CAO and check_overdue(t)),
        "TRUNG_BINH": sum(1 for t in all_tasks if t.priority == TaskPriority.TRUNG_BINH),
        "TRUNG_BINH_OVERDUE": sum(1 for t in all_tasks if t.priority == TaskPriority.TRUNG_BINH and check_overdue(t)),
        "THAP": sum(1 for t in all_tasks if t.priority == TaskPriority.THAP),
        "THAP_OVERDUE": sum(1 for t in all_tasks if t.priority == TaskPriority.THAP and check_overdue(t)),
    }

    # Thống kê theo phòng ban kèm Trạng thái Vận hành (Operational Status)
    dept_stats = []
    departments = db.query(Department).all()
    for d in departments:
        d_tasks = [t for t in all_tasks if t.leading_dept_id == d.id]
        d_total = len(d_tasks)
        d_completed = sum(1 for t in d_tasks if t.status == TaskStatus.HOAN_THANH)
        d_in_progress = sum(1 for t in d_tasks if t.status == TaskStatus.DANG_THUC_HIEN)
        d_review = sum(1 for t in d_tasks if t.status == TaskStatus.CHO_DUYET)
        d_not_started = sum(1 for t in d_tasks if t.status == TaskStatus.CHUA_BAT_DAU)
        d_overdue = sum(1 for t in d_tasks if check_overdue(t))
        avg_progress = (sum(t.progress_percent for t in d_tasks) / d_total) if d_total > 0 else 0
        
        # Đánh giá trạng thái vận hành quản trị
        if d_total == 0:
            op_status = "CHUA_CO_VIEC"
            op_label = "Chưa có việc"
            op_badge = "bg-slate-100 text-slate-600 border-slate-200"
        elif d_overdue > 0:
            op_status = "TRE_HAN"
            op_label = f"🚨 Có {d_overdue} việc trễ hạn"
            op_badge = "bg-red-50 text-red-700 border-red-200"
        elif d_in_progress > 0 or d_review > 0:
            op_status = "DANG_TRIEN_KHAI"
            op_label = "⏳ Đang triển khai"
            op_badge = "bg-amber-50 text-amber-700 border-amber-200"
        else:
            op_status = "DUNG_TIEN_DO"
            op_label = "✅ Đúng tiến độ"
            op_badge = "bg-emerald-50 text-emerald-700 border-emerald-200"

        dept_stats.append({
            "dept_id": d.id,
            "dept_code": d.code,
            "dept_name": d.name,
            "total_tasks": d_total,
            "completed_tasks": d_completed,
            "in_progress_tasks": d_in_progress,
            "review_tasks": d_review,
            "not_started_tasks": d_not_started,
            "overdue_tasks": d_overdue,
            "avg_progress": round(avg_progress, 1),
            "operational_status": op_status,
            "status_label": op_label,
            "status_badge": op_badge
        })

    # Thống kê cán bộ trong phòng ban
    staff_stats = []
    if dept_id:
        dept_users = db.query(User).filter(User.department_id == dept_id).all()
        for u in dept_users:
            u_tasks = [t for t in all_tasks if t.assignee_id == u.id]
            u_total = len(u_tasks)
            u_completed = sum(1 for t in u_tasks if t.status == TaskStatus.HOAN_THANH)
            u_overdue = sum(1 for t in u_tasks if check_overdue(t))
            u_avg = (sum(t.progress_percent for t in u_tasks) / u_total) if u_total > 0 else 0
            
            if u_total == 0:
                u_op_label = "Chưa có việc"
                u_op_badge = "bg-slate-100 text-slate-600"
            elif u_overdue > 0:
                u_op_label = f"🚨 Trễ {u_overdue} việc"
                u_op_badge = "bg-red-50 text-red-700"
            else:
                u_op_label = "✅ Đúng tiến độ"
                u_op_badge = "bg-emerald-50 text-emerald-700"

            staff_stats.append({
                "user_id": u.id,
                "full_name": u.full_name,
                "position": u.position or "Cán bộ",
                "total_tasks": u_total,
                "completed_tasks": u_completed,
                "overdue_tasks": u_overdue,
                "avg_progress": round(u_avg, 1),
                "status_label": u_op_label,
                "status_badge": u_op_badge
            })

    # Nhiệm vụ cán bộ cụ thể
    user_tasks = []
    if user_id:
        for t in all_tasks:
            user_tasks.append({
                "id": t.id,
                "title": t.title,
                "status": t.status.value if hasattr(t.status, "value") else str(t.status),
                "priority": t.priority.value if hasattr(t.priority, "value") else str(t.priority),
                "progress_percent": t.progress_percent,
                "workflow_name": t.workflow_name,
                "workflow_steps": t.workflow_steps or [],
                "due_date": t.due_date.isoformat() if t.due_date else None,
                "leading_dept_code": t.leading_department.code if t.leading_department else ""
            })

    return {
        "overview": {
            "total_tasks": total_tasks,
            "completed_tasks": completed_tasks,
            "in_progress_tasks": in_progress_tasks,
            "review_tasks": review_tasks,
            "not_started_tasks": not_started_tasks,
            "paused_tasks": paused_tasks,
            "overdue_tasks": overdue_tasks,
            "completion_rate": round((completed_tasks / total_tasks * 100), 1) if total_tasks > 0 else 0,
            "total_departments": total_departments,
            "total_users": total_users,
            "filter_dept_id": dept_id,
            "filter_user_id": user_id
        },
        "action_queue": action_queue,
        "priority_stats": priority_stats,
        "department_stats": dept_stats,
        "staff_stats": staff_stats,
        "user_tasks": user_tasks
    }

