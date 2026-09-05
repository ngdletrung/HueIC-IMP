import time
import uuid
import logging
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.core.config import settings
from app.core.logging_config import setup_logging
from app.db.session import SessionLocal
from app.db.init_db import init_db
from app.api.v1 import auth, departments, users, tasks, stats, permissions, workflows, database, kpi, dashboard, system_settings

# Khởi tạo logging tập trung
logger = setup_logging()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Kiểm tra cảnh báo bảo mật SECRET_KEY
    if "change_in_production" in settings.SECRET_KEY or "super_secret" in settings.SECRET_KEY:
        logger.warning("🚨 [SECURITY WARNING] Bạn đang sử dụng SECRET_KEY mặc định! Hãy tạo SECRET_KEY ngẫu nhiên mới trong file .env trước khi đưa vào môi trường Production.")

    # Khởi tạo DB & Dữ liệu mẫu khi Server khởi động
    db = SessionLocal()
    try:
        init_db(db)
        logger.info("✅ [HueIC IMP] Cơ sở dữ liệu và dữ liệu khởi tạo đã sẵn sàng!")
    except Exception as e:
        logger.error(f"⚠️ [HueIC IMP] Lỗi khởi tạo DB: {e}", exc_info=True)
    finally:
        db.close()
    yield

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Hệ thống Cổng Quản lý và Điều hành Nội bộ - Trường Cao đẳng Công nghiệp Huế (HueIC)",
    version="2.9.29",
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# Cấu hình CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global Exception Handler (Che giấu thông tin nhạy cảm, log stack trace an toàn)
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    error_id = str(uuid.uuid4())[:8]
    logger.error(f"❌ [Unhandled Error ID: {error_id}] Request: {request.method} {request.url.path} - Exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "detail": "Đã xảy ra lỗi nội bộ máy chủ. Vui lòng liên hệ Quản trị viên hệ thống để được hỗ trợ.",
            "error_code": f"ERR_{error_id}"
        }
    )

# Đăng ký các Router API
app.include_router(auth.router, prefix=f"{settings.API_V1_STR}/auth", tags=["Xác thực & Tài khoản"])
app.include_router(departments.router, prefix=f"{settings.API_V1_STR}/departments", tags=["Phòng ban & Đơn vị"])
app.include_router(users.router, prefix=f"{settings.API_V1_STR}/users", tags=["Cán bộ & Giảng viên"])
app.include_router(tasks.router, prefix=f"{settings.API_V1_STR}/tasks", tags=["Quản lý & Phân công Công việc"])
app.include_router(workflows.router, prefix=f"{settings.API_V1_STR}/workflows", tags=["Danh Mục Quy Trình Mẫu (Workflows)"])
app.include_router(stats.router, prefix=f"{settings.API_V1_STR}/stats", tags=["Báo cáo & Thống kê"])
app.include_router(permissions.router, prefix=f"{settings.API_V1_STR}/permissions", tags=["Phân Quyền Chi Tiết (RBAC)"])
app.include_router(kpi.router, prefix=f"{settings.API_V1_STR}/kpi", tags=["Đo Lường Hiệu Suất & KPI (KpiEngine)"])
app.include_router(dashboard.router, prefix=f"{settings.API_V1_STR}/dashboard", tags=["BGH Executive Dashboard"])
app.include_router(system_settings.router, prefix=f"{settings.API_V1_STR}/settings", tags=["Cấu Hình Hệ Thống & Lịch Làm Việc"])
app.include_router(database.router, prefix=f"{settings.API_V1_STR}/database", tags=["Quản Trị Cơ Sở Dữ Liệu (Database Studio)"])

@app.get("/health", tags=["Hệ thống"])
def health_check():
    return {
        "status": "healthy",
        "timestamp": time.time(),
        "portal": "HueIC Internal Management Portal",
        "version": "2.4.2"
    }

