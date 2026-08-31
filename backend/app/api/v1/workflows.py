from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from typing import Any, List, Optional

from app.db.session import get_db
from app.models.workflow import WorkflowTemplate
from app.models.user import User
from app.schemas.workflow import WorkflowTemplateCreate, WorkflowTemplateUpdate, WorkflowTemplateOut
from app.api.v1.auth import get_current_user

router = APIRouter()

@router.get("", response_model=List[WorkflowTemplateOut], summary="Danh sách quy trình mẫu")
def get_workflows(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    dept_id: Optional[int] = Query(None, description="Lọc theo phòng ban"),
    include_global: bool = Query(True, description="Kèm theo quy trình toàn trường"),
    search: Optional[str] = Query(None, description="Tìm kiếm tên/mã quy trình")
) -> Any:
    query = db.query(WorkflowTemplate).options(joinedload(WorkflowTemplate.department)).filter(WorkflowTemplate.is_active == True)

    if dept_id is not None:
        if include_global:
            query = query.filter((WorkflowTemplate.department_id == dept_id) | (WorkflowTemplate.department_id == None))
        else:
            query = query.filter(WorkflowTemplate.department_id == dept_id)
    
    if search:
        query = query.filter(WorkflowTemplate.name.ilike(f"%{search}%") | WorkflowTemplate.code.ilike(f"%{search}%"))

    return query.order_by(WorkflowTemplate.department_id.asc().nullsfirst(), WorkflowTemplate.code.asc()).all()

@router.get("/{workflow_id}", response_model=WorkflowTemplateOut, summary="Chi tiết quy trình mẫu")
def get_workflow(
    workflow_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    wf = db.query(WorkflowTemplate).options(joinedload(WorkflowTemplate.department)).filter(WorkflowTemplate.id == workflow_id).first()
    if not wf:
        raise HTTPException(status_code=404, detail="Không tìm thấy quy trình mẫu.")
    return wf

@router.post("", response_model=WorkflowTemplateOut, summary="Tạo mới quy trình mẫu")
def create_workflow(
    wf_in: WorkflowTemplateCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    # Kiểm tra mã trùng lặp
    existing = db.query(WorkflowTemplate).filter(WorkflowTemplate.code == wf_in.code.upper().strip()).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Mã quy trình '{wf_in.code}' đã tồn tại.")

    data = wf_in.model_dump()
    data["code"] = data["code"].upper().strip()
    
    wf = WorkflowTemplate(**data)
    db.add(wf)
    db.commit()
    db.refresh(wf)
    return wf

@router.put("/{workflow_id}", response_model=WorkflowTemplateOut, summary="Cập nhật quy trình mẫu")
def update_workflow(
    workflow_id: int,
    wf_in: WorkflowTemplateUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    wf = db.query(WorkflowTemplate).filter(WorkflowTemplate.id == workflow_id).first()
    if not wf:
        raise HTTPException(status_code=404, detail="Không tìm thấy quy trình mẫu.")

    update_data = wf_in.model_dump(exclude_unset=True)
    if "code" in update_data and update_data["code"]:
        update_data["code"] = update_data["code"].upper().strip()
        existing = db.query(WorkflowTemplate).filter(WorkflowTemplate.code == update_data["code"], WorkflowTemplate.id != workflow_id).first()
        if existing:
            raise HTTPException(status_code=400, detail=f"Mã quy trình '{update_data['code']}' đã tồn tại.")

    for field, value in update_data.items():
        setattr(wf, field, value)

    db.commit()
    db.refresh(wf)
    return wf

@router.delete("/{workflow_id}", summary="Xóa quy trình mẫu")
def delete_workflow(
    workflow_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    wf = db.query(WorkflowTemplate).filter(WorkflowTemplate.id == workflow_id).first()
    if not wf:
        raise HTTPException(status_code=404, detail="Không tìm thấy quy trình mẫu.")

    db.delete(wf)
    db.commit()
    return {"message": "Đã xóa quy trình mẫu thành công."}
