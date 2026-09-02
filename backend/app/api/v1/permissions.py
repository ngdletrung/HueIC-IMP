from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Dict, Any

from app.db.session import get_db
from app.models.user import User, UserRole
from app.schemas.user import UserOut, UserPermissionsUpdate
from app.core.permissions import SYSTEM_PERMISSIONS_CATALOG, ROLE_PRESET_PERMISSIONS, get_default_permissions_for_role
from app.api.deps import get_current_user, require_permission

router = APIRouter()

@router.get("/catalog", summary="Danh mục các mã quyền của hệ thống")
def get_permissions_catalog(
    current_user: User = Depends(get_current_user)
) -> List[Dict[str, Any]]:
    """Trả về cấu trúc cây 4 nhóm quyền phục vụ hiển thị Checkbox trên giao diện"""
    return SYSTEM_PERMISSIONS_CATALOG

@router.get("/presets", summary="Danh mục các bộ quyền mẫu chuẩn theo Chức danh")
def get_permission_presets(
    current_user: User = Depends(get_current_user)
) -> Dict[str, List[str]]:
    """Trả về các bộ quyền mẫu cho BGH, Trưởng đơn vị, Phó đơn vị, Cán bộ"""
    return ROLE_PRESET_PERMISSIONS

@router.get("/users/{user_id}", summary="Lấy danh sách mã quyền của một người dùng")
def get_user_permissions(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> Dict[str, Any]:
    # Kiểm tra quyền: Chỉ xem quyền của chính mình hoặc người có quyền perm:manage / BGH
    can_view = (
        current_user.id == user_id or
        current_user.role in [UserRole.SUPERADMIN, UserRole.BGH] or
        (current_user.permissions and "perm:manage" in current_user.permissions)
    )
    if not can_view:
        raise HTTPException(status_code=403, detail="Bạn không có quyền xem cấu hình phân quyền của người dùng khác.")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy người dùng.")
    
    # Nếu chưa có permissions thì lấy mặc định theo role
    current_perms = user.permissions or get_default_permissions_for_role(user.role)
    
    return {
        "user_id": user.id,
        "username": user.username,
        "full_name": user.full_name,
        "role": user.role,
        "permissions": current_perms
    }

@router.put("/users/{user_id}", response_model=UserOut, summary="Cập nhật quyền chi tiết cho người dùng")
def update_user_permissions(
    user_id: int,
    perms_in: UserPermissionsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("perm:manage"))
) -> Any:
    """Chỉ Ban Giám Hiệu hoặc người có quyền perm:manage mới được sửa quyền"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy người dùng.")
    
    # Không cho phép hạ quyền của chính SuperAdmin gốc nếu đang đăng nhập
    if user.role == UserRole.SUPERADMIN and user.username == "admin" and current_user.id != user.id:
        raise HTTPException(status_code=400, detail="Không thể thay đổi quyền của tài khoản SuperAdmin hệ thống.")

    user.permissions = perms_in.permissions
    db.commit()
    db.refresh(user)
    return user

@router.post("/users/{user_id}/reset-default", response_model=UserOut, summary="Khôi phục quyền mặc định theo vai trò")
def reset_user_permissions_to_default(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("perm:manage"))
) -> Any:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy người dùng.")

    user.permissions = get_default_permissions_for_role(user.role)
    db.commit()
    db.refresh(user)
    return user

@router.put("/presets/{role_key}", summary="Cập nhật mẫu quyền gốc chuẩn cho Vai trò")
def update_role_preset(
    role_key: str,
    perms_in: UserPermissionsUpdate,
    current_user: User = Depends(require_permission("perm:manage"))
) -> Any:
    """Cho phép SuperAdmin cập nhật bộ quyền gốc chuẩn của từng Role"""
    key = role_key.lower().strip()
    if key not in ROLE_PRESET_PERMISSIONS:
        raise HTTPException(status_code=400, detail=f"Vai trò '{role_key}' không hợp lệ. Các vai trò hợp lệ: admin, bgh, dept_head, dept_vice, staff")
    
    ROLE_PRESET_PERMISSIONS[key] = perms_in.permissions
    return {
        "role_key": key,
        "permissions": ROLE_PRESET_PERMISSIONS[key],
        "message": f"Đã cập nhật bộ quyền gốc chuẩn cho vai trò {key} thành công!"
    }
