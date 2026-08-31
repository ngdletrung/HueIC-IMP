from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from sqlalchemy.orm import Session
from typing import Generator, List

from app.core.config import settings
from app.db.session import get_db
from app.models.user import User, UserRole
from app.schemas.auth import TokenPayload

reusable_oauth2 = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_V1_STR}/auth/login"
)

def get_current_user(
    db: Session = Depends(get_db),
    token: str = Depends(reusable_oauth2)
) -> User:
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
        token_data = TokenPayload(**payload)
    except (JWTError, Exception):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Phiên làm việc không hợp lệ hoặc đã hết hạn.",
        )
    user = db.query(User).filter(User.username == token_data.sub).first()
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy người dùng.")
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Tài khoản này đã bị khóa.")
    return user

def require_roles(allowed_roles: List[UserRole]):
    def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles and current_user.role != UserRole.SUPERADMIN:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Bạn không có quyền thực hiện thao tác này."
            )
        return current_user
    return role_checker

def require_permission(perm_code: str):
    def perm_checker(current_user: User = Depends(get_current_user)) -> User:
        # SuperAdmin luôn có toàn quyền
        if current_user.role == UserRole.SUPERADMIN:
            return current_user
        user_perms = current_user.permissions or []
        if "*" in user_perms or perm_code in user_perms:
            return current_user
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Tài khoản của bạn chưa được cấp quyền '{perm_code}' để thực hiện thao tác này."
        )
    return perm_checker
