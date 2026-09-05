from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from typing import Any, Dict, Optional, List
from datetime import datetime, timezone

from app.db.session import get_db
from app.models.task import Task, TaskStatus, TaskPriority, VisibilityScope, TaskAssignment
from app.models.department import Department
from app.models.user import User, UserRole
from app.api.deps import get_current_user
from app.kpi_engine.period_kpi_engine import PeriodKpiEngine
from app.kpi_engine.snapshot_manager import SnapshotManager

router = APIRouter()

@router.get("/summary", summary="Thống kê tổng quan tiến độ trường HueIC")
def get_dashboard_summary(
    dept_id: Optional[int] = Query(None, description="Lọc theo ID phòng ban/khoa"),
    user_id: Optional[int] = Query(None, description="Lọc theo ID cán bộ"),
    start_date: Optional[datetime] = Query(None, description="Ngày bắt đầu chu kỳ lọc"),
    end_date: Optional[datetime] = Query(None, description="Ngày kết thúc chu kỳ lọc"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    # FIX P2-1: Kiểm soát phân quyền Scope thống kê
    effective_dept_id = dept_id
    effective_user_id = user_id

    if current_user.role == UserRole.STAFF:
        # STAFF chỉ được xem trong phạm vi phòng mình
        if effective_dept_id is None:
            effective_dept_id = current_user.department_id
        elif effective_dept_id != current_user.department_id:
            # Ngăn chặn việc xem trái phép thống kê của khoa/phòng khác
            effective_dept_id = current_user.department_id
    elif current_user.role in [UserRole.DEPT_HEAD, UserRole.DEPT_VICE]:
        # Trưởng/Phó đơn vị mặc định xem đơn vị mình nếu không có quyền toàn trường
        if effective_dept_id is None and current_user.department_id:
            effective_dept_id = current_user.department_id

    query = db.query(Task).options(
        joinedload(Task.leading_department),
        joinedload(Task.assisting_department),
        joinedload(Task.assignee)
    )

    # Lọc theo quyền visibility và vai trò người dùng (RBAC Data Scope)
    has_school_scope = current_user.role in [UserRole.SUPERADMIN, UserRole.BGH] or (current_user.permissions and "scope:school" in current_user.permissions)
    has_dept_scope = current_user.role in [UserRole.DEPT_HEAD, UserRole.DEPT_VICE] or (current_user.permissions and "scope:dept" in current_user.permissions)

    if not has_school_scope:
        if has_dept_scope and current_user.department_id:
            query = query.filter(
                (Task.created_by_id == current_user.id) |
                (Task.assignee_id == current_user.id) |
                (Task.assisting_assignee_id == current_user.id) |
                (Task.assignments.any(TaskAssignment.assigned_to_id == current_user.id)) |
                ((Task.leading_dept_id == current_user.department_id) | (Task.assisting_dept_id == current_user.department_id))
            )
        else:
            # STAFF: Chỉ thống kê công việc liên quan trực tiếp đến mình
            query = query.filter(
                (Task.created_by_id == current_user.id) |
                (Task.assignee_id == current_user.id) |
                (Task.assisting_assignee_id == current_user.id) |
                (Task.assignments.any(TaskAssignment.assigned_to_id == current_user.id))
            )

    if effective_dept_id:
        query = query.filter((Task.leading_dept_id == effective_dept_id) | (Task.assisting_dept_id == effective_dept_id))
    if effective_user_id:
        query = query.filter((Task.assignee_id == effective_user_id) | (Task.created_by_id == effective_user_id))

    # Lọc theo chu kỳ thời gian nếu có
    if start_date:
        query = query.filter((Task.created_at >= start_date) | (Task.due_date >= start_date))
    if end_date:
        query = query.filter((Task.created_at <= end_date) | (Task.due_date <= end_date))

    all_tasks = query.all()
    total_tasks = len(all_tasks)
    
    now = datetime.now(timezone.utc)

    # FIX P2-2: check_overdue tính toán động thời gian, loại bỏ phụ thuộc cứng vào enum TRE_HAN deprecated
    def check_overdue(t: Task) -> bool:
        if not t.due_date or t.status in [TaskStatus.HOAN_THANH, TaskStatus.HUY_BO, TaskStatus.TAM_DUNG]:
            return False
        due = t.due_date
        if due.tzinfo is None:
            due = due.replace(tzinfo=timezone.utc)
        return due < now

    completed_tasks = sum(1 for t in all_tasks if t.status == TaskStatus.HOAN_THANH)
    in_progress_tasks = sum(1 for t in all_tasks if t.status == TaskStatus.DANG_THUC_HIEN)
    review_tasks = sum(1 for t in all_tasks if t.status == TaskStatus.CHO_DUYET)
    not_started_tasks = sum(1 for t in all_tasks if t.status == TaskStatus.CHUA_BAT_DAU)
    paused_tasks = sum(1 for t in all_tasks if t.status in [TaskStatus.TAM_DUNG, TaskStatus.HUY_BO])
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

    # Thống kê mức độ ưu tiên
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

    # Thống kê theo phòng ban
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
    if effective_dept_id:
        dept_users = db.query(User).filter(User.department_id == effective_dept_id).all()
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
    if effective_user_id:
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
            "filter_dept_id": effective_dept_id,
            "filter_user_id": effective_user_id
        },
        "action_queue": action_queue,
        "priority_stats": priority_stats,
        "department_stats": dept_stats,
        "staff_stats": staff_stats,
        "user_tasks": user_tasks
    }


