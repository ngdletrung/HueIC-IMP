from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta
from typing import Any

from app.db.session import get_db
from app.core.config import settings
from app.core.security import verify_password, create_access_token
from app.models.user import User
from app.schemas.auth import Token, LoginRequest
from app.schemas.user import UserOut
from app.api.deps import get_current_user

router = APIRouter()

@router.post("/login", response_model=Token, summary="Đăng nhập tài khoản")
def login_access_token(
    db: Session = Depends(get_db),
    form_data: OAuth2PasswordRequestForm = Depends()
) -> Any:
    """
    Xác thực tài khoản và trả về JWT Bearer Token (Tương thích Swagger UI và Form Data).
    """
    user = db.query(User).filter(
        (User.username == form_data.username) | (User.email == form_data.username)
    ).first()
    
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tên đăng nhập hoặc mật khẩu không chính xác."
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tài khoản đã bị tạm khóa."
        )
    
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    token = create_access_token(
        subject=user.username, expires_delta=access_token_expires
    )
    
    dept_name = user.department.name if user.department else "Toàn trường / Chưa gán"
    
    return {
        "access_token": token,
        "token_type": "bearer",
        "user_id": user.id,
        "username": user.username,
        "full_name": user.full_name,
        "role": user.role,
        "department_id": user.department_id,
        "department_name": dept_name
    }

@router.post("/login/json", response_model=Token, summary="Đăng nhập tài khoản qua JSON")
def login_json(
    login_data: LoginRequest,
    db: Session = Depends(get_db)
) -> Any:
    """
    Đăng nhập bằng JSON body dành cho ứng dụng Frontend Web.
    """
    user = db.query(User).filter(
        (User.username == login_data.username) | (User.email == login_data.username)
    ).first()
    
    if not user or not verify_password(login_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tên đăng nhập hoặc mật khẩu không chính xác."
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tài khoản đã bị tạm khóa."
        )
    
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    token = create_access_token(
        subject=user.username, expires_delta=access_token_expires
    )
    
    dept_name = user.department.name if user.department else "Toàn trường / Chưa gán"
    
    return {
        "access_token": token,
        "token_type": "bearer",
        "user_id": user.id,
        "username": user.username,
        "full_name": user.full_name,
        "role": user.role,
        "department_id": user.department_id,
        "department_name": dept_name
    }

@router.get("/me", response_model=UserOut, summary="Lấy thông tin tài khoản hiện tại")
def get_me(
    current_user: User = Depends(get_current_user)
) -> Any:
    return current_user
