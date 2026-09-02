from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional, Any, Dict
from datetime import datetime, timezone

from app.db.session import get_db
from app.models.task import (
    Task, TaskPriority, TaskStatus, TaskComment,
    TaskType, VisibilityScope, ProgressRule,
    TaskAssignment, TaskRecurringRule, TaskAssignmentRole, TaskAssignmentStatus,
    CollaborationStatus, TaskActionLog, TaskNotification
)
from app.models.user import User, UserRole
from app.models.department import Department
from app.schemas.task import (
    TaskCreate, TaskUpdate, TaskOut, TaskCommentCreate, TaskCommentOut,
    CollaborationAcceptRequest, CollaborationRejectRequest, CollaborationEscalateRequest,
    TaskAssignmentCreate, TaskAssignmentUpdate, TaskAssignmentOut,
    TaskEscalateRequest,
    TaskRecurringRuleCreate, TaskRecurringRuleUpdate, TaskRecurringRuleOut,
    TaskActionLogOut,
    AssignmentAcceptRequest, AssignmentRejectRequest,
    ProposalApproveRequest, ProposalRejectRequest, ProposalRequestChangesRequest,
    ProposalResubmitRequest, TaskNotificationOut, TaskNotificationListOut
)
from app.api.deps import get_current_user
from app.core.task_security import (
    can_user_read_task, can_user_update_task, can_user_delete_task, can_user_manage_assignments,
    can_user_create_task, is_dept_leader
)
from app.kpi_engine import BaseScorer, ParentScorer, WorkloadEngine

router = APIRouter()

def create_task_notification(
    db: Session,
    user_id: int,
    task_id: Optional[int],
    notif_type: str,
    title: str,
    message: str
) -> TaskNotification:
    """Tạo bản ghi thông báo điều hành và lưu vết an toàn"""
    notif = TaskNotification(
        user_id=user_id,
        task_id=task_id,
        type=notif_type,
        title=title,
        message=message
    )
    db.add(notif)
    return notif

def log_task_action(
    db: Session,
    task_id: Optional[int],
    actor_id: Optional[int],
    action: str,
    details: Optional[Dict[str, Any]] = None
) -> TaskActionLog:
    """Tạo bản ghi kiểm toán Audit Log an toàn cho mọi hành động trên task"""
    log = TaskActionLog(
        task_id=task_id,
        actor_id=actor_id,
        action=action,
        details=details or {}
    )
    db.add(log)
    return log

def notify_task_stakeholders(
    db: Session,
    task: Task,
    actor: User,
    notif_type: str,
    title: str,
    message: str
):
    """
    Tự động gửi thông báo điều hành thời gian thực cho tất cả các bên liên quan:
    - Người giao việc / Khởi tạo (created_by_id)
    - Người phân công (assigned_by_id)
    - Cán bộ phụ trách chính (assignee_id)
    - Cán bộ / Đơn vị phối hợp (assisting_assignee_id)
    - Lãnh đạo đơn vị chủ trì (DEPT_HEAD, DEPT_VICE)
    (Loại trừ chính người vừa thực hiện thao tác)
    """
    recipient_ids = set()

    if task.created_by_id and task.created_by_id != actor.id:
        recipient_ids.add(task.created_by_id)
    if task.assigned_by_id and task.assigned_by_id != actor.id:
        recipient_ids.add(task.assigned_by_id)
    if task.assignee_id and task.assignee_id != actor.id:
        recipient_ids.add(task.assignee_id)
    if task.assisting_assignee_id and task.assisting_assignee_id != actor.id:
        recipient_ids.add(task.assisting_assignee_id)

    # Lãnh đạo đơn vị chủ trì
    if task.leading_dept_id:
        dept_leaders = db.query(User.id).filter(
            User.department_id == task.leading_dept_id,
            User.role.in_([UserRole.DEPT_HEAD, UserRole.DEPT_VICE]),
            User.id != actor.id
        ).all()
        for l in dept_leaders:
            recipient_ids.add(l[0])

    for uid in recipient_ids:
        create_task_notification(
            db=db,
            user_id=uid,
            task_id=task.id,
            notif_type=notif_type,
            title=title,
            message=message
        )

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

    # Nếu tất cả task con đã hoàn thành thì tự động hoàn thành và đóng nhiệm vụ cha
    if parent_task.progress_percent >= 100.0 and all(st.status == TaskStatus.HOAN_THANH for st in subtasks):
        if parent_task.status != TaskStatus.HOAN_THANH:
            parent_task.status = TaskStatus.HOAN_THANH
            if not parent_task.completed_at:
                parent_task.completed_at = datetime.now(timezone.utc)
    elif parent_task.progress_percent > 0:
        if parent_task.status == TaskStatus.CHUA_BAT_DAU:
            parent_task.status = TaskStatus.DANG_THUC_HIEN

    db.add(parent_task)
    db.commit()

    # Đệ quy nếu còn cấp cha cao hơn
    if parent_task.parent_id:
        recalculate_parent_progress(db, parent_task.parent_id)

