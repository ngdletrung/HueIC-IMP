from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional, Any, Dict
from datetime import datetime, timezone

from app.db.session import get_db
from app.models.task import (
    Task, TaskPriority, TaskStatus, TaskComment,
    TaskType, VisibilityScope, ProgressRule,
    TaskAssignment, TaskRecurringRule, TaskAssignmentRole, TaskAssignmentStatus
)
from app.models.user import User, UserRole
from app.schemas.task import TaskCreate, TaskUpdate, TaskOut, TaskCommentCreate, TaskCommentOut
from app.api.deps import get_current_user

router = APIRouter()

def recalculate_parent_progress(db: Session, parent_id: int):
    """Tính lũy kế tiến độ và trạng thái lên Task cha khi các task con thay đổi"""
    parent_task = db.query(Task).filter(Task.id == parent_id).first()
    if not parent_task:
        return

    subtasks = db.query(Task).filter(Task.parent_id == parent_id).all()
    if not subtasks:
        return

    if parent_task.progress_rule == ProgressRule.AVERAGE:
        total_progress = sum(st.progress_percent for st in subtasks)
        parent_task.progress_percent = round(total_progress / len(subtasks), 1)
    elif parent_task.progress_rule == ProgressRule.WEIGHTED:
        total_weight = sum(st.weight for st in subtasks) or 1.0
        weighted_sum = sum(st.progress_percent * st.weight for st in subtasks)
        parent_task.progress_percent = round(weighted_sum / total_weight, 1)
    elif parent_task.progress_rule == ProgressRule.ALL:
        all_done = all(st.status == TaskStatus.HOAN_THANH for st in subtasks)
        parent_task.progress_percent = 100.0 if all_done else 0.0

    # Nếu tất cả task con đã hoàn thành thì đưa cha vào trạng thái Chờ nghiệm thu (UNDER_REVIEW) hoặc Hoàn thành
    if parent_task.progress_percent >= 100.0 and all(st.status == TaskStatus.HOAN_THANH for st in subtasks):
        if parent_task.status not in (TaskStatus.CHO_DUYET, TaskStatus.HOAN_THANH):
            parent_task.status = TaskStatus.CHO_DUYET
    elif parent_task.progress_percent > 0:
        if parent_task.status == TaskStatus.CHUA_BAT_DAU:
            parent_task.status = TaskStatus.DANG_THUC_HIEN

    db.add(parent_task)
    db.commit()

    # Đệ quy nếu còn cấp cha cao hơn
    if parent_task.parent_id:
        recalculate_parent_progress(db, parent_task.parent_id)

