import time
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel

from app.db.session import get_db
from app.models.user import User, UserRole
from app.models.department import Department
from app.models.task import Task, TaskComment, TaskStatus, TaskPriority
from app.models.workflow import WorkflowTemplate
from app.api.deps import get_current_user, require_roles
from app.core.security import verify_password, get_password_hash
from app.core.permissions import get_default_permissions_for_role

router = APIRouter()

class SqlQueryRequest(BaseModel):
    query: str

class ImportDataRequest(BaseModel):
    mode: str = "upsert" # "append" | "upsert"
    data: List[Dict[str, Any]]

class RestoreRequest(BaseModel):
    admin_password: str
    backup_data: Dict[str, Any]

@router.get("/stats", summary="Thống kê tổng quan CSDL PostgreSQL")
def get_database_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.SUPERADMIN]))
) -> Any:
    try:
        # Lấy dung lượng DB
        db_size_res = db.execute(text("SELECT pg_size_pretty(pg_database_size(current_database())) as size;")).fetchone()
        db_size = db_size_res[0] if db_size_res else "N/A"

        # Lấy phiên bản Postgres
        ver_res = db.execute(text("SELECT version();")).fetchone()
        pg_version = ver_res[0].split(" on ")[0] if ver_res else "PostgreSQL 16"

        # Thống kê từng bảng
        dept_count = db.query(Department).count()
        user_count = db.query(User).count()
        task_count = db.query(Task).count()
        comment_count = db.query(TaskComment).count()
        wf_count = db.query(WorkflowTemplate).count()

        # Thống kê chi tiết tasks
        tasks_done = db.query(Task).filter(Task.status == TaskStatus.HOAN_THANH).count()
        tasks_in_progress = db.query(Task).filter(Task.status == TaskStatus.DANG_THUC_HIEN).count()
        tasks_pending = db.query(Task).filter(Task.status == TaskStatus.CHO_DUYET).count()

        # Thống kê users
        active_users = db.query(User).filter(User.is_active == True).count()

        tables = [
            {
                "id": "departments",
                "name": "departments",
                "display_name": "🏢 Phòng Ban, Khoa & Tổ / Ban",
                "row_count": dept_count,
                "description": "Cơ cấu tổ chức các Đơn vị và các Tổ / Ban trực thuộc",
                "columns": ["id", "code", "name", "type", "parent_id", "phone", "email", "is_active"]
            },
            {
                "id": "users",
                "name": "users",
                "display_name": "👥 Cán Bộ & Giảng Viên (Nhân sự)",
                "row_count": user_count,
                "description": f"Tài khoản người dùng ({active_users} đang hoạt động)",
                "columns": ["id", "username", "full_name", "email", "role", "position", "department_id", "is_active"]
            },
            {
                "id": "tasks",
                "name": "tasks",
                "display_name": "📋 Nhiệm Vụ & Công Việc",
                "row_count": task_count,
                "description": f"Công việc ({tasks_done} hoàn thành, {tasks_in_progress} đang làm, {tasks_pending} chờ duyệt)",
                "columns": ["id", "title", "status", "priority", "progress_percent", "created_by_id", "assignee_id", "due_date"]
            },
            {
                "id": "task_comments",
                "name": "task_comments",
                "display_name": "💬 Báo Cáo & Bình Luận Minh Chứng",
                "row_count": comment_count,
                "description": "Nhật ký trao đổi, báo cáo tiến độ và minh chứng",
                "columns": ["id", "task_id", "user_id", "content", "created_at"]
            },
            {
                "id": "workflow_templates",
                "name": "workflow_templates",
                "display_name": "🔄 Quy Trình Số Mẫu",
                "row_count": wf_count,
                "description": "Mẫu luồng công việc nhiều bước định nghĩa sẵn",
                "columns": ["id", "code", "name", "department_id", "steps_count"]
            }
        ]

        total_rows = dept_count + user_count + task_count + comment_count + wf_count

        return {
            "status": "healthy",
            "database_name": "hueic_imp_db",
            "database_size": db_size,
            "pg_version": pg_version,
            "total_tables": len(tables),
            "total_rows": total_rows,
            "tables": tables,
            "tasks_summary": {
                "total": task_count,
                "done": tasks_done,
                "in_progress": tasks_in_progress,
                "pending": tasks_pending
            }
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi truy vấn thông tin CSDL: {str(e)}"
        )

