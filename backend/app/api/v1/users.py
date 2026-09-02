from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional, Any

from app.db.session import get_db
from app.core.security import get_password_hash
from app.models.user import User, UserRole
from app.models.task import Task
from app.schemas.user import UserCreate, UserUpdate, UserOut
from app.api.deps import get_current_user, require_roles

router = APIRouter()

@router.get("", response_model=List[UserOut], summary="Danh sách tài khoản cán bộ/giảng viên")
def get_users(
    db: Session = Depends(get_db),
    department_id: Optional[int] = None,
    role: Optional[UserRole] = None,
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_user)
) -> Any:
    query = db.query(User)
    if department_id:
        query = query.filter(User.department_id == department_id)
    if role:
        query = query.filter(User.role == role)
    return query.offset(skip).limit(limit).all()

@router.post("", response_model=UserOut, summary="Tạo mới tài khoản người dùng")
def create_user(
    user_in: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.SUPERADMIN, UserRole.BGH, UserRole.DEPT_HEAD]))
) -> Any:
    existing_username = db.query(User).filter(User.username == user_in.username).first()
    if existing_username:
        raise HTTPException(status_code=400, detail="Tên đăng nhập đã tồn tại.")
    
    existing_email = db.query(User).filter(User.email == user_in.email).first()
    if existing_email:
        raise HTTPException(status_code=400, detail="Email này đã được sử dụng.")
    
    user_data = user_in.model_dump()
    password = user_data.pop("password")
    user_data["hashed_password"] = get_password_hash(password)
    
    user = User(**user_data)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

@router.get("/{user_id}", response_model=UserOut, summary="Chi tiết tài khoản")
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy tài khoản người dùng.")
    return user

@router.put("/{user_id}", response_model=UserOut, summary="Cập nhật tài khoản")
def update_user(
    user_id: int,
    user_in: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Any:
    # Chỉ SuperAdmin hoặc chính người dùng mới được cập nhật tài khoản của mình
    if current_user.role != UserRole.SUPERADMIN and current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Bạn không có quyền sửa thông tin người dùng này.")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy tài khoản người dùng.")

    update_data = user_in.model_dump(exclude_unset=True)
    if "password" in update_data and update_data["password"]:
        update_data["hashed_password"] = get_password_hash(update_data.pop("password"))

    for field, value in update_data.items():
        setattr(user, field, value)

    db.commit()
    db.refresh(user)
    return user

@router.delete("/{user_id}", summary="Xóa tài khoản người dùng")
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.SUPERADMIN]))
) -> Any:
    if current_user.id == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Không thể xóa chính tài khoản bạn đang đăng nhập."
        )

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy tài khoản người dùng.")

    # Tự động gỡ liên kết công việc được giao/chủ trì để đảm bảo toàn vẹn dữ liệu
    db.query(Task).filter(Task.assignee_id == user_id).update({"assignee_id": None})
    db.query(Task).filter(Task.created_by_id == user_id).update({"created_by_id": None})
    
    db.delete(user)
    db.commit()
    return {"message": f"Đã xóa tài khoản '{user.username}' ({user.full_name}) thành công."}
