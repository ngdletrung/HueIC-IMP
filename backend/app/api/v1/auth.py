import time
import logging
from datetime import datetime, timedelta
from typing import Any, Dict
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.config import settings
from app.core.security import verify_password, create_access_token
from app.models.user import User
from app.schemas.auth import Token, LoginRequest
from app.schemas.user import UserOut
from app.api.deps import get_current_user

logger = logging.getLogger("hueic_imp.auth")
router = APIRouter()

# Bộ nhớ theo dõi số lần đăng nhập sai (In-memory Lockout Store)
# Cấu trúc: { "username_or_ip": { "attempts": int, "locked_until": float } }
FAILED_LOGINS: Dict[str, Dict[str, Any]] = {}

def check_login_lockout(key: str):
    """Kiểm tra xem tài khoản/IP có đang trong thời gian bị khóa tạm thời không."""
    record = FAILED_LOGINS.get(key)
    if not record:
        return
    now = time.time()
    locked_until = record.get("locked_until", 0)
    if now < locked_until:
        remaining_minutes = int((locked_until - now) / 60) + 1
        logger.warning(f"⛔ [LOCKOUT] Tài khoản '{key}' bị từ chối đăng nhập do đang trong thời gian khóa ({remaining_minutes} phút còn lại).")
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Tài khoản đã bị tạm khóa do nhập sai mật khẩu quá {settings.MAX_FAILED_LOGIN_ATTEMPTS} lần liên tiếp. Vui lòng thử lại sau {remaining_minutes} phút."
        )
    # Hết hạn khóa thì reset bộ đếm
    if now >= locked_until and locked_until > 0:
        FAILED_LOGINS.pop(key, None)

def record_failed_login(key: str):
    """Ghi nhận một lần đăng nhập sai và kích hoạt khóa nếu vượt ngưỡng."""
    now = time.time()
    record = FAILED_LOGINS.get(key, {"attempts": 0, "locked_until": 0})
    record["attempts"] += 1
    
    if record["attempts"] >= settings.MAX_FAILED_LOGIN_ATTEMPTS:
        record["locked_until"] = now + (settings.LOCKOUT_DURATION_MINUTES * 60)
        FAILED_LOGINS[key] = record
        logger.error(f"🚨 [BRUTE-FORCE ALERT] Tài khoản '{key}' đã bị khóa {settings.LOCKOUT_DURATION_MINUTES} phút vì nhập sai {record['attempts']} lần!")
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Bạn đã nhập sai mật khẩu {record['attempts']} lần. Tài khoản bị tạm khóa trong {settings.LOCKOUT_DURATION_MINUTES} phút để bảo vệ an toàn."
        )
    else:
        FAILED_LOGINS[key] = record
        remaining = settings.MAX_FAILED_LOGIN_ATTEMPTS - record["attempts"]
        logger.warning(f"⚠️ [AUTH FAIL] Đăng nhập thất bại cho '{key}'. Còn lại {remaining} lần thử trước khi bị khóa.")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Tên đăng nhập hoặc mật khẩu không chính xác. (Còn lại {remaining} lần thử)"
        )

def reset_failed_login(key: str):
    """Xóa lịch sử sai khi đăng nhập thành công."""
    FAILED_LOGINS.pop(key, None)

@router.post("/login", response_model=Token, summary="Đăng nhập tài khoản")
def login_access_token(
    db: Session = Depends(get_db),
    form_data: OAuth2PasswordRequestForm = Depends()
) -> Any:
    """
    Xác thực tài khoản và trả về JWT Bearer Token (Tương thích Swagger UI và Form Data).
    """
    login_key = form_data.username.lower().strip()
    check_login_lockout(login_key)

    user = db.query(User).filter(
        (User.username == form_data.username) | (User.email == form_data.username)
    ).first()
    
    if not user or not verify_password(form_data.password, user.hashed_password):
        record_failed_login(login_key)
        
    if not user.is_active:
        logger.warning(f"⚠️ [AUTH INACTIVE] Tài khoản '{user.username}' không hoạt động cố gắng đăng nhập.")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tài khoản đã bị vô hiệu hóa hoặc tạm ngưng."
        )
    
    # Đăng nhập thành công -> Reset bộ đếm vi phạm
    reset_failed_login(login_key)
    logger.info(f"✅ [AUTH SUCCESS] Người dùng '{user.username}' ({user.full_name}) đăng nhập thành công.")

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
    login_key = login_data.username.lower().strip()
    check_login_lockout(login_key)

    user = db.query(User).filter(
        (User.username == login_data.username) | (User.email == login_data.username)
    ).first()
    
    if not user or not verify_password(login_data.password, user.hashed_password):
        record_failed_login(login_key)
        
    if not user.is_active:
        logger.warning(f"⚠️ [AUTH INACTIVE] Tài khoản '{user.username}' không hoạt động cố gắng đăng nhập.")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tài khoản đã bị vô hiệu hóa hoặc tạm ngưng."
        )
    
    # Đăng nhập thành công -> Reset bộ đếm vi phạm
    reset_failed_login(login_key)
    logger.info(f"✅ [AUTH SUCCESS] Người dùng '{user.username}' ({user.full_name}) đăng nhập JSON thành công.")

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

@router.get("/me", response_model=UserOut, summary="Lấy thông tin người dùng hiện tại")
def read_user_me(
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    Trả về thông tin chi tiết của người dùng đang đăng nhập dựa trên JWT token.
    """
    return current_user
