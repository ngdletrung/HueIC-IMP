from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Any

from app.db.session import get_db
from app.models.department import Department
from app.models.user import User, UserRole
from app.schemas.department import DepartmentCreate, DepartmentUpdate, DepartmentOut
from app.api.deps import get_current_user, require_roles

router = APIRouter()

@router.get("", response_model=List[DepartmentOut], summary="Danh sách các phòng ban/đơn vị")
def get_departments(
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_user)
) -> Any:
    return db.query(Department).offset(skip).limit(limit).all()

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
            detail=f"Mã phòng ban '{dept_in.code}' đã tồn tại trong hệ thống."
        )
    dept = Department(**dept_in.model_dump())
    db.add(dept)
    db.commit()
    db.refresh(dept)
    return dept

@router.get("/{dept_id}", response_model=DepartmentOut, summary="Chi tiết phòng ban")
def get_department(
    dept_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    dept = db.query(Department).filter(Department.id == dept_id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Không tìm thấy phòng ban.")
    return dept

@router.put("/{dept_id}", response_model=DepartmentOut, summary="Cập nhật thông tin phòng ban")
def update_department(
    dept_id: int,
    dept_in: DepartmentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.SUPERADMIN]))
) -> Any:
    dept = db.query(Department).filter(Department.id == dept_id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Không tìm thấy phòng ban.")
    
    update_data = dept_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(dept, field, value)
        
    db.commit()
    db.refresh(dept)
    return dept

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