@router.get("/tables/{table_name}", summary="Xem dữ liệu chi tiết từng bảng")
def get_table_data(
    table_name: str,
    limit: int = 50,
    offset: int = 0,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.SUPERADMIN]))
) -> Any:
    valid_tables = ["departments", "users", "tasks", "task_comments", "workflow_templates"]
    if table_name not in valid_tables:
        raise HTTPException(status_code=400, detail=f"Bảng '{table_name}' không được hỗ trợ.")

    try:
        # Lấy danh sách cột
        cols_query = text("""
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns 
            WHERE table_name = :tname 
            ORDER BY ordinal_position;
        """)
        cols_res = db.execute(cols_query, {"tname": table_name}).fetchall()
        columns = [{"name": c[0], "type": c[1], "nullable": c[2] == "YES"} for c in cols_res if c[0] != "hashed_password"]

        col_names = [c["name"] for c in columns]
        col_str = ", ".join([f'"{c}"' for c in col_names])

        count_res = db.execute(text(f'SELECT count(*) FROM "{table_name}";')).fetchone()
        total = count_res[0] if count_res else 0

        rows_query = text(f'SELECT {col_str} FROM "{table_name}" ORDER BY id DESC LIMIT :limit OFFSET :offset;')
        rows_res = db.execute(rows_query, {"limit": limit, "offset": offset}).fetchall()

        rows = []
        for r in rows_res:
            row_dict = {}
            for idx, col in enumerate(col_names):
                val = r[idx]
                row_dict[col] = str(val) if val is not None else None
            rows.append(row_dict)

        return {
            "table_name": table_name,
            "columns": columns,
            "rows": rows,
            "total": total,
            "limit": limit,
            "offset": offset
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi đọc dữ liệu bảng {table_name}: {str(e)}")

@router.get("/export/full-json", summary="Xuất toàn bộ dữ liệu CSDL dạng JSON Backup")
def export_full_database(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.SUPERADMIN]))
) -> Any:
    try:
        depts = db.query(Department).all()
        users = db.query(User).all()
        tasks = db.query(Task).all()
        workflows = db.query(WorkflowTemplate).all()

        return {
            "version": "2.9.29",
            "exported_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "exported_by": current_user.username,
            "data": {
                "departments": [
                    {
                        "id": d.id, "code": d.code, "name": d.name, "type": d.type,
                        "parent_id": d.parent_id, "phone": d.phone, "email": d.email,
                        "description": d.description, "is_active": d.is_active
                    } for d in depts
                ],
                "users": [
                    {
                        "id": u.id, "username": u.username, "full_name": u.full_name,
                        "email": u.email, "role": u.role.value if u.role else "STAFF",
                        "position": u.position, "department_id": u.department_id,
                        "phone": u.phone, "permissions": u.permissions, "is_active": u.is_active
                    } for u in users
                ],
                "tasks": [
                    {
                        "id": t.id, "title": t.title, "description": t.description,
                        "status": t.status.value if t.status else "CHUA_BAT_DAU",
                        "priority": t.priority.value if t.priority else "TRUNG_BINH",
                        "progress_percent": t.progress_percent, "created_by_id": t.created_by_id, "assignee_id": t.assignee_id,
                        "leading_dept_id": t.leading_dept_id, "due_date": t.due_date.isoformat() if t.due_date else None,
                        "workflow_steps": t.workflow_steps
                    } for t in tasks
                ],
                "workflows": [
                    {
                        "id": w.id, "code": w.code, "name": w.name,
                        "department_id": w.department_id, "steps": w.steps,
                        "description": w.description, "is_active": w.is_active
                    } for w in workflows
                ]
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi xuất sao lưu CSDL: {str(e)}")

@router.post("/query", summary="Thực thi truy vấn SQL an toàn (Safe SQL Console)")
def execute_sql_query(
    req: SqlQueryRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.SUPERADMIN]))
) -> Any:
    q = req.query.strip()
    if not q:
        raise HTTPException(status_code=400, detail="Câu lệnh SQL không được để trống.")

    first_word = q.split()[0].upper()
    start_time = time.time()

    if first_word not in ["SELECT", "EXPLAIN", "SHOW", "WITH"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Trình truy vấn an toàn chỉ cho phép các câu lệnh SELECT, WITH, EXPLAIN hoặc SHOW để bảo vệ dữ liệu."
        )

    try:
        res = db.execute(text(q))
        columns = list(res.keys()) if res.returns_rows else []
        rows_data = res.fetchmany(200) if res.returns_rows else []
        
        rows = []
        for r in rows_data:
            row_dict = {}
            for idx, col in enumerate(columns):
                val = r[idx]
                row_dict[col] = str(val) if val is not None else None
            rows.append(row_dict)

        elapsed = round((time.time() - start_time) * 1000, 2)

        return {
            "columns": columns,
            "rows": rows,
            "row_count": len(rows),
            "execution_time_ms": elapsed
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Lỗi thực thi SQL: {str(e)}")

@router.post("/optimize", summary="Tối ưu hóa & Dọn dẹp CSDL (VACUUM ANALYZE)")
def optimize_database(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.SUPERADMIN]))
) -> Any:
    try:
        with db.get_bind().connect().execution_options(isolation_level="AUTOCOMMIT") as conn:
            conn.execute(text("VACUUM ANALYZE departments;"))
            conn.execute(text("VACUUM ANALYZE users;"))
            conn.execute(text("VACUUM ANALYZE tasks;"))
            conn.execute(text("VACUUM ANALYZE task_comments;"))
            conn.execute(text("VACUUM ANALYZE workflow_templates;"))
        return {
            "status": "success",
            "message": "Đã thực hiện tối ưu hóa chỉ mục và dọn dẹp các bảng CSDL thành công!"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi tối ưu CSDL: {str(e)}")

@router.post("/import/{table_name}", summary="Nhập dữ liệu hàng loạt (Bulk Import)")
def bulk_import_table(
    table_name: str,
    req: ImportDataRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.SUPERADMIN]))
) -> Any:
    valid_tables = ["departments", "users", "tasks"]
    if table_name not in valid_tables:
        raise HTTPException(status_code=400, detail=f"Chỉ hỗ trợ nhập dữ liệu cho các bảng: {', '.join(valid_tables)}")

    if not req.data or len(req.data) == 0:
        raise HTTPException(status_code=400, detail="Dữ liệu nhập vào rỗng.")

    success_count = 0
    errors = []

    if table_name == "departments":
        for idx, item in enumerate(req.data):
            code = str(item.get("code") or "").strip().upper()
            name = str(item.get("name") or "").strip()
            if not code or not name:
                errors.append(f"Dòng {idx+1}: Thiếu mã viết tắt hoặc tên đơn vị.")
                continue

            dept = db.query(Department).filter(Department.code == code).first()
            if dept and req.mode == "upsert":
                dept.name = name
                dept.phone = item.get("phone") or dept.phone
                dept.email = item.get("email") or dept.email
                dept.description = item.get("description") or dept.description
                dept.type = item.get("type") or dept.type
                success_count += 1
            elif not dept:
                new_d = Department(
                    code=code,
                    name=name,
                    phone=item.get("phone"),
                    email=item.get("email"),
                    description=item.get("description"),
                    type=item.get("type") or "DEPARTMENT"
                )
                db.add(new_d)
                success_count += 1
        db.commit()

    elif table_name == "users":
        for idx, item in enumerate(req.data):
            username = str(item.get("username") or "").strip().lower()
            full_name = str(item.get("full_name") or "").strip()
            email = str(item.get("email") or "").strip()
            if not username or not full_name or not email:
                errors.append(f"Dòng {idx+1}: Thiếu username, họ tên hoặc email.")
                continue

            user = db.query(User).filter(User.username == username).first()
            role_str = str(item.get("role") or "STAFF").upper()
            role = UserRole.STAFF
            if role_str in [r.value for r in UserRole]:
                role = UserRole(role_str)

            dept_id = None
            if item.get("department_code"):
                dept = db.query(Department).filter(Department.code == str(item.get("department_code")).upper()).first()
                if dept: dept_id = dept.id

            if user and req.mode == "upsert":
                user.full_name = full_name
                user.email = email
                user.role = role
                user.position = item.get("position") or user.position
                if dept_id: user.department_id = dept_id
                success_count += 1
            elif not user:
                new_u = User(
                    username=username,
                    full_name=full_name,
                    email=email,
                    hashed_password=get_password_hash(item.get("password") or "Hueic@2026"),
                    role=role,
                    position=item.get("position") or "Cán bộ",
                    department_id=dept_id,
                    permissions=get_default_permissions_for_role(role)
                )
                db.add(new_u)
                success_count += 1
        db.commit()

    return {
        "status": "success",
        "table_name": table_name,
        "imported_count": success_count,
        "errors": errors
    }