@router.get("/workload", summary="Tải công việc thời gian thực của cán bộ (Workload Indicator)")
def get_users_workload(
    department_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    """Trả về danh sách cán bộ cùng số lượng công việc đang phụ trách để hỗ trợ chia tải công bằng"""
    user_query = db.query(User).filter(User.is_active == True)
    if department_id:
        user_query = user_query.filter(User.department_id == department_id)
    
    users = user_query.all()
    results = []

    active_statuses = [TaskStatus.CHUA_BAT_DAU, TaskStatus.DANG_THUC_HIEN, TaskStatus.CHO_DUYET]

    for u in users:
        active_count = db.query(Task).filter(
            Task.assignee_id == u.id,
            Task.status.in_(active_statuses)
        ).count()

        if active_count <= 2:
            status_code = "GREEN"
            label = f"🟢 {active_count} việc (Tải nhẹ)"
        elif active_count <= 4:
            status_code = "YELLOW"
            label = f"🟡 {active_count} việc (Vừa phải)"
        else:
            status_code = "RED"
            label = f"🔴 {active_count} việc (Quá tải)"

        results.append({
            "user_id": u.id,
            "full_name": u.full_name,
            "role": u.role.value if hasattr(u.role, "value") else str(u.role),
            "department_id": u.department_id,
            "department_code": u.department.code if u.department else None,
            "in_progress_count": active_count,
            "status_code": status_code,
            "label": label
        })

    return results

@router.get("", response_model=List[TaskOut], summary="Danh sách công việc & tiến độ")
def get_tasks(
    db: Session = Depends(get_db),
    status: Optional[TaskStatus] = None,
    priority: Optional[TaskPriority] = None,
    type: Optional[TaskType] = None,
    visibility: Optional[VisibilityScope] = None,
    dept_id: Optional[int] = Query(None, description="Lọc theo đơn vị chủ trì hoặc phối hợp"),
    assignee_id: Optional[int] = None,
    parent_id: Optional[int] = Query(None, description="Lọc theo task cha"),
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_user)
) -> Any:
    query = db.query(Task).options(
        joinedload(Task.leading_department),
        joinedload(Task.assisting_department),
        joinedload(Task.assignee),
        joinedload(Task.creator),
        joinedload(Task.comments).joinedload(TaskComment.author),
        joinedload(Task.children),
        joinedload(Task.assignments)
    )

    # Lọc theo 3 tầng Visibility & Phân quyền người dùng
    if current_user.role == UserRole.STAFF:
        if current_user.department_id:
            query = query.filter(
                (Task.created_by_id == current_user.id) |
                (Task.assignee_id == current_user.id) |
                ((Task.visibility == VisibilityScope.DEPARTMENT) & (
                    (Task.leading_dept_id == current_user.department_id) |
                    (Task.assisting_dept_id == current_user.department_id)
                )) |
                (Task.visibility == VisibilityScope.ORGANIZATIONAL)
            )
    elif current_user.role == UserRole.DEPT_HEAD:
        if current_user.department_id:
            query = query.filter(
                (Task.created_by_id == current_user.id) |
                (Task.assignee_id == current_user.id) |
                ((Task.leading_dept_id == current_user.department_id) |
                 (Task.assisting_dept_id == current_user.department_id)) |
                (Task.visibility == VisibilityScope.ORGANIZATIONAL)
            )
    else:
        # BGH / SuperAdmin: thấy ORGANIZATIONAL và DEPARTMENT, ẩn PRIVATE của người khác
        query = query.filter(
            (Task.visibility.in_([VisibilityScope.ORGANIZATIONAL, VisibilityScope.DEPARTMENT])) |
            (Task.created_by_id == current_user.id) |
            (Task.assignee_id == current_user.id)
        )

    if status:
        query = query.filter(Task.status == status)
    if priority:
        query = query.filter(Task.priority == priority)
    if type:
        query = query.filter(Task.type == type)
    if visibility:
        query = query.filter(Task.visibility == visibility)
    if dept_id:
        query = query.filter((Task.leading_dept_id == dept_id) | (Task.assisting_dept_id == dept_id))
    if assignee_id:
        query = query.filter(Task.assignee_id == assignee_id)
    if parent_id is not None:
        query = query.filter(Task.parent_id == parent_id)
    if search:
        query = query.filter(Task.title.ilike(f"%{search}%") | Task.description.ilike(f"%{search}%"))

    return query.order_by(Task.created_at.desc()).offset(skip).limit(limit).all()