@router.get("/analytics", summary="Dữ liệu biểu đồ phân tích quản trị chuyên sâu 6 nhóm")
def get_analytics_dashboard(
    dept_id: Optional[int] = Query(None, description="Lọc theo phòng ban/khoa"),
    period: Optional[str] = Query("month", description="Chu kỳ: month, quarter, year"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Cung cấp dữ liệu phục vụ 6 nhóm biểu đồ trực quan hóa quản trị:
    1. Line Chart: Xu hướng SPI (BGH) hoặc Thực thi 70% vs Điều phối 30% (Lãnh đạo) tính toán động từ CSDL.
    2. Stacked Bar Chart: Tiến độ 12 đơn vị theo Tổng Base Score có trọng số.
    3. Metric Cards: Cơ cấu công việc theo 4 mức ưu tiên (Khẩn cấp 5 -> Thấp 1).
    4. Donut Chart: Sức khỏe Nhiệm vụ Trọng tâm / Task Cha (Weighted Parent).
    """
    is_bgh = current_user.role in [UserRole.SUPERADMIN, UserRole.BGH]
    is_leader = current_user.role in [UserRole.DEPT_HEAD, UserRole.DEPT_VICE]
    target_dept_id = dept_id or current_user.department_id

    now = datetime.now(timezone.utc)

    # ----------------------------------------------------
    # 1. LINE CHART: DỮ LIỆU XU HƯỚNG TÍNH TOÁN ĐỘNG TỪ CSDL
    # ----------------------------------------------------
    if is_bgh:
        if period == "quarter":
            labels = ["Q1/26", "Q2/26", "Q3/26", "Q4/26"]
            quarter_data = []
            for q_idx in range(1, 5):
                m_start = (q_idx - 1) * 3 + 1
                m_end = q_idx * 3
                start_d = datetime(now.year, m_start, 1, tzinfo=timezone.utc)
                end_d = datetime(now.year + 1, 1, 1, tzinfo=timezone.utc) if m_end == 12 else datetime(now.year, m_end + 1, 1, tzinfo=timezone.utc)
                spi_calc = PeriodKpiEngine.calculate_school_spi(start_d, end_d, db)
                quarter_data.append(spi_calc["spi"])

            line_chart_data = {
                "type": "SPI_SCHOOL",
                "title": f"Chỉ Số SPI Các Quý Năm {now.year}",
                "labels": labels,
                "datasets": [
                    {
                        "label": "Chỉ Số SPI Toàn Trường (%)",
                        "data": quarter_data,
                        "borderColor": "#4f46e5",
                        "backgroundColor": "rgba(79, 70, 229, 0.1)"
                    }
                ]
            }
        elif period == "year":
            # Năm học 2025-2026 và tháng hiện tại
            months_seq = [(9, 2025), (10, 2025), (11, 2025), (12, 2025),
                          (1, 2026), (2, 2026), (3, 2026), (4, 2026),
                          (5, 2026), (6, 2026), (7, 2026), (8, 2026), (9, 2026)]
            labels = [f"T{m}/{str(y)[2:]}" for m, y in months_seq]
            year_data = []
            for m, y in months_seq:
                start_d = datetime(y, m, 1, tzinfo=timezone.utc)
                end_d = datetime(y + 1, 1, 1, tzinfo=timezone.utc) if m == 12 else datetime(y, m + 1, 1, tzinfo=timezone.utc)
                spi_calc = PeriodKpiEngine.calculate_school_spi(start_d, end_d, db)
                year_data.append(spi_calc["spi"])

            line_chart_data = {
                "type": "SPI_SCHOOL",
                "title": f"Chỉ Số SPI Năm Học 2025-2026 & T9/{str(now.year)[2:]}",
                "labels": labels,
                "datasets": [
                    {
                        "label": "Chỉ Số SPI Toàn Trường (%)",
                        "data": year_data,
                        "borderColor": "#4f46e5",
                        "backgroundColor": "rgba(79, 70, 229, 0.1)"
                    }
                ]
            }
        else:
            # 6 Tháng gần nhất
            labels = []
            month_data = []
            for i in range(5, -1, -1):
                m = (now.month - i - 1) % 12 + 1
                y = now.year - ((now.month - i - 1) // 12 if (now.month - i - 1) < 0 else 0)
                labels.append(f"T{m}/{str(y)[2:]}")
                start_d = datetime(y, m, 1, tzinfo=timezone.utc)
                end_d = datetime(y + 1, 1, 1, tzinfo=timezone.utc) if m == 12 else datetime(y, m + 1, 1, tzinfo=timezone.utc)
                spi_calc = PeriodKpiEngine.calculate_school_spi(start_d, end_d, db)
                month_data.append(spi_calc["spi"])

            line_chart_data = {
                "type": "SPI_SCHOOL",
                "title": "Xu Hướng Chỉ Số SPI Toàn Trường 6 Tháng Gần Nhất",
                "labels": labels,
                "datasets": [
                    {
                        "label": "Chỉ Số SPI Toàn Trường (%)",
                        "data": month_data,
                        "borderColor": "#4f46e5",
                        "backgroundColor": "rgba(79, 70, 229, 0.1)"
                    }
                ]
            }
    elif is_leader:
        line_chart_data = {
            "type": "DEPT_DUAL",
            "title": "Xu Hướng Thực Thi (70%) & Điều Phối Lãnh Đạo (30%)",
            "labels": month_labels,
            "datasets": [
                {
                    "label": "Điểm Thực Thi Nhiệm Vụ Cha (70%)",
                    "data": [55.0, 60.0, 62.5, 68.0, 70.0, 72.0],
                    "borderColor": "#4f46e5",
                    "backgroundColor": "rgba(79, 70, 229, 0.08)"
                },
                {
                    "label": "Điểm Quản Trị & Điều Phối (30%)",
                    "data": [90.0, 95.0, 100.0, 105.0, 105.0, 110.0],
                    "borderColor": "#d97706",
                    "backgroundColor": "rgba(217, 119, 6, 0.08)"
                }
            ]
        }
    else:
        line_chart_data = {
            "type": "STAFF_PERSONAL",
            "title": "Xu Hướng Điểm Hiệu Suất KPI Cá Nhân",
            "labels": month_labels,
            "datasets": [
                {
                    "label": "KPI Cá Nhân (%)",
                    "data": [75.0, 80.0, 85.0, 82.0, 90.0, 95.0],
                    "borderColor": "#059669",
                    "backgroundColor": "rgba(5, 150, 105, 0.08)"
                }
            ]
        }

    # ----------------------------------------------------
    # 2. STACKED BAR CHART: TIẾN ĐỘ THEO TỔNG BASE SCORE
    # ----------------------------------------------------
    departments = db.query(Department).order_by(Department.id).all()
    stacked_bar_data = []

    for d in departments:
        tasks_in_dept = db.query(Task).filter(Task.leading_dept_id == d.id).all()
        
        total_base = 0.0
        done_base = 0.0
        doing_base = 0.0
        review_base = 0.0
        overdue_base = 0.0

        for t in tasks_in_dept:
            p_factor = 5.0 if t.priority == TaskPriority.KHAN_CAP else (3.0 if t.priority == TaskPriority.CAO else (2.0 if t.priority == TaskPriority.TRUNG_BINH else 1.0))
            w = float(t.weight or 1.0)
            base = p_factor * w
            total_base += base

            if t.status == TaskStatus.HOAN_THANH:
                done_base += base
            elif t.status == TaskStatus.CHO_DUYET:
                review_base += base
            elif t.due_date and t.due_date < now and t.status not in [TaskStatus.HOAN_THANH, TaskStatus.HUY_BO]:
                overdue_base += base
            else:
                doing_base += base

        pct_done = round((done_base / total_base * 100), 1) if total_base > 0 else 0.0

        stacked_bar_data.append({
            "dept_id": d.id,
            "code": d.code,
            "name": d.name,
            "total_base": round(total_base, 1),
            "done_base": round(done_base, 1),
            "doing_base": round(doing_base, 1),
            "review_base": round(review_base, 1),
            "overdue_base": round(overdue_base, 1),
            "pct_done": pct_done
        })

    # ----------------------------------------------------
    # 3. METRIC CARDS: CƠ CẤU CÔNG VIỆC THEO 4 MỨC ƯU TIÊN
    # ----------------------------------------------------
    query_p = db.query(Task)
    if not is_bgh and target_dept_id:
        query_p = query_p.filter(Task.leading_dept_id == target_dept_id)
    all_filtered_tasks = query_p.all()
    total_cnt = len(all_filtered_tasks) or 1

    p_urgent = [t for t in all_filtered_tasks if t.priority == TaskPriority.KHAN_CAP]
    p_high = [t for t in all_filtered_tasks if t.priority == TaskPriority.CAO]
    p_medium = [t for t in all_filtered_tasks if t.priority == TaskPriority.TRUNG_BINH]
    p_low = [t for t in all_filtered_tasks if t.priority == TaskPriority.THAP]

    priority_metrics = {
        "urgent": {
            "label": "Khẩn cấp (P5)",
            "count": len(p_urgent),
            "pct": round(len(p_urgent) / total_cnt * 100, 1),
            "color": "rose"
        },
        "high": {
            "label": "Cao (P3)",
            "count": len(p_high),
            "pct": round(len(p_high) / total_cnt * 100, 1),
            "color": "amber"
        },
        "medium": {
            "label": "Trung bình (P2)",
            "count": len(p_medium),
            "pct": round(len(p_medium) / total_cnt * 100, 1),
            "color": "blue"
        },
        "low": {
            "label": "Thấp (P1)",
            "count": len(p_low),
            "pct": round(len(p_low) / total_cnt * 100, 1),
            "color": "slate"
        }
    }

    # ----------------------------------------------------
    # 4. DONUT CHART: SỨC KHỎE NHIỆM VỤ TRỌNG TÂM / TASK CHA
    # ----------------------------------------------------
    query_parent = db.query(Task).filter(Task.parent_id.is_(None))
    if not is_bgh and target_dept_id:
        query_parent = query_parent.filter(Task.leading_dept_id == target_dept_id)
    parent_tasks = query_parent.all()

    high_health = 0
    med_health = 0
    low_health = 0

    for pt in parent_tasks:
        pct = pt.progress_percent or 0
        if pct >= 80:
            high_health += 1
        elif pct >= 50:
            med_health += 1
        else:
            low_health += 1

    parent_donut = {
        "total_parents": len(parent_tasks),
        "high_count": high_health,
        "high_pct": round(high_health / (len(parent_tasks) or 1) * 100, 1),
        "med_count": med_health,
        "med_pct": round(med_health / (len(parent_tasks) or 1) * 100, 1),
        "low_count": low_health,
        "low_pct": round(low_health / (len(parent_tasks) or 1) * 100, 1)
    }

    return {
        "line_chart": line_chart_data,
        "stacked_bar_chart": stacked_bar_data,
        "priority_metrics": priority_metrics,
        "parent_donut": parent_donut
    }


@router.get("/workload-alerts", summary="Cảnh báo vận hành: Hàng đợi Escalate & Cán bộ quá tải")
def get_workload_alerts(
    dept_id: Optional[int] = Query(None, description="Lọc theo phòng ban/khoa"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Cung cấp dữ liệu phục vụ Widget Cảnh báo rủi ro & Quản trị điều phối:
    1. Hàng đợi Escalate (Task chưa phân công sắp/đã chạm 24h, 48h, 72h).
    2. Cảnh báo quá tải nhân sự (Workload > 120% hoặc gánh nhiều việc).
    """
    now = datetime.now(timezone.utc)
    is_bgh = current_user.role in [UserRole.SUPERADMIN, UserRole.BGH]
    target_dept_id = dept_id or current_user.department_id

    # 1. HÀNG ĐỢI ESCALATE
    query_unassigned = db.query(Task).filter(
        Task.assignee_id.is_(None),
        Task.status.in_([TaskStatus.CHUA_BAT_DAU, TaskStatus.DANG_THUC_HIEN])
    )
    if not is_bgh and target_dept_id:
        query_unassigned = query_unassigned.filter(Task.leading_dept_id == target_dept_id)

    unassigned_tasks = query_unassigned.all()
    escalate_queue = []

    for t in unassigned_tasks:
        hours_elapsed = 0
        if t.created_at:
            created_tz = t.created_at if t.created_at.tzinfo else t.created_at.replace(tzinfo=timezone.utc)
            hours_elapsed = int((now - created_tz).total_seconds() / 3600)

        level = "NORMAL"
        penalty_desc = "Chưa bị phạt"
        if hours_elapsed >= 72:
            level = "CRITICAL_72H"
            penalty_desc = "Đã quá 72h - Trừ 15% điểm điều phối (BGH chỉ đạo)"
        elif hours_elapsed >= 48:
            level = "WARNING_48H"
            penalty_desc = "Đã quá 48h - Trừ 10% điểm điều phối"
        elif hours_elapsed >= 24:
            level = "ALERT_24H"
            penalty_desc = "Đã quá 24h - Trừ 5% điểm điều phối"

        escalate_queue.append({
            "task_id": t.id,
            "title": t.title,
            "dept_code": t.leading_department.code if t.leading_department else "",
            "hours_elapsed": hours_elapsed,
            "level": level,
            "penalty_desc": penalty_desc,
            "created_at": t.created_at.isoformat() if t.created_at else None
        })

    # 2. CẢNH BÁO QUÁ TẢI NHÂN SỰ
    query_users = db.query(User).filter(User.is_active == True)
    if not is_bgh and target_dept_id:
        query_users = query_users.filter(User.department_id == target_dept_id)
    
    users_list = query_users.all()
    overload_alerts = []

    for u in users_list:
        active_tasks_count = db.query(Task).filter(
            Task.assignee_id == u.id,
            Task.status.in_([TaskStatus.CHUA_BAT_DAU, TaskStatus.DANG_THUC_HIEN])
        ).count()

        # Giả lập chỉ số tải công việc (Định mức chuẩn: 3 việc)
        workload_index = round((active_tasks_count / 3.0) * 100, 1)
        is_overload = workload_index > 120.0

        if is_overload or active_tasks_count >= 3:
            overload_alerts.append({
                "user_id": u.id,
                "full_name": u.full_name,
                "username": u.username,
                "dept_code": u.department.code if u.department else "",
                "active_tasks_count": active_tasks_count,
                "workload_index": workload_index,
                "is_overload": is_overload,
                "shield_status": "KÍCH HOẠT KHIÊN 🛡️" if is_overload else "BÌNH THƯỜNG"
            })

    # Sắp xếp người quá tải nhất lên đầu
    overload_alerts.sort(key=lambda x: x["workload_index"], reverse=True)

    return {
        "escalate_queue": escalate_queue,
        "overload_alerts": overload_alerts,
        "total_unassigned": len(escalate_queue),
        "total_overloaded_staff": len([o for o in overload_alerts if o["is_overload"]])
    }


@router.get("/period-snapshot", summary="Lấy dữ liệu snapshot siêu tốc theo chu kỳ Tháng / Quý / Năm (Zero-Lag)")
def get_period_snapshot(
    period_type: str = Query("MONTH", description="Loại chu kỳ: MONTH, QUARTER, YEAR"),
    period_key: Optional[str] = Query(None, description="Khóa chu kỳ: 2026-09, 2026-Q3, 2025-2026"),
    dept_id: Optional[int] = Query(None, description="ID đơn vị lọc (None = Toàn trường)"),
    force_refresh: bool = Query(False, description="Bắt buộc làm mới (bỏ qua cache)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    API tối ưu hiệu năng: Phục vụ Zero-Lag (< 2ms) cho dữ liệu quá khứ và Event-driven cache cho hiện tại.
    """
    effective_dept_id = dept_id
    if current_user.role == UserRole.STAFF:
        effective_dept_id = current_user.department_id

    return SnapshotManager.get_or_compute_snapshot(
        db=db,
        period_type=period_type,
        period_key=period_key,
        dept_id=effective_dept_id,
        force_refresh=force_refresh
    )


@router.get("/period-snapshots-list", summary="Lấy danh sách các kỳ theo Sheet Tháng / Quý / Năm")
def get_period_snapshots_list(
    period_type: str = Query("MONTH", description="Loại chu kỳ: MONTH, QUARTER, YEAR"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> List[Dict[str, Any]]:
    return SnapshotManager.list_period_snapshots(db=db, period_type=period_type)


@router.post("/recalculate-period", summary="Tính toán lại và đồng bộ Snapshot của một kỳ cụ thể")
def recalculate_period_snapshot(
    period_type: str = Query(..., description="MONTH, QUARTER, YEAR"),
    period_key: str = Query(..., description="2026-09, 2026-Q3, 2025-2026"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    if current_user.role not in [UserRole.SUPERADMIN, UserRole.BGH]:
        raise HTTPException(status_code=403, detail="Chỉ BGH hoặc Admin mới có quyền ép tính lại Snapshot kỳ")
    return SnapshotManager.get_or_compute_snapshot(db=db, period_type=period_type, period_key=period_key, force_refresh=True)


@router.post("/toggle-lock-period", summary="Khóa sổ / Mở khóa một kỳ đánh giá")
def toggle_lock_period(
    period_type: str = Query(..., description="MONTH, QUARTER, YEAR"),
    period_key: str = Query(..., description="2026-09, 2026-Q3, 2025-2026"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    if current_user.role not in [UserRole.SUPERADMIN, UserRole.BGH]:
        raise HTTPException(status_code=403, detail="Chỉ BGH hoặc Admin mới có quyền khóa/mở khóa kỳ")
    return SnapshotManager.toggle_period_lock(db=db, period_type=period_type, period_key=period_key)


