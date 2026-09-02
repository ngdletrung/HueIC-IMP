from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Any, Optional

from app.db.session import get_db
from app.models.department import Department
from app.models.user import User, UserRole
from app.schemas.department import DepartmentCreate, DepartmentUpdate, DepartmentOut
from app.api.deps import get_current_user, require_roles

router = APIRouter()

def compute_department_path(db: Session, code: str, parent_id: Optional[int]) -> str:
    """Tự động tính toán Materialized Path cho đơn vị: /BGH, /CNTT/BM_PM, ..."""
    if not parent_id:
        return f"/{code}"
    parent = db.query(Department).filter(Department.id == parent_id).first()
    if parent:
        parent_path = parent.path or f"/{parent.code}"
        return f"{parent_path}/{code}"
    return f"/{code}"

@router.get("", response_model=List[DepartmentOut], summary="Danh sách các phòng ban/đơn vị")
def get_departments(
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 200,
    current_user: User = Depends(get_current_user)
) -> Any:
    # Sắp xếp đơn vị cấp 1 trước, sau đó đến thứ tự order_index
    departments = db.query(Department).order_by(
        Department.parent_id.asc().nulls_first(),
        Department.order_index.asc(),
        Department.id.asc()
    ).offset(skip).limit(limit).all()

    result = []
    for d in departments:
        out = DepartmentOut.model_validate(d)
        if d.parent:
            out.parent_code = d.parent.code
            out.parent_name = d.parent.name
        result.append(out)
    return result

@router.post("", response_model=DepartmentOut, summary="Thêm mới phòng ban/đơn vị")
def create_department(
    dept_in: DepartmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.SUPERADMIN]))
) -> Any:
    existing = db.query(Department).filter(Department.code == dept_in.code).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Mã đơn vị '{dept_in.code}' đã tồn tại trong hệ thống."
        )
    
    # Kiểm tra parent_id nếu có
    if dept_in.parent_id:
        parent = db.query(Department).filter(Department.id == dept_in.parent_id).first()
        if not parent:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Không tìm thấy đơn vị cấp trên (ID: {dept_in.parent_id})."
            )

    dept_data = dept_in.model_dump()
    if not dept_data.get("path"):
        dept_data["path"] = compute_department_path(db, dept_in.code, dept_in.parent_id)

    dept = Department(**dept_data)
    db.add(dept)
    db.commit()
    db.refresh(dept)

    out = DepartmentOut.model_validate(dept)
    if dept.parent:
        out.parent_code = dept.parent.code
        out.parent_name = dept.parent.name
    return out

@router.get("/{dept_id}", response_model=DepartmentOut, summary="Chi tiết phòng ban")
def get_department(
    dept_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    dept = db.query(Department).filter(Department.id == dept_id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Không tìm thấy đơn vị.")
    
    out = DepartmentOut.model_validate(dept)
    if dept.parent:
        out.parent_code = dept.parent.code
        out.parent_name = dept.parent.name
    return out

@router.put("/{dept_id}", response_model=DepartmentOut, summary="Cập nhật thông tin phòng ban")
def update_department(
    dept_id: int,
    dept_in: DepartmentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.SUPERADMIN]))
) -> Any:
    dept = db.query(Department).filter(Department.id == dept_id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Không tìm thấy đơn vị.")
    
    update_data = dept_in.model_dump(exclude_unset=True)
    
    # 1. Kiểm tra trùng lặp mã code nếu có thay đổi
    if "code" in update_data and update_data["code"] != dept.code:
        duplicate = db.query(Department).filter(
            Department.code == update_data["code"],
            Department.id != dept.id
        ).first()
        if duplicate:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Mã đơn vị '{update_data['code']}' đã được sử dụng bởi đơn vị khác."
            )

    # 2. Kiểm tra quan hệ vòng (Circular dependency) nếu đổi parent_id
    if "parent_id" in update_data:
        new_parent_id = update_data["parent_id"]
        if new_parent_id == dept.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Đơn vị không thể trực thuộc chính nó."
            )
        if new_parent_id is not None:
            target_parent = db.query(Department).filter(Department.id == new_parent_id).first()
            if not target_parent:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Không tìm thấy đơn vị cấp trên (ID: {new_parent_id})."
                )
            # Kiểm tra xem target_parent có phải là con/cháu của dept hiện tại hay không
            curr_path = dept.path or f"/{dept.code}"
            if target_parent.path and target_parent.path.startswith(f"{curr_path}/"):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Không thể chọn đơn vị trực thuộc cấp dưới làm đơn vị cấp trên (vi phạm quan hệ phân cấp cây)."
                )

    old_path = dept.path or f"/{dept.code}"

    for field, value in update_data.items():
        setattr(dept, field, value)
    
    # 3. Tự động tính toán lại path mới
    new_path = compute_department_path(db, dept.code, dept.parent_id)
    dept.path = new_path
        
    # 4. Cascade cập nhật path cho toàn bộ các đơn vị con cháu nếu path bị đổi
    if old_path != new_path:
        descendants = db.query(Department).filter(Department.path.like(f"{old_path}/%")).all()
        for desc in descendants:
            if desc.path:
                desc.path = new_path + desc.path[len(old_path):]

    db.commit()
    db.refresh(dept)

    out = DepartmentOut.model_validate(dept)
    if dept.parent:
        out.parent_code = dept.parent.code
        out.parent_name = dept.parent.name
    return out

@router.delete("/{dept_id}", summary="Xóa phòng ban/đơn vị")
def delete_department(
    dept_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.SUPERADMIN]))
) -> Any:
    dept = db.query(Department).filter(Department.id == dept_id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Không tìm thấy phòng ban.")
    
    # Kiểm tra xem có người dùng trong phòng ban không
    user_count = db.query(User).filter(User.department_id == dept_id).count()
    if user_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Không thể xóa đơn vị '{dept.name}' vì đang có {user_count} cán bộ trực thuộc. Vui lòng chuyển cán bộ sang đơn vị khác trước."
        )

    db.delete(dept)
    db.commit()
    return {"message": f"Đã xóa đơn vị '{dept.name}' ({dept.code}) thành công."}
