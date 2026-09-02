from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from typing import List, Optional, Any
from datetime import datetime, timezone

from app.db.session import get_db
from app.models.user import User, UserRole
from app.models.task import Task, TaskStatus
from app.models.kpi import KpiFormulaVersion, WorkloadSnapshot, RequestExtension, KpiLog
from app.api.deps import get_current_user
from app.kpi_engine import BaseScorer, ParentScorer, WorkloadEngine, GovernanceEngine, PeriodKpiEngine
from pydantic import BaseModel

router = APIRouter()

# ----------------------------------------------------
# Pydantic Schemas
# ----------------------------------------------------
class ExtensionCreateSchema(BaseModel):
    task_id: int
    requested_new_deadline: datetime
    reason: str

class ExtensionResolveSchema(BaseModel):
    status: str # APPROVED / REJECTED
    note: Optional[str] = None


# ----------------------------------------------------
# API ENDPOINTS
# ----------------------------------------------------
@router.get("/personal")
def get_personal_kpi(
    user_id: Optional[int] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    Lấy KPI cá nhân theo kỳ.
    - STAFF: Chỉ xem được chính mình.
    - DEPT_HEAD / BGH: Có thể xem được cán bộ khác.
    """
    target_id = user_id or current_user.id
    if target_id != current_user.id and current_user.role == UserRole.STAFF:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Không có quyền xem KPI của cán bộ khác")

    return PeriodKpiEngine.calculate_individual_kpi(target_id, start_date, end_date, db)


@router.get("/department")
def get_my_department_kpi(
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    Lấy KPI Đơn vị của chính user hiện tại.
    """
    if not current_user.department_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Tài khoản chưa được gán đơn vị")
    return PeriodKpiEngine.calculate_department_kpi(current_user.department_id, start_date, end_date, db)


@router.get("/department/{dept_id}")
def get_department_kpi(
    dept_id: int,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    Lấy KPI Đơn vị (70% Thực thi + 30% Điều phối).
    - STAFF / Lãnh đạo đơn vị khác: Bị chặn nếu không thuộc đơn vị đó.
    - BGH / SUPERADMIN / Trưởng đơn vị: Được xem.
    """
    if current_user.role not in [UserRole.SUPERADMIN, UserRole.BGH]:
        if current_user.department_id != dept_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Không có quyền xem KPI đơn vị khác")

    return PeriodKpiEngine.calculate_department_kpi(dept_id, start_date, end_date, db)


@router.get("/spi")
def get_school_spi(
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    Lấy Chỉ số Hiệu suất Toàn trường (School Performance Index - SPI) cho BGH & Toàn trường.
    """
    return PeriodKpiEngine.calculate_school_spi(start_date, end_date, db)


@router.get("/formula-version")
def get_formula_version(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    Lấy thông tin phiên bản công thức KPI đang áp dụng.
    """
    return BaseScorer.get_active_formula_version(db)


# ----------------------------------------------------
# QUY TRÌNH GIA HẠN DEADLINE (REQUEST EXTENSION)
# ----------------------------------------------------
@router.post("/extensions")
def request_deadline_extension(
    data: ExtensionCreateSchema,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    Gửi phiếu xin gia hạn deadline.
    Chỉ người được giao việc (Assignee) hoặc Người tạo mới được gửi phiếu.
    """
    task = db.query(Task).filter(Task.id == data.task_id).first()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy nhiệm vụ")

    if task.assignee_id != current_user.id and task.created_by_id != current_user.id and current_user.role not in [UserRole.SUPERADMIN, UserRole.BGH]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Chỉ người phụ trách nhiệm vụ mới được xin gia hạn")

    ext = RequestExtension(
        task_id=task.id,
        requested_by_id=current_user.id,
        original_deadline=task.effective_deadline or task.due_date,
        requested_new_deadline=data.requested_new_deadline,
        reason=data.reason,
        status="PENDING",
        created_at=datetime.now(timezone.utc)
    )
    db.add(ext)
    db.commit()
    db.refresh(ext)
    return {"message": "Đã gửi phiếu xin gia hạn deadline thành công", "extension_id": ext.id}


@router.get("/extensions")
def get_extension_requests(
    task_id: Optional[int] = None,
    status_filter: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    Danh sách các phiếu xin gia hạn deadline.
    """
    query = db.query(RequestExtension)
    if task_id:
        query = query.filter(RequestExtension.task_id == task_id)
    if status_filter:
        query = query.filter(RequestExtension.status == status_filter)

    # Phân quyền: STAFF chỉ xem phiếu của mình; Lãnh đạo xem trong đơn vị; BGH xem toàn trường
    if current_user.role == UserRole.STAFF:
        query = query.filter(RequestExtension.requested_by_id == current_user.id)
    elif current_user.role in [UserRole.DEPT_HEAD, UserRole.DEPT_VICE]:
        query = query.join(Task, RequestExtension.task_id == Task.id).filter(Task.leading_dept_id == current_user.department_id)

    extensions = query.order_by(RequestExtension.created_at.desc()).all()
    results = []
    for e in extensions:
        results.append({
            "id": e.id,
            "task_id": e.task_id,
            "task_title": e.task.title if e.task else "",
            "requested_by": e.requested_by.full_name if e.requested_by else "",
            "original_deadline": e.original_deadline.isoformat() if e.original_deadline else None,
            "requested_new_deadline": e.requested_new_deadline.isoformat() if e.requested_new_deadline else None,
            "reason": e.reason,
            "status": e.status,
            "note": e.note,
            "approved_by": e.approved_by.full_name if e.approved_by else None,
            "created_at": e.created_at.isoformat() if e.created_at else None
        })
    return results


@router.put("/extensions/{ext_id}/resolve")
def resolve_deadline_extension(
    ext_id: int,
    data: ExtensionResolveSchema,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    Phê duyệt hoặc từ chối phiếu gia hạn deadline.
    - Bắt buộc vai trò Lãnh đạo đơn vị hoặc BGH.
    """
    ext = db.query(RequestExtension).filter(RequestExtension.id == ext_id).first()
    if not ext:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy phiếu gia hạn")

    task = ext.task
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Không tìm thấy nhiệm vụ liên quan")

    # Kiểm tra quyền duyệt
    if current_user.role not in [UserRole.SUPERADMIN, UserRole.BGH]:
        if current_user.role in [UserRole.DEPT_HEAD, UserRole.DEPT_VICE]:
            if task.leading_dept_id != current_user.department_id:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Không có thẩm quyền duyệt phiếu của đơn vị khác")
        else:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cán bộ nhân viên không có thẩm quyền duyệt gia hạn")

    ext.status = data.status
    ext.note = data.note
    ext.approved_by_id = current_user.id
    ext.approved_at = datetime.now(timezone.utc)

    # Nếu được DUYET -> Cập nhật effective_deadline của Task
    if data.status == "APPROVED":
        task.effective_deadline = ext.requested_new_deadline
        task.extension_count = (task.extension_count or 0) + 1

    db.commit()
    return {"message": "Xử lý phiếu gia hạn thành công", "status": data.status}


@router.get("/audit-logs", summary="Tra cứu lịch sử vết tính điểm KPI (Audit Logs)")
def get_kpi_audit_logs(
    user_id: Optional[int] = Query(None, description="Lọc theo user_id"),
    dept_id: Optional[int] = Query(None, description="Lọc theo dept_id"),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    Tra cứu vết tính điểm minh bạch 100% từ bảng kpi_logs:
    Bao gồm công thức, bằng chứng, thời điểm chốt và trạng thái.
    """
    from app.models.kpi import KpiLog

    query = db.query(KpiLog)
    if user_id:
        query = query.filter(KpiLog.user_id == user_id)
    elif current_user.role == UserRole.STAFF:
        query = query.filter(KpiLog.user_id == current_user.id)
    elif dept_id:
        query = query.filter(KpiLog.department_id == dept_id)
    elif current_user.role in [UserRole.DEPT_HEAD, UserRole.DEPT_VICE]:
        query = query.filter((KpiLog.department_id == current_user.department_id) | (KpiLog.user_id == current_user.id))

    logs = query.order_by(KpiLog.created_at.desc()).limit(limit).all()
    results = []
    for l in logs:
        results.append({
            "id": l.id,
            "period": l.period,
            "user_name": l.user.full_name if l.user else "Đơn vị",
            "department_code": l.department.code if l.department else "",
            "score_type": l.score_type,
            "score_value": float(l.score_value) if l.score_value else 0.0,
            "formula_version": l.formula_version.version if l.formula_version else "v1.0",
            "evidence": l.evidence,
            "is_final": l.is_final,
            "created_at": l.created_at.isoformat() if l.created_at else None
        })
    return results
