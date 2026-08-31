from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional, Any
from datetime import datetime, timezone

from app.db.session import get_db
from app.models.task import Task, TaskPriority, TaskStatus, TaskComment
from app.models.user import User, UserRole
from app.schemas.task import TaskCreate, TaskUpdate, TaskOut, TaskCommentCreate, TaskCommentOut
from app.api.deps import get_current_user

router = APIRouter()

@router.get("", response_model=List[TaskOut], summary="Danh sách công việc & tiến độ")
def get_tasks(
    db: Session = Depends(get_db),
    status: Optional[TaskStatus] = None,
    priority: Optional[TaskPriority] = None,
    dept_id: Optional[int] = Query(None, description="Lọc theo đơn vị chủ trì hoặc phối hợp"),
    assignee_id: Optional[int] = None,
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
        joinedload(Task.comments).joinedload(TaskComment.author)
    )

    # Nếu là STAFF chỉ xem việc liên quan phòng ban mình hoặc được giao (trừ SuperAdmin/Trưởng đơn vị)
    if current_user.role == UserRole.STAFF:
        if current_user.department_id:
            query = query.filter(
                (Task.leading_dept_id == current_user.department_id) |
                (Task.assisting_dept_id == current_user.department_id) |
                (Task.assignee_id == current_user.id)
            )

    if status:
        query = query.filter(Task.status == status)
    if priority:
        query = query.filter(Task.priority == priority)
    if dept_id:
        query = query.filter((Task.leading_dept_id == dept_id) | (Task.assisting_dept_id == dept_id))
    if assignee_id:
        query = query.filter(Task.assignee_id == assignee_id)
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
    task_data["created_by_id"] = current_user.id

    steps = task_data.get("workflow_steps") or []
    if steps and len(steps) > 0:
        total = len(steps)
        done = sum(1 for s in steps if s.get("is_completed"))
        calc_pct = round((done / total) * 100)
        task_data["progress_percent"] = calc_pct
        if calc_pct == 100:
            task_data["status"] = TaskStatus.HOAN_THANH
            task_data["completed_at"] = datetime.now(timezone.utc)
        elif calc_pct > 0:
            task_data["status"] = TaskStatus.DANG_THUC_HIEN
        else:
            task_data["status"] = TaskStatus.CHUA_BAT_DAU
    else:
        # Nếu tiến độ = 100% thì tự động hoàn thành
        if task_data.get("progress_percent") == 100 and task_data.get("status") != TaskStatus.HOAN_THANH:
            task_data["status"] = TaskStatus.HOAN_THANH
            task_data["completed_at"] = datetime.now(timezone.utc)

    task = Task(**task_data)
    db.add(task)
    db.commit()
    db.refresh(task)

    # Tự động ghi comment tạo việc
    step_msg = f" (gồm {len(steps)} bước quy trình)" if steps else ""
    comment = TaskComment(
        task_id=task.id,
        author_id=current_user.id,
        content=f"Đã tạo công việc: {task.title}{step_msg}"
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
        joinedload(Task.comments).joinedload(TaskComment.author)
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
            update_data["progress_percent"] = calc_pct
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

    # Ghi log bình luận nếu có cập nhật tiến độ / trạng thái quan trọng
    log_changes = []
    if "status" in update_data and update_data["status"] != old_status:
        log_changes.append(f"trạng thái sang '{task.status.value}'")
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

    db.delete(task)
    db.commit()
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
