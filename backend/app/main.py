from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import time

from app.core.config import settings
from app.db.session import SessionLocal
from app.db.init_db import init_db
from app.api.v1 import auth, departments, users, tasks, stats, permissions, workflows

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Khởi tạo DB & Dữ liệu mẫu khi Server khởi động
    db = SessionLocal()
    try:
        init_db(db)
        print("✅ [HueIC IMP] Cơ sở dữ liệu và dữ liệu khởi tạo đã sẵn sàng!")
    except Exception as e:
        print(f"⚠️ [HueIC IMP] Lỗi khởi tạo DB: {e}")
    finally:
        db.close()
    yield

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Hệ thống Cổng Quản lý và Điều hành Nội bộ - Trường Cao đẳng Công nghiệp Huế (HueIC)",
    version="1.0.0",
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

# Đăng ký các Router API
app.include_router(auth.router, prefix=f"{settings.API_V1_STR}/auth", tags=["Xác thực & Tài khoản"])
app.include_router(departments.router, prefix=f"{settings.API_V1_STR}/departments", tags=["Phòng ban & Đơn vị"])
app.include_router(users.router, prefix=f"{settings.API_V1_STR}/users", tags=["Cán bộ & Giảng viên"])
app.include_router(tasks.router, prefix=f"{settings.API_V1_STR}/tasks", tags=["Quản lý & Phân công Công việc"])
app.include_router(workflows.router, prefix=f"{settings.API_V1_STR}/workflows", tags=["Danh Mục Quy Trình Mẫu (Workflows)"])
app.include_router(stats.router, prefix=f"{settings.API_V1_STR}/stats", tags=["Báo cáo & Thống kê"])
app.include_router(permissions.router, prefix=f"{settings.API_V1_STR}/permissions", tags=["Phân Quyền Chi Tiết (RBAC)"])

@app.get("/health", tags=["Hệ thống"])
def health_check():
    return {
        "status": "healthy",
        "timestamp": time.time(),
        "portal": "HueIC Internal Management Portal"
    }