# ----------------------------------------------------
# 1. RECURRING RULES ENDPOINTS
# ----------------------------------------------------
@router.get("/recurring-rules", response_model=List[TaskRecurringRuleOut], summary="Danh sách cấu hình công việc định kỳ")
def get_recurring_rules(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    return db.query(TaskRecurringRule).order_by(TaskRecurringRule.id.desc()).all()

@router.post("/recurring-rules", response_model=TaskRecurringRuleOut, summary="Tạo mới quy tắc lặp lại công việc")
def create_recurring_rule(
    rule_in: TaskRecurringRuleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    if current_user.role not in [UserRole.SUPERADMIN, UserRole.BGH, UserRole.DEPT_HEAD]:
        raise HTTPException(status_code=403, detail="Chỉ lãnh đạo hoặc Quản trị viên mới được tạo quy tắc định kỳ.")
    
    rule = TaskRecurringRule(**rule_in.model_dump())
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return rule

@router.post("/recurring-rules/{rule_id}/generate", response_model=TaskOut, summary="Phát sinh nhiệm vụ mới từ quy tắc định kỳ")
def generate_task_from_rule(
    rule_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    if current_user.role not in [UserRole.SUPERADMIN, UserRole.BGH, UserRole.DEPT_HEAD, UserRole.DEPT_VICE]:
        raise HTTPException(status_code=403, detail="Chỉ lãnh đạo hoặc Quản trị viên mới được phát sinh nhiệm vụ từ quy tắc định kỳ.")

    rule = db.query(TaskRecurringRule).filter(TaskRecurringRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Không tìm thấy quy tắc định kỳ.")
    
    # Tìm task mẫu gần nhất thuộc series này
    sample_task = db.query(Task).filter(Task.series_id == rule_id).order_by(Task.id.desc()).first()
    title = f"[{rule.frequency}] {sample_task.title if sample_task else 'Nhiệm vụ định kỳ mới'}"
    
    new_task = Task(
        title=title,
        description=sample_task.description if sample_task else f"Phát sinh tự động theo quy tắc định kỳ #{rule_id}",
        type=sample_task.type if sample_task else TaskType.ROUTINE,
        visibility=sample_task.visibility if sample_task else VisibilityScope.DEPARTMENT,
        priority=sample_task.priority if sample_task else TaskPriority.TRUNG_BINH,
        status=TaskStatus.CHUA_BAT_DAU,
        progress_percent=0.0,
        series_id=rule.id,
        leading_dept_id=sample_task.leading_dept_id if sample_task else current_user.department_id,
        assignee_id=sample_task.assignee_id if sample_task else None,
        created_by_id=current_user.id,
        start_date=datetime.now(timezone.utc)
    )
    db.add(new_task)
    db.commit()
    db.refresh(new_task)

    log_task_action(db, new_task.id, current_user.id, "CREATE", {"source": "RECURRING_RULE", "rule_id": rule_id})
    db.commit()
    return new_task

# ----------------------------------------------------
# 2. WORKLOAD & TASK LIST ENDPOINTS
# ----------------------------------------------------
@router.get("/workload", summary="Tải công việc thời gian thực của cán bộ (Workload Indicator)")
def get_users_workload(
    department_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    """Trả về danh sách cán bộ cùng số lượng công việc đang phụ trách để hỗ trợ chia tải công bằng"""
    has_school_scope = current_user.role in [UserRole.SUPERADMIN, UserRole.BGH] or (current_user.permissions and "scope:school" in current_user.permissions)
    
    effective_dept_id = department_id
    if not has_school_scope:
        # Nếu không có quyền toàn trường thì bắt buộc chỉ được xem đơn vị mình
        effective_dept_id = current_user.department_id

    user_query = db.query(User).filter(User.is_active == True)
    if effective_dept_id:
        user_query = user_query.filter(User.department_id == effective_dept_id)
    elif not has_school_scope:
        user_query = user_query.filter(User.id == current_user.id)
    
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
        joinedload(Task.approver),
        joinedload(Task.assigned_by),
        joinedload(Task.comments).joinedload(TaskComment.author),
        joinedload(Task.children),
        joinedload(Task.assignments),
        joinedload(Task.action_logs).joinedload(TaskActionLog.actor)
    )

    # Lọc theo 3 tầng Visibility & Phân quyền người dùng (RBAC Data Scope)
    has_school_scope = current_user.role in [UserRole.SUPERADMIN, UserRole.BGH] or (current_user.permissions and "scope:school" in current_user.permissions)
    has_dept_scope = current_user.role in [UserRole.DEPT_HEAD, UserRole.DEPT_VICE] or (current_user.permissions and "scope:dept" in current_user.permissions)

    if has_school_scope:
        # BGH / SuperAdmin / scope:school: Thấy toàn bộ ORGANIZATIONAL và DEPARTMENT, ẩn PRIVATE của người khác
        query = query.filter(
            (Task.visibility.in_([VisibilityScope.ORGANIZATIONAL, VisibilityScope.DEPARTMENT])) |
            (Task.created_by_id == current_user.id) |
            (Task.assignee_id == current_user.id) |
            (Task.assisting_assignee_id == current_user.id) |
            (Task.assignments.any((TaskAssignment.assigned_to_id == current_user.id) & (TaskAssignment.is_active == True)))
        )
    elif has_dept_scope and current_user.department_id:
        # Lãnh đạo đơn vị / scope:dept: Thấy việc của đơn vị mình và việc toàn trường giao đơn vị mình
        query = query.filter(
            (Task.created_by_id == current_user.id) |
            (Task.assignee_id == current_user.id) |
            (Task.assisting_assignee_id == current_user.id) |
            (Task.assignments.any((TaskAssignment.assigned_to_id == current_user.id) & (TaskAssignment.is_active == True))) |
            ((Task.leading_dept_id == current_user.department_id) | (Task.assisting_dept_id == current_user.department_id))
        )
    else:
        # STAFF (scope:personal): Chỉ thấy các nhiệm vụ liên quan trực tiếp đến mình (Creator, Assignee, Collaborator)
        query = query.filter(
            (Task.created_by_id == current_user.id) |
            (Task.assignee_id == current_user.id) |
            (Task.assisting_assignee_id == current_user.id) |
            (Task.assignments.any((TaskAssignment.assigned_to_id == current_user.id) & (TaskAssignment.is_active == True)))
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
        s = f"%{search}%"
        query = query.filter((Task.title.ilike(s)) | (Task.description.ilike(s)))

    return query.order_by(Task.created_at.desc()).offset(skip).limit(limit).all()

# ----------------------------------------------------
# 3. TASK CRUD & GRANULAR SECURITY ENDPOINTS
# ----------------------------------------------------
@router.post("", response_model=TaskOut, summary="Tạo mới công việc (Hỗ trợ phân rã Task con & RACI)")
def create_task(
    task_in: TaskCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    task_data = task_in.model_dump()

    # 1. Kiểm tra phân quyền tạo nhiệm vụ theo Role x Scope
    can_create, reason = can_user_create_task(current_user, task_data)
    if not can_create:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=reason
        )

    # Validate bắt buộc thông tin đối với Đề xuất sáng kiến (PROPOSAL)
    if task_data.get("type") == TaskType.PROPOSAL:
        desc = (task_data.get("description") or "").strip()
        if len(desc) < 10:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Đề xuất sáng kiến bắt buộc phải có nội dung mô tả chi tiết (tối thiểu 10 ký tự) nêu rõ sự cần thiết, mục tiêu hoặc dự toán."
            )

    raw_steps = task_data.pop("steps", None)
    collaborator_ids = task_data.pop("collaborator_ids", None) or []
    task_data["created_by_id"] = current_user.id

    # FIX P1-4: received_at chỉ được gán khi BGH giao trực tiếp hoặc khi tiếp nhận, không gán mặc định
    if current_user.role in [UserRole.SUPERADMIN, UserRole.BGH]:
        task_data["received_at"] = datetime.now(timezone.utc)
    else:
        task_data["received_at"] = None

    # Xác định trạng thái phối hợp liên đơn vị 2 chiều
    if task_data.get("assisting_dept_id"):
        if current_user.role in [UserRole.SUPERADMIN, UserRole.BGH]:
            task_data["collaboration_status"] = CollaborationStatus.DA_TIEP_NHAN
            task_data["collaboration_accepted_at"] = datetime.now(timezone.utc)
            task_data["received_at"] = datetime.now(timezone.utc)
        else:
            task_data["collaboration_status"] = CollaborationStatus.CHO_XAC_NHAN
    else:
        task_data["collaboration_status"] = CollaborationStatus.NONE

    # Dấu vết Phân công (Assignment Governance Trail)
    if task_data.get("assignee_id"):
        task_data["assigned_by_id"] = current_user.id
        task_data["assigned_at"] = datetime.now(timezone.utc)
        if task_data.get("assignee_id") == current_user.id:
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
        if task_data.get("type") == TaskType.PROPOSAL and task_data.get("status") in [None, TaskStatus.CHUA_BAT_DAU]:
            task_data["status"] = TaskStatus.CHO_DUYET
        elif task_data.get("progress_percent") == 100 and task_data.get("status") != TaskStatus.HOAN_THANH:
            task_data["status"] = TaskStatus.HOAN_THANH
            task_data["completed_at"] = datetime.now(timezone.utc)

    task = Task(**task_data)
    task.base_score = BaseScorer.calculate_base_score(task.priority, task.weight)
    db.add(task)
    db.commit()
    db.refresh(task)

    # Chụp ảnh snapshot tải nếu có phân công người thực hiện
    if task.assignee_id:
        try:
            WorkloadEngine.capture_snapshot(task.id, task.assignee_id, db)
            db.commit()
        except Exception as e:
            print(f"⚠️ Không thể chụp snapshot tải: {e}")

    # Gán các Cán bộ phối hợp vào bảng task_assignments (RACI: CONSULTED)
    if collaborator_ids and isinstance(collaborator_ids, list) and len(collaborator_ids) > 0:
        for col_id in collaborator_ids:
            if col_id and col_id != task.assignee_id:
                assignment = TaskAssignment(
                    task_id=task.id,
                    role=TaskAssignmentRole.CONSULTED,
                    assigned_by_id=current_user.id,
                    assigned_to_id=col_id,
                    status=TaskAssignmentStatus.ACCEPTED,
                    note="Cán bộ phối hợp cùng thực hiện"
                )
                db.add(assignment)
        db.commit()

    # Nếu có danh sách sub-tasks con (phân rã PDCA theo parent_id)
    if raw_steps and isinstance(raw_steps, list) and len(raw_steps) > 0:
        for idx, s in enumerate(raw_steps):
            sub_deadline = s.get("due_date") or s.get("deadline")
            sub_w = float(s.get("weight", 1.0))
            sub_task = Task(
                title=s.get("title") or f"Bước {idx+1}: {s.get('name', '')}",
                description=s.get("description", ""),
                parent_id=task.id,
                type=task.type,
                visibility=task.visibility,
                priority=task.priority,
                status=TaskStatus.CHUA_BAT_DAU,
                progress_percent=0.0,
                weight=sub_w,
                base_score=BaseScorer.calculate_base_score(task.priority, sub_w),
                leading_dept_id=task.leading_dept_id,
                assignee_id=s.get("assignee_id") or task.assignee_id,
                created_by_id=current_user.id,
                due_date=sub_deadline
            )
            db.add(sub_task)
            db.commit()
            db.refresh(sub_task)
            if sub_task.assignee_id:
                try:
                    WorkloadEngine.capture_snapshot(sub_task.id, sub_task.assignee_id, db)
                    db.commit()
                except Exception as e:
                    pass

        recalculate_parent_progress(db, task.id)
        db.refresh(task)

    # Ghi log kiểm toán khởi tạo (TaskActionLog)
    log_task_action(db, task.id, current_user.id, "CREATE", {"title": task.title, "priority": task.priority.value if hasattr(task.priority, "value") else str(task.priority)})

    return task

@router.get("/{task_id}", response_model=TaskOut, summary="Chi tiết công việc")
def get_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    # FIX P0-1: Kiểm tra quyền xem chi tiết task bằng RBAC / Visibility Scope
    task = db.query(Task).options(
        joinedload(Task.leading_department),
        joinedload(Task.assisting_department),
        joinedload(Task.assignee),
        joinedload(Task.creator),
        joinedload(Task.approver),
        joinedload(Task.assigned_by),
        joinedload(Task.comments).joinedload(TaskComment.author),
        joinedload(Task.children),
        joinedload(Task.assignments).joinedload(TaskAssignment.assigned_to),
        joinedload(Task.action_logs).joinedload(TaskActionLog.actor)
    ).filter(Task.id == task_id).first()
    
    if not task:
        raise HTTPException(status_code=404, detail="Không tìm thấy công việc.")

    if not can_user_read_task(current_user, task):
        raise HTTPException(status_code=403, detail="Bạn không có quyền xem thông tin công việc này.")

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
    update_fields = set(update_data.keys())

    # FIX P0-2: Kiểm tra phân quyền ghi hạt mịn (Field-level Write Permission)
    can_update, reason = can_user_update_task(current_user, task, update_fields)
    if not can_update:
        raise HTTPException(status_code=403, detail=reason)
    
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

    # 2. Tự động cập nhật trạng thái & thời gian hoàn thành theo % tiến độ
    if update_data.get("status") == TaskStatus.HOAN_THANH or update_data.get("progress_percent", 0) >= 100:
        if not task.completed_at:
            update_data["completed_at"] = datetime.now(timezone.utc)
        if update_data.get("progress_percent", 0) >= 100 and "status" not in update_data:
            update_data["status"] = TaskStatus.HOAN_THANH
    elif "progress_percent" in update_data and "status" not in update_data:
        p = update_data["progress_percent"]
        if p > 0 and task.status in (TaskStatus.CHUA_BAT_DAU, TaskStatus.CHO_DUYET):
            update_data["status"] = TaskStatus.DANG_THUC_HIEN

    # 3. Dấu vết phân công lại cán bộ (Re-assignment Audit Trail)
    if "assignee_id" in update_data and update_data["assignee_id"] != task.assignee_id:
        if update_data["assignee_id"]:
            update_data["assigned_by_id"] = current_user.id
            update_data["assigned_at"] = datetime.now(timezone.utc)
            if update_data["assignee_id"] == current_user.id:
                update_data["received_at"] = datetime.now(timezone.utc)
            else:
                update_data["received_at"] = None
        else:
            update_data["assigned_by_id"] = None
            update_data["assigned_at"] = None
            update_data["received_at"] = None

    old_status = task.status
    old_progress = task.progress_percent
    old_assignee_id = task.assignee_id

    for field, value in update_data.items():
        setattr(task, field, value)

    db.commit()
    db.refresh(task)

    # Chụp snapshot nếu có thay đổi người thực hiện
    if "assignee_id" in update_data and update_data["assignee_id"] and update_data["assignee_id"] != old_assignee_id:
        try:
            WorkloadEngine.capture_snapshot(task.id, task.assignee_id, db)
            db.commit()
        except Exception as e:
            pass

    # 3. Tính điểm KPI nếu nhiệm vụ Hoàn thành
    if task.status == TaskStatus.HOAN_THANH or task.progress_percent >= 100:
        if not task.completed_at:
            task.completed_at = datetime.now(timezone.utc)
        BaseScorer.calculate_task_score(task, db)
        db.commit()

    # Nếu là task con thì tự động tính lũy kế % và Weighted Parent Score lên task cha
    if task.parent_id:
        recalculate_parent_progress(db, task.parent_id)
        try:
            ParentScorer.update_parent_score(task.parent_id, db)
            db.commit()
        except Exception as e:
            pass

    # Ghi log kiểm toán Audit Trail & Bình luận
    log_changes = []
    if "status" in update_data and update_data["status"] != old_status:
        status_val = task.status.value if hasattr(task.status, "value") else str(task.status)
        log_changes.append(f"trạng thái sang '{status_val}'")
        log_task_action(db, task.id, current_user.id, "UPDATE_STATUS", {"old_status": str(old_status), "new_status": status_val})

    if "progress_percent" in update_data and update_data["progress_percent"] != old_progress:
        log_changes.append(f"tiến độ thành {task.progress_percent}%")
        log_task_action(db, task.id, current_user.id, "UPDATE_PROGRESS", {"old_progress": old_progress, "new_progress": task.progress_percent})

    if log_changes:
        # Bắn thông báo thời gian thực cho các bên liên quan
        if task.status == TaskStatus.HOAN_THANH or task.progress_percent >= 100:
            notify_task_stakeholders(
                db=db,
                task=task,
                actor=current_user,
                notif_type="TASK_COMPLETED",
                title="🎉 Nhiệm vụ đã hoàn thành 100%!",
                message=f"Cán bộ {current_user.full_name} đã hoàn tất toàn bộ tiến độ nhiệm vụ: '{task.title}'."
            )
        else:
            notify_task_stakeholders(
                db=db,
                task=task,
                actor=current_user,
                notif_type="PROGRESS_UPDATE",
                title=f"Tiến độ nhiệm vụ: {task.progress_percent}% 📈",
                message=f"Cán bộ {current_user.full_name} vừa cập nhật tiến độ '{task.title}' lên {task.progress_percent}% ({', '.join(log_changes)})."
            )
        db.commit()

    return task

@router.delete("/{task_id}", summary="Xóa công việc")
def delete_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    # FIX P0-3: Mở rộng quyền xóa cho Creator, SuperAdmin, BGH và Trưởng đơn vị chủ trì
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Không tìm thấy công việc.")
    
    can_delete, reason = can_user_delete_task(current_user, task)
    if not can_delete:
        raise HTTPException(status_code=403, detail=reason)

    parent_id = task.parent_id
    title_saved = task.title

    log_task_action(db, None, current_user.id, "DELETE", {"deleted_task_id": task_id, "title": title_saved})
    
    db.delete(task)
    db.commit()

    if parent_id:
        recalculate_parent_progress(db, parent_id)

    return {"message": f"Đã xóa thành công công việc #{task_id}"}

# ----------------------------------------------------
# 4. RACI ASSIGNMENTS ENDPOINTS (FIX P1-1)
# ----------------------------------------------------
@router.post("/{task_id}/assignments", response_model=TaskAssignmentOut, summary="Gán cán bộ theo mô hình RACI (Thủ công)")
def add_task_assignment(
    task_id: int,
    assignment_in: TaskAssignmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Không tìm thấy công việc.")

    if not can_user_manage_assignments(current_user, task):
        raise HTTPException(status_code=403, detail="Bạn không có quyền phân công cán bộ cho công việc này.")

    existing = db.query(TaskAssignment).filter(
        TaskAssignment.task_id == task_id,
        TaskAssignment.assigned_to_id == assignment_in.assigned_to_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Cán bộ này đã được phân công trong nhiệm vụ.")

    assignment = TaskAssignment(
        task_id=task_id,
        assigned_to_id=assignment_in.assigned_to_id,
        assigned_by_id=current_user.id,
        role=assignment_in.role,
        department_id=assignment_in.department_id or current_user.department_id,
        status=TaskAssignmentStatus.TRANSFERRING,
        assigned_deadline=assignment_in.assigned_deadline,
        note=assignment_in.note
    )
    db.add(assignment)
    db.commit()
    db.refresh(assignment)

    u = db.query(User).filter(User.id == assignment_in.assigned_to_id).first()
    u_name = u.full_name if u else f"ID {assignment_in.assigned_to_id}"
    log_task_action(db, task_id, current_user.id, "REASSIGN", {"assigned_to": u_name, "role": str(assignment_in.role)})
    
    db.add(TaskComment(
        task_id=task_id,
        author_id=current_user.id,
        content=f"👤 Đã phân công cán bộ [{u_name}] với vai trò RACI: {assignment_in.role.value if hasattr(assignment_in.role, 'value') else str(assignment_in.role)}"
    ))
    db.commit()
    return assignment

@router.delete("/{task_id}/assignments/{assignment_id}", summary="Xóa phân công cán bộ khỏi nhiệm vụ")
def remove_task_assignment(
    task_id: int,
    assignment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Không tìm thấy công việc.")

    if not can_user_manage_assignments(current_user, task):
        raise HTTPException(status_code=403, detail="Bạn không có quyền quản lý phân công cho công việc này.")

    assignment = db.query(TaskAssignment).filter(
        TaskAssignment.id == assignment_id,
        TaskAssignment.task_id == task_id
    ).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Không tìm thấy bản ghi phân công.")

    db.delete(assignment)
    db.commit()
    return {"message": "Đã xóa phân công thành công."}

# ----------------------------------------------------
# 5. ESCALATION & COLLABORATION PROTOCOL (FIX P1-2, P1-4)
# ----------------------------------------------------
@router.post("/{task_id}/escalate", response_model=TaskOut, summary="Leo thang cảnh báo / Báo cáo khẩn cấp BGH (Fix P1-2)")
def escalate_task(
    task_id: int,
    req: TaskEscalateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Không tìm thấy công việc.")

    # Kiểm tra quyền: BGH/SuperAdmin, Creator, Assignee, hoặc Lãnh đạo đơn vị chủ trì
    is_authorized = (
        current_user.role in [UserRole.SUPERADMIN, UserRole.BGH] or
        task.created_by_id == current_user.id or
        task.assignee_id == current_user.id or
        (current_user.department_id and task.leading_dept_id == current_user.department_id and is_dept_leader(current_user))
    )
    if not is_authorized:
        raise HTTPException(status_code=403, detail="Bạn không có thẩm quyền thực hiện leo thang báo cáo khẩn cấp cho nhiệm vụ này.")

    new_level = min(3, max(1, req.target_level or (task.escalation_level + 1)))
    task.escalation_level = new_level
    task.type = TaskType.ESCALATION
    task.visibility = VisibilityScope.ORGANIZATIONAL

    log_task_action(db, task.id, current_user.id, "ESCALATE", {"level": new_level, "reason": req.reason})
    
    db.add(TaskComment(
        task_id=task.id,
        author_id=current_user.id,
        content=f"🚨 [CẢNH BÁO LEO THANG CẤP {new_level}] {req.reason}{f' (Ghi chú: {req.note})' if req.note else ''}"
    ))
    db.commit()
    db.refresh(task)
    return task

@router.post("/{task_id}/collaboration/accept", response_model=TaskOut, summary="Đồng ý tiếp nhận phối hợp nhiệm vụ")
def accept_collaboration(
    task_id: int,
    req: CollaborationAcceptRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Không tìm thấy công việc.")
    
    if not task.assisting_dept_id:
        raise HTTPException(status_code=400, detail="Công việc không có đơn vị phối hợp.")

    # Kiểm tra quyền: Superadmin, BGH, hoặc Lãnh đạo của assisting_dept
    is_authorized = (
        current_user.role in [UserRole.SUPERADMIN, UserRole.BGH] or
        (current_user.department_id == task.assisting_dept_id and current_user.role in [UserRole.DEPT_HEAD, UserRole.DEPT_VICE])
    )
    if not is_authorized:
        raise HTTPException(status_code=403, detail="Chỉ Trưởng/Phó đơn vị phối hợp hoặc Ban Giám Hiệu mới có quyền tiếp nhận phối hợp.")

    task.collaboration_status = CollaborationStatus.DA_TIEP_NHAN
    task.collaboration_accepted_at = datetime.now(timezone.utc)
    task.received_at = datetime.now(timezone.utc) # FIX P1-4: Set thời điểm tiếp nhận thực tế
    task.collaboration_reject_reason = None

    if req.assisting_assignee_id:
        task.assisting_assignee_id = req.assisting_assignee_id
        assignment = TaskAssignment(
            task_id=task.id,
            role=TaskAssignmentRole.CONSULTED,
            assigned_by_id=current_user.id,
            assigned_to_id=req.assisting_assignee_id,
            department_id=task.assisting_dept_id,
            status=TaskAssignmentStatus.ACCEPTED,
            note="Đầu mối phối hợp của đơn vị"
        )
        db.add(assignment)

    assisting_dept = db.query(Department).filter(Department.id == task.assisting_dept_id).first()
    dept_code = assisting_dept.code if assisting_dept else "Đơn vị"
    assignee_name = ""
    if req.assisting_assignee_id:
        u = db.query(User).filter(User.id == req.assisting_assignee_id).first()
        if u:
            assignee_name = f" và chỉ định cán bộ [{u.full_name}] làm đầu mối"

    log_task_action(db, task.id, current_user.id, "COLLABORATE", {"status": "ACCEPTED", "dept": dept_code})

    comment = TaskComment(
        task_id=task_id,
        author_id=current_user.id,
        content=f"🤝 [{dept_code}] Đã tiếp nhận đề nghị phối hợp{assignee_name}.{f' Ghi chú: {req.note}' if req.note else ''}"
    )
    db.add(comment)
    db.commit()
    db.refresh(task)
    return task

@router.post("/{task_id}/collaboration/reject", response_model=TaskOut, summary="Từ chối phối hợp nhiệm vụ (Kèm lý do)")
def reject_collaboration(
    task_id: int,
    req: CollaborationRejectRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Không tìm thấy công việc.")

    if not task.assisting_dept_id:
        raise HTTPException(status_code=400, detail="Công việc không có đơn vị phối hợp.")

    is_authorized = (
        current_user.role in [UserRole.SUPERADMIN, UserRole.BGH] or
        (current_user.department_id == task.assisting_dept_id and current_user.role in [UserRole.DEPT_HEAD, UserRole.DEPT_VICE])
    )
    if not is_authorized:
        raise HTTPException(status_code=403, detail="Chỉ Trưởng/Phó đơn vị phối hợp mới có quyền từ chối phối hợp.")

    task.collaboration_status = CollaborationStatus.TU_CHOI
    task.collaboration_reject_reason = req.reason
    task.collaboration_rejected_at = datetime.now(timezone.utc)
    task.assisting_assignee_id = None

    assisting_dept = db.query(Department).filter(Department.id == task.assisting_dept_id).first()
    dept_code = assisting_dept.code if assisting_dept else "Đơn vị"

    log_task_action(db, task.id, current_user.id, "COLLABORATE", {"status": "REJECTED", "dept": dept_code, "reason": req.reason})

    comment = TaskComment(
        task_id=task_id,
        author_id=current_user.id,
        content=f"❌ [{dept_code}] Đã TỪ CHỐI đề nghị phối hợp. Lý do: {req.reason}"
    )
    db.add(comment)
    db.commit()
    db.refresh(task)
    return task

@router.post("/{task_id}/collaboration/escalate-bgh", response_model=TaskOut, summary="Chuyển BGH chỉ đạo phối hợp bắt buộc")
def escalate_collaboration_to_bgh(
    task_id: int,
    req: CollaborationEscalateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Không tìm thấy công việc.")

    is_authorized = (
        current_user.role in [UserRole.SUPERADMIN, UserRole.BGH] or
        (current_user.department_id == task.leading_dept_id and current_user.role in [UserRole.DEPT_HEAD, UserRole.DEPT_VICE]) or
        task.created_by_id == current_user.id
    )
    if not is_authorized:
        raise HTTPException(status_code=403, detail="Chỉ Đơn vị chủ trì mới có quyền chuyển BGH chỉ đạo.")

    task.visibility = VisibilityScope.ORGANIZATIONAL
    task.type = TaskType.ESCALATION

    # Tự động chỉ định Trưởng đơn vị phối hợp và thiết lập phân công trách nhiệm
    assisting_head = None
    if task.assisting_dept_id:
        assisting_head = db.query(User).filter(
            User.department_id == task.assisting_dept_id,
            User.role == UserRole.DEPT_HEAD,
            User.is_active == True
        ).first()

        if assisting_head:
            task.assisting_assignee_id = assisting_head.id
            task.collaboration_status = CollaborationStatus.CHO_XAC_NHAN
            task.collaboration_rejected_at = None
            task.collaboration_reject_reason = None

            # Tạo hoặc cập nhật RACI Assignment
            exist_assign = db.query(TaskAssignment).filter(
                TaskAssignment.task_id == task.id,
                TaskAssignment.assigned_to_id == assisting_head.id
            ).first()

            if not exist_assign:
                new_assign = TaskAssignment(
                    task_id=task.id,
                    role=TaskAssignmentRole.RESPONSIBLE,
                    assigned_by_id=current_user.id,
                    assigned_to_id=assisting_head.id,
                    department_id=task.assisting_dept_id,
                    status=TaskAssignmentStatus.TRANSFERRING,
                    is_active=True,
                    note="Được Ban Giám Hiệu chỉ đạo phối hợp bắt buộc"
                )
                db.add(new_assign)
            else:
                exist_assign.status = TaskAssignmentStatus.TRANSFERRING
                exist_assign.is_active = True
                exist_assign.note = "Được Ban Giám Hiệu chỉ đạo phối hợp bắt buộc"
                exist_assign.updated_at = datetime.now(timezone.utc)

            # Bắn thông báo đến Trưởng đơn vị phối hợp
            create_task_notification(
                db,
                user_id=assisting_head.id,
                task_id=task.id,
                notif_type="ASSIGNMENT",
                title="Chỉ đạo phối hợp bắt buộc từ BGH 🏛️",
                message=f"Ban Giám Hiệu chỉ đạo đơn vị phối hợp thực hiện nhiệm vụ: '{task.title}'. Vui lòng tiếp nhận và phân công cán bộ chuyên trách."
            )

    # Gửi thông báo đến tất cả thành viên Ban Giám Hiệu
    bgh_users = db.query(User).filter(User.role.in_([UserRole.BGH, UserRole.SUPERADMIN]), User.is_active == True).all()
    for bgh_u in bgh_users:
        if bgh_u.id != current_user.id:
            create_task_notification(
                db,
                user_id=bgh_u.id,
                task_id=task.id,
                notif_type="ESCALATION",
                title="Đề nghị BGH chỉ đạo phối hợp 🏛️",
                message=f"Đơn vị chủ trì đã chuyển đề nghị chỉ đạo phối hợp cấp trường cho nhiệm vụ: '{task.title}'"
            )

    log_task_action(db, task.id, current_user.id, "ESCALATE", {
        "type": "BGH_DIRECTIVE",
        "assisting_head_id": assisting_head.id if assisting_head else None,
        "note": req.note
    })

    comment = TaskComment(
        task_id=task_id,
        author_id=current_user.id,
        content=f"🏛️ Đơn vị chủ trì đã chuyển đề nghị phối hợp lên Ban Giám Hiệu để xin ý kiến chỉ đạo cấp trường.{f' Ghi chú: {req.note}' if req.note else ''}"
    )
    db.add(comment)
    db.commit()
    db.refresh(task)
    return task

# ----------------------------------------------------
# 7. ASSIGNMENT ACCEPT / REJECT ENDPOINTS
# ----------------------------------------------------
@router.post("/{task_id}/assignment/accept", response_model=TaskOut, summary="Cán bộ xác nhận tiếp nhận nhiệm vụ được giao")
def accept_task_assignment(
    task_id: int,
    req: AssignmentAcceptRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Không tìm thấy công việc.")

    is_assignee = (task.assignee_id == current_user.id or task.assisting_assignee_id == current_user.id)
    assignment = db.query(TaskAssignment).filter(
        TaskAssignment.task_id == task_id,
        TaskAssignment.assigned_to_id == current_user.id
    ).first()

    if not is_assignee and not assignment:
        raise HTTPException(status_code=403, detail="Bạn không phải là cán bộ được phân công cho nhiệm vụ này.")

    # Cập nhật trạng thái nhận việc
    task.received_at = datetime.now(timezone.utc)
    if task.status == TaskStatus.CHUA_BAT_DAU:
        task.status = TaskStatus.DANG_THUC_HIEN

    if assignment:
        assignment.status = TaskAssignmentStatus.ACCEPTED
        assignment.updated_at = datetime.now(timezone.utc)

    log_task_action(db, task.id, current_user.id, "ACCEPT_ASSIGNMENT", {"note": req.note})

    comment = TaskComment(
        task_id=task_id,
        author_id=current_user.id,
        content=f"✅ Cán bộ [{current_user.full_name}] đã XÁC NHẬN TIẾP NHẬN nhiệm vụ.{f' Ghi chú: {req.note}' if req.note else ''}"
    )
    db.add(comment)
    db.commit()
    db.refresh(task)
    return task

@router.post("/{task_id}/assignment/reject", response_model=TaskOut, summary="Cán bộ từ chối tiếp nhận nhiệm vụ (Kèm lý do)")
def reject_task_assignment(
    task_id: int,
    req: AssignmentRejectRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Không tìm thấy công việc.")

    is_assignee = (task.assignee_id == current_user.id)
    assignment = db.query(TaskAssignment).filter(
        TaskAssignment.task_id == task_id,
        TaskAssignment.assigned_to_id == current_user.id
    ).first()

    if not is_assignee and not assignment:
        raise HTTPException(status_code=403, detail="Bạn không phải là cán bộ được phân công cho nhiệm vụ này.")

    # Gỡ phân công để trả về cho lãnh đạo phân công lại
    task.assignment_reject_count = (task.assignment_reject_count or 0) + 1
    if is_assignee:
        task.assignee_id = None
        task.status = TaskStatus.CHUA_BAT_DAU

    if assignment:
        assignment.status = TaskAssignmentStatus.REJECTED
        assignment.is_active = False
        assignment.note = f"Từ chối tiếp nhận: {req.reason}"
        assignment.updated_at = datetime.now(timezone.utc)

    # Soft-delete các bản ghi phân công RACI đang chờ chuyển giao (TRANSFERRING) của user này
    other_transferrings = db.query(TaskAssignment).filter(
        TaskAssignment.task_id == task_id,
        TaskAssignment.assigned_to_id == current_user.id,
        TaskAssignment.status == TaskAssignmentStatus.TRANSFERRING
    ).all()
    for ot in other_transferrings:
        ot.is_active = False
        ot.note = f"Tự động hủy khi cán bộ từ chối nhiệm vụ (#{task_id})"
        ot.updated_at = datetime.now(timezone.utc)

    log_task_action(db, task.id, current_user.id, "REJECT_ASSIGNMENT", {"reason": req.reason})

    comment = TaskComment(
        task_id=task_id,
        author_id=current_user.id,
        content=f"⚠️ Cán bộ [{current_user.full_name}] đã TỪ CHỐI TIẾP NHẬN nhiệm vụ. Lý do: {req.reason}. Vui lòng Lãnh đạo xem xét phân bổ lại."
    )
    db.add(comment)
    db.commit()
    db.refresh(task)
    return task

# ----------------------------------------------------
# 8. PROPOSAL APPROVAL & REVIEW ENDPOINTS
# ----------------------------------------------------
@router.post("/{task_id}/proposal/approve", response_model=TaskOut, summary="Lãnh đạo / BGH phê duyệt đề xuất từ cấp dưới")
def approve_task_proposal(
    task_id: int,
    req: ProposalApproveRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Không tìm thấy đề xuất.")

    if task.type != TaskType.PROPOSAL:
        raise HTTPException(status_code=400, detail="Chỉ có thể phê duyệt các nhiệm vụ dạng Đề xuất (PROPOSAL).")

    # 1. No self-approval: Người tạo không được tự duyệt đề xuất của chính mình
    if task.created_by_id == current_user.id:
        raise HTTPException(status_code=403, detail="Người khởi tạo đề xuất không thể tự phê duyệt đề xuất của chính mình.")

    creator_dept_id = task.creator.department_id if task.creator else None
    if task.visibility == VisibilityScope.ORGANIZATIONAL:
        # Đề xuất cấp trường / Vượt cấp: Chỉ Ban Giám Hiệu và SuperAdmin
        is_authorized = current_user.role in [UserRole.SUPERADMIN, UserRole.BGH]
        err_msg = "Đề xuất cấp trường / Vượt cấp chỉ có Ban Giám Hiệu hoặc SuperAdmin mới có thẩm quyền phê duyệt."
    else:
        # Đề xuất cấp phòng: Chỉ Trưởng / Phó phòng của đơn vị trực thuộc
        is_authorized = (
            current_user.role in [UserRole.DEPT_HEAD, UserRole.DEPT_VICE] and 
            (current_user.department_id == task.leading_dept_id or current_user.department_id == creator_dept_id)
        )
        err_msg = "Đề xuất nội bộ cấp đơn vị chỉ do Trưởng/Phó đơn vị trực thuộc xem xét phê duyệt (BGH quan sát)."

    if not is_authorized:
        raise HTTPException(status_code=403, detail=err_msg)

    if req.title and req.title.strip():
        task.title = req.title.strip()
    if req.description is not None:
        task.description = req.description.strip()
    if req.priority:
        task.priority = req.priority
    if req.assisting_dept_id is not None:
        task.assisting_dept_id = req.assisting_dept_id if req.assisting_dept_id > 0 else None
        if task.assisting_dept_id:
            task.collaboration_status = TaskCollaborationStatus.CHO_XAC_NHAN

    task.type = req.target_type or TaskType.ROUTINE
    task.status = TaskStatus.CHUA_BAT_DAU
    task.approved_by_id = current_user.id
    task.approved_at = datetime.now(timezone.utc)
    if req.assignee_id:
        task.assignee_id = req.assignee_id
        task.assigned_by_id = current_user.id
        task.assigned_at = datetime.now(timezone.utc)
        task.received_at = None # Cán bộ cần bấm nhận việc
    if req.due_date:
        task.due_date = req.due_date

    assignee_name = ""
    if task.assignee_id:
        u = db.query(User).filter(User.id == task.assignee_id).first()
        if u:
            assignee_name = f", giao cho cán bộ [{u.full_name}] phụ trách"

    log_task_action(db, task.id, current_user.id, "APPROVE_PROPOSAL", {
        "new_title": task.title,
        "new_type": str(task.type),
        "target_assignee_id": task.assignee_id
    })
    
    comment_text = f"✅ [PHÊ DUYỆT ĐỀ XUẤT] Đề xuất đã được Lãnh đạo {current_user.full_name} phê duyệt thành nhiệm vụ chính thức{assignee_name}."
    if req.approval_note:
        comment_text += f" Ý kiến chỉ đạo: {req.approval_note}"
    
    db.add(TaskComment(
        task_id=task.id,
        author_id=current_user.id,
        content=comment_text
    ))

    # Gửi thông báo đến người đề xuất (nếu không phải là chính lãnh đạo)
    if task.created_by_id and task.created_by_id != current_user.id:
        create_task_notification(
            db,
            user_id=task.created_by_id,
            task_id=task.id,
            notif_type="PROPOSAL_APPROVED",
            title="Đề xuất đã được phê duyệt 🎉",
            message=f"Lãnh đạo {current_user.full_name} đã phê duyệt đề xuất: '{task.title}'"
        )
    # Gửi thông báo đến cán bộ được giao phụ trách
    if task.assignee_id and task.assignee_id != current_user.id:
        create_task_notification(
            db,
            user_id=task.assignee_id,
            task_id=task.id,
            notif_type="ASSIGNMENT",
            title="Bạn được giao nhiệm vụ mới 🎯",
            message=f"Lãnh đạo {current_user.full_name} đã giao nhiệm vụ: '{task.title}' cho bạn."
        )

    db.commit()
    db.refresh(task)
    return task

@router.post("/{task_id}/proposal/reject", response_model=TaskOut, summary="Lãnh đạo / BGH bác bỏ đề xuất")
def reject_task_proposal(
    task_id: int,
    req: ProposalRejectRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Không tìm thấy đề xuất.")

    if task.created_by_id == current_user.id:
        raise HTTPException(status_code=403, detail="Người khởi tạo không thể tự bác bỏ đề xuất của chính mình theo luồng duyệt.")

    creator_dept_id = task.creator.department_id if task.creator else None
    if task.visibility == VisibilityScope.ORGANIZATIONAL:
        is_authorized = current_user.role in [UserRole.SUPERADMIN, UserRole.BGH]
        err_msg = "Đề xuất cấp trường / Vượt cấp chỉ có Ban Giám Hiệu hoặc SuperAdmin mới có thẩm quyền bác bỏ."
    else:
        is_authorized = (
            current_user.role in [UserRole.DEPT_HEAD, UserRole.DEPT_VICE] and 
            (current_user.department_id == task.leading_dept_id or current_user.department_id == creator_dept_id)
        )
        err_msg = "Đề xuất nội bộ cấp đơn vị chỉ do Trưởng/Phó đơn vị trực thuộc xem xét xử lý."

    if not is_authorized:
        raise HTTPException(status_code=403, detail=err_msg)

    task.status = TaskStatus.HUY_BO

    log_task_action(db, task.id, current_user.id, "REJECT_PROPOSAL", {"reason": req.reason})

    comment = TaskComment(
        task_id=task_id,
        author_id=current_user.id,
        content=f"🚫 [BÁC BỎ ĐỀ XUẤT] Đề xuất không được phê duyệt. Lý do: {req.reason}"
    )
    db.add(comment)

    if task.created_by_id and task.created_by_id != current_user.id:
        create_task_notification(
            db,
            user_id=task.created_by_id,
            task_id=task.id,
            notif_type="PROPOSAL_REJECTED",
            title="Đề xuất đã bị bác bỏ ❌",
            message=f"Đề xuất '{task.title}' không được phê duyệt. Lý do: {req.reason}"
        )

    db.commit()
    db.refresh(task)
    return task

@router.post("/{task_id}/proposal/request-changes", response_model=TaskOut, summary="Lãnh đạo yêu cầu bổ sung/chỉnh sửa đề xuất")
def request_proposal_changes(
    task_id: int,
    req: ProposalRequestChangesRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Không tìm thấy đề xuất.")

    creator_dept_id = task.creator.department_id if task.creator else None
    is_authorized = (
        current_user.role in [UserRole.SUPERADMIN, UserRole.BGH] or
        (current_user.role in [UserRole.DEPT_HEAD, UserRole.DEPT_VICE] and 
         (current_user.department_id == task.leading_dept_id or current_user.department_id == creator_dept_id))
    )
    if not is_authorized:
        raise HTTPException(status_code=403, detail="Chỉ Ban Giám Hiệu hoặc Trưởng/Phó đơn vị mới có quyền yêu cầu chỉnh sửa đề xuất.")

    task.status = TaskStatus.TU_CHOI
    task.quality_reject_count = (task.quality_reject_count or 0) + 1

    log_task_action(db, task.id, current_user.id, "REQUEST_PROPOSAL_CHANGES", {"feedback": req.feedback})

    comment = TaskComment(
        task_id=task_id,
        author_id=current_user.id,
        content=f"🔄 [YÊU CẦU BỔ SUNG ĐỀ XUẤT] Đề xuất cần hoàn thiện thêm. Ý kiến phản hồi: {req.feedback}"
    )
    db.add(comment)

    if task.created_by_id and task.created_by_id != current_user.id:
        create_task_notification(
            db,
            user_id=task.created_by_id,
            task_id=task.id,
            notif_type="PROPOSAL_CHANGES_REQUESTED",
            title="Đề xuất cần bổ sung / chỉnh sửa ⚠️",
            message=f"Lãnh đạo {current_user.full_name} yêu cầu hoàn thiện đề xuất '{task.title}': {req.feedback}"
        )

    db.commit()
    db.refresh(task)
    return task

@router.post("/{task_id}/proposal/resubmit", response_model=TaskOut, summary="Cán bộ hoàn thiện & gửi lại đề xuất sau khi chỉnh sửa")
def resubmit_task_proposal(
    task_id: int,
    req: ProposalResubmitRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Không tìm thấy đề xuất.")

    if task.created_by_id != current_user.id and current_user.role not in [UserRole.SUPERADMIN, UserRole.BGH]:
        raise HTTPException(status_code=403, detail="Chỉ người khởi tạo đề xuất mới có quyền gửi lại.")

    # Đếm số thứ tự lần gửi lại
    resubmit_count = db.query(TaskActionLog).filter(
        TaskActionLog.task_id == task_id,
        TaskActionLog.action == "RESUBMIT_PROPOSAL"
    ).count()
    current_resubmit_number = resubmit_count + 1

    if req.title and req.title.strip():
        task.title = req.title.strip()
    if req.description is not None:
        task.description = req.description.strip()
    if req.priority:
        task.priority = req.priority
    if req.due_date:
        task.due_date = req.due_date

    task.status = TaskStatus.CHO_DUYET

    log_task_action(db, task.id, current_user.id, "RESUBMIT_PROPOSAL", {
        "title": task.title,
        "resubmit_times": current_resubmit_number,
        "resubmit_note": req.resubmit_note
    })

    comment = TaskComment(
        task_id=task_id,
        author_id=current_user.id,
        content=f"🔄 [TRÌNH DUYỆT LẠI ĐỀ XUẤT - LẦN {current_resubmit_number}] Cán bộ đã hoàn thiện nội dung và gửi lại đề xuất để Lãnh đạo xem xét.{f' Giải trình: {req.resubmit_note}' if req.resubmit_note else ''}"
    )
    db.add(comment)

    # Gửi thông báo đến Lãnh đạo phụ trách duyệt
    leader_users = db.query(User).filter(
        User.department_id == (task.leading_dept_id or current_user.department_id),
        User.role.in_([UserRole.DEPT_HEAD, UserRole.DEPT_VICE])
    ).all()
    for leader in leader_users:
        create_task_notification(
            db,
            user_id=leader.id,
            task_id=task.id,
            notif_type="PROPOSAL_RESUBMITTED",
            title=f"Đề xuất đã được gửi lại (Lần {current_resubmit_number}) 🔄",
            message=f"Cán bộ {current_user.full_name} đã cập nhật và gửi lại đề xuất: '{task.title}'"
        )

    db.commit()
    db.refresh(task)
    return task

# ----------------------------------------------------
# 9. TASK NOTIFICATION ENDPOINTS
# ----------------------------------------------------
@router.get("/notifications/list", response_model=TaskNotificationListOut, summary="Lấy danh sách thông báo điều hành của người dùng")
def get_user_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    limit: int = Query(25, ge=1, le=100)
) -> Any:
    query = db.query(TaskNotification).filter(TaskNotification.user_id == current_user.id)
    total = query.count()
    unread_count = query.filter(TaskNotification.is_read == False).count()
    items = query.order_by(TaskNotification.created_at.desc()).limit(limit).all()
    return {
        "total": total,
        "unread_count": unread_count,
        "items": items
    }

@router.put("/notifications/{notif_id}/read", summary="Đánh dấu một thông báo là đã đọc")
def mark_notification_read(
    notif_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    notif = db.query(TaskNotification).filter(
        TaskNotification.id == notif_id,
        TaskNotification.user_id == current_user.id
    ).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Không tìm thấy thông báo.")
    notif.is_read = True
    db.commit()
    return {"success": True, "id": notif_id}

@router.put("/notifications/read-all", summary="Đánh dấu tất cả thông báo của người dùng là đã đọc")
def mark_all_notifications_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    db.query(TaskNotification).filter(
        TaskNotification.user_id == current_user.id,
        TaskNotification.is_read == False
    ).update({"is_read": True})
    db.commit()
    return {"success": True, "message": "Đã đánh dấu đọc toàn bộ thông báo."}