@router.post("", response_model=TaskOut, summary="Giao nhiệm vụ / Tạo mới công việc")
def create_task(
    task_in: TaskCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    task_data = task_in.model_dump()
    raw_steps = task_data.pop("steps", None)
    task_data["created_by_id"] = current_user.id
    task_data["received_at"] = datetime.now(timezone.utc)

    steps = task_data.get("workflow_steps") or []
    if steps and len(steps) > 0:
        total = len(steps)
        done = sum(1 for s in steps if s.get("is_completed"))
        calc_pct = round((done / total) * 100)
        task_data["progress_percent"] = float(calc_pct)
        if calc_pct == 100:
            task_data["status"] = TaskStatus.HOAN_THANH
            task_data["completed_at"] = datetime.now(timezone.utc)
        elif calc_pct > 0:
            task_data["status"] = TaskStatus.DANG_THUC_HIEN
        else:
            task_data["status"] = TaskStatus.CHUA_BAT_DAU
    else:
        if task_data.get("progress_percent") == 100 and task_data.get("status") != TaskStatus.HOAN_THANH:
            task_data["status"] = TaskStatus.HOAN_THANH
            task_data["completed_at"] = datetime.now(timezone.utc)

    task = Task(**task_data)
    db.add(task)
    db.commit()
    db.refresh(task)

    # Nếu có danh sách sub-tasks con (phân rã PDCA theo parent_id)
    if raw_steps and isinstance(raw_steps, list) and len(raw_steps) > 0:
        for idx, s in enumerate(raw_steps):
            sub_deadline = s.get("due_date") or s.get("deadline")
            sub_task = Task(
                title=s.get("title") or f"Bước {idx+1}: {s.get('name', '')}",
                description=s.get("description", ""),
                parent_id=task.id,
                type=task.type,
                visibility=task.visibility,
                priority=task.priority,
                status=TaskStatus.CHUA_BAT_DAU,
                progress_percent=0.0,
                weight=float(s.get("weight", 1.0)),
                leading_dept_id=task.leading_dept_id,
                assignee_id=s.get("assignee_id") or task.assignee_id,
                created_by_id=current_user.id,
                due_date=sub_deadline
            )
            db.add(sub_task)
        db.commit()
        recalculate_parent_progress(db, task.id)
        db.refresh(task)

    # Tự động ghi comment tạo việc
    step_count = len(raw_steps) if raw_steps else len(steps)
    step_msg = f" (gồm {step_count} bước mốc quy trình)" if step_count > 0 else ""
    comment = TaskComment(
        task_id=task.id,
        author_id=current_user.id,
        content=f"Đã khởi tạo nhiệm vụ: {task.title}{step_msg}"
    )
    db.add(comment)
    db.commit()

    return task

@router.get("/{task_id}", response_model=TaskOut, summary="Chi tiết công việc")
def get_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    task = db.query(Task).options(
        joinedload(Task.leading_department),
        joinedload(Task.assisting_department),
        joinedload(Task.assignee),
        joinedload(Task.creator),
        joinedload(Task.comments).joinedload(TaskComment.author),
        joinedload(Task.children),
        joinedload(Task.assignments)
    ).filter(Task.id == task_id).first()
    
    if not task:
        raise HTTPException(status_code=404, detail="Không tìm thấy công việc.")
    return task

@router.put("/{task_id}", response_model=TaskOut, summary="Cập nhật tiến độ & trạng thái công việc")
def update_task(
    task_id: int,
    task_in: TaskUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Không tìm thấy công việc.")

    update_data = task_in.model_dump(exclude_unset=True)
    
    # 1. Nếu có cập nhật workflow_steps, tự động tính % tiến độ và trạng thái
    if "workflow_steps" in update_data and update_data["workflow_steps"] is not None:
        steps = update_data["workflow_steps"]
        if len(steps) > 0:
            total = len(steps)
            done = sum(1 for s in steps if s.get("is_completed"))
            calc_pct = round((done / total) * 100)
            update_data["progress_percent"] = float(calc_pct)
            if calc_pct == 100:
                update_data["status"] = TaskStatus.HOAN_THANH
                if not task.completed_at:
                    update_data["completed_at"] = datetime.now(timezone.utc)
            elif calc_pct == 0:
                update_data["status"] = TaskStatus.CHUA_BAT_DAU
                update_data["completed_at"] = None
            else:
                update_data["status"] = TaskStatus.DANG_THUC_HIEN
                update_data["completed_at"] = None

    # 2. Tự động cập nhật thời gian hoàn thành nếu đổi sang HOAN_THANH hoặc progress 100%
    if update_data.get("status") == TaskStatus.HOAN_THANH or update_data.get("progress_percent") == 100:
        if not task.completed_at:
            update_data["completed_at"] = datetime.now(timezone.utc)
        if update_data.get("progress_percent") == 100 and "status" not in update_data:
            update_data["status"] = TaskStatus.HOAN_THANH

    old_status = task.status
    old_progress = task.progress_percent

    for field, value in update_data.items():
        setattr(task, field, value)

    db.commit()
    db.refresh(task)

    # 3. Nếu là task con thì tự động tính lũy kế % lên task cha
    if task.parent_id:
        recalculate_parent_progress(db, task.parent_id)

    # Ghi log bình luận nếu có cập nhật tiến độ / trạng thái quan trọng
    log_changes = []
    if "status" in update_data and update_data["status"] != old_status:
        status_val = task.status.value if hasattr(task.status, "value") else str(task.status)
        log_changes.append(f"trạng thái sang '{status_val}'")
    if "progress_percent" in update_data and update_data["progress_percent"] != old_progress:
        log_changes.append(f"tiến độ thành {task.progress_percent}%")

    if log_changes:
        db.add(TaskComment(
            task_id=task.id,
            author_id=current_user.id,
            content=f"Cập nhật: {', '.join(log_changes)}."
        ))
        db.commit()

    return task

@router.delete("/{task_id}", summary="Xóa công việc")
def delete_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Không tìm thấy công việc.")
    
    if current_user.role != UserRole.SUPERADMIN and task.created_by_id != current_user.id:
        raise HTTPException(status_code=403, detail="Bạn không có quyền xóa công việc này.")

    parent_id = task.parent_id
    db.delete(task)
    db.commit()

    if parent_id:
        recalculate_parent_progress(db, parent_id)

    return {"message": f"Đã xóa thành công công việc #{task_id}"}

@router.post("/{task_id}/comments", response_model=TaskCommentOut, summary="Gửi báo cáo / thảo luận công việc")
def add_task_comment(
    task_id: int,
    comment_in: TaskCommentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Không tìm thấy công việc.")

    comment = TaskComment(
        task_id=task_id,
        author_id=current_user.id,
        content=comment_in.content
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return comment

