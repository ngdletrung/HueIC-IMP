from sqlalchemy.orm import Session
from datetime import datetime, timezone, timedelta
from app.core.config import settings
from app.core.security import get_password_hash
from app.db.session import Base, engine
from app.models.department import Department
from app.models.user import User, UserRole
from app.models.task import Task, TaskPriority, TaskStatus, TaskComment
from app.models.workflow import WorkflowTemplate

from sqlalchemy import text
from app.core.permissions import get_default_permissions_for_role

def init_db(db: Session) -> None:
    # 1. Tự động tạo bảng nếu chưa có
    Base.metadata.create_all(bind=engine)

    # 1.1 Tự động bổ sung các cột nếu bảng đã tạo từ trước
    try:
        with engine.connect() as conn:
            conn.execute(text("DO $$ BEGIN ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'BGH'; EXCEPTION WHEN duplicate_object THEN null; END $$;"))
            conn.execute(text("DO $$ BEGIN ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'DEPT_VICE'; EXCEPTION WHEN duplicate_object THEN null; END $$;"))
            conn.execute(text("DO $$ BEGIN ALTER TYPE taskstatus ADD VALUE IF NOT EXISTS 'TU_CHOI'; EXCEPTION WHEN duplicate_object THEN null; END $$;"))
            conn.execute(text("DO $$ BEGIN ALTER TYPE tasktype ADD VALUE IF NOT EXISTS 'PROPOSAL'; EXCEPTION WHEN duplicate_object THEN null; END $$;"))
            conn.execute(text("DO $$ BEGIN ALTER TYPE tasktype ADD VALUE IF NOT EXISTS 'ESCALATION'; EXCEPTION WHEN duplicate_object THEN null; END $$;"))
            conn.execute(text("ALTER TABLE departments ALTER COLUMN code TYPE VARCHAR(100);"))
            conn.execute(text("ALTER TABLE departments ADD COLUMN IF NOT EXISTS parent_id INTEGER REFERENCES departments(id) ON DELETE SET NULL;"))
            conn.execute(text("ALTER TABLE departments ADD COLUMN IF NOT EXISTS path VARCHAR(255);"))
            conn.execute(text("ALTER TABLE departments ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT 'DEPARTMENT';"))
            conn.execute(text("ALTER TABLE departments ADD COLUMN IF NOT EXISTS order_index INTEGER DEFAULT 0;"))
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions JSON DEFAULT '[]'::json;"))
            conn.execute(text("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS workflow_steps JSON DEFAULT '[]'::json;"))
            conn.execute(text("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS workflow_name VARCHAR(255);"))
            conn.execute(text("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS workflow_template_id INTEGER REFERENCES workflow_templates(id) ON DELETE SET NULL;"))
            conn.execute(text("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS parent_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE;"))
            conn.execute(text("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT 'ROUTINE';"))
            conn.execute(text("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS visibility VARCHAR(50) DEFAULT 'DEPARTMENT';"))
            conn.execute(text("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS progress_rule VARCHAR(50) DEFAULT 'AVERAGE';"))
            conn.execute(text("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS weight FLOAT DEFAULT 1.0;"))
            conn.execute(text("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS series_id INTEGER REFERENCES task_recurring_rules(id) ON DELETE SET NULL;"))
            conn.execute(text("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS escalation_level INTEGER DEFAULT 0;"))
            conn.execute(text("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS received_at TIMESTAMP WITH TIME ZONE;"))
            conn.execute(text("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS collaboration_status VARCHAR(50) DEFAULT 'NONE';"))
            conn.execute(text("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS collaboration_reject_reason TEXT;"))
            conn.execute(text("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assisting_assignee_id INTEGER REFERENCES users(id) ON DELETE SET NULL;"))
            conn.execute(text("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS collaboration_accepted_at TIMESTAMP WITH TIME ZONE;"))
            conn.execute(text("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS collaboration_rejected_at TIMESTAMP WITH TIME ZONE;"))
            conn.execute(text("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS approved_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL;"))
            conn.execute(text("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;"))
            conn.execute(text("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assigned_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL;"))
            conn.execute(text("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMP WITH TIME ZONE;"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_tasks_approved_by_id ON tasks(approved_by_id);"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_tasks_assigned_by_id ON tasks(assigned_by_id);"))
            conn.execute(text("ALTER TABLE task_assignments ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;"))
            conn.execute(text("ALTER TABLE task_assignments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_task_assignments_is_active ON task_assignments(is_active);"))
            conn.execute(text("ALTER TABLE task_comments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();"))
            conn.execute(text("ALTER TABLE task_comments ALTER COLUMN author_id DROP NOT NULL;"))
            
            # Tạo bảng Audit Log: task_action_logs
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS task_action_logs (
                    id SERIAL PRIMARY KEY,
                    task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
                    actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                    action VARCHAR(50) NOT NULL,
                    details JSON DEFAULT '{}'::json,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                );
                CREATE INDEX IF NOT EXISTS ix_task_action_logs_task_id ON task_action_logs(task_id);
                CREATE INDEX IF NOT EXISTS ix_task_action_logs_action ON task_action_logs(action);
            """))

            # Tạo bảng Thông báo Điều hành: task_notifications
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS task_notifications (
                    id SERIAL PRIMARY KEY,
                    task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
                    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
                    type VARCHAR(50) NOT NULL,
                    title VARCHAR(255) NOT NULL,
                    message TEXT NOT NULL,
                    is_read BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                );
                CREATE INDEX IF NOT EXISTS ix_task_notifications_user_id ON task_notifications(user_id);
                CREATE INDEX IF NOT EXISTS ix_task_notifications_task_id ON task_notifications(task_id);
                CREATE INDEX IF NOT EXISTS ix_task_notifications_is_read ON task_notifications(is_read);
                CREATE INDEX IF NOT EXISTS ix_task_notifications_created_at ON task_notifications(created_at);
            """))

            # Cập nhật các cột phục vụ KpiEngine v1.0
            conn.execute(text("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS effective_deadline TIMESTAMP WITH TIME ZONE;"))
            conn.execute(text("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS base_score FLOAT;"))
            conn.execute(text("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS actual_score FLOAT;"))
            conn.execute(text("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS quality_reject_count INTEGER DEFAULT 0;"))
            conn.execute(text("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assignment_reject_count INTEGER DEFAULT 0;"))
            conn.execute(text("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS is_escalated BOOLEAN DEFAULT FALSE;"))
            conn.execute(text("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS formula_version_id INTEGER;"))
            conn.execute(text("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS is_final BOOLEAN DEFAULT FALSE;"))
            conn.execute(text("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS last_calculated_at TIMESTAMP WITH TIME ZONE;"))

            # Tạo các bảng KPI Engine nếu chưa có
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS kpi_formula_versions (
                    id SERIAL PRIMARY KEY,
                    version_name VARCHAR(50) NOT NULL DEFAULT 'v1.0',
                    version_number INTEGER NOT NULL DEFAULT 1,
                    late_penalty_rate NUMERIC(5, 2) DEFAULT 0.15,
                    early_bonus_rate NUMERIC(5, 2) DEFAULT 0.10,
                    early_bonus_cap NUMERIC(5, 2) DEFAULT 0.15,
                    late_severe_floor NUMERIC(5, 2) DEFAULT 0.50,
                    reject_penalty_rate NUMERIC(5, 2) DEFAULT 0.15,
                    assignment_reject_factor NUMERIC(5, 2) DEFAULT 0.50,
                    proposal_bonus_points NUMERIC(5, 2) DEFAULT 15.0,
                    proposal_bonus_cap NUMERIC(5, 2) DEFAULT 30.0,
                    escalation_penalty_24h NUMERIC(5, 2) DEFAULT 0.05,
                    escalation_penalty_48h NUMERIC(5, 2) DEFAULT 0.10,
                    escalation_penalty_72h NUMERIC(5, 2) DEFAULT 0.15,
                    coordination_penalty_cap NUMERIC(5, 2) DEFAULT 0.30,
                    workload_overload_threshold NUMERIC(5, 2) DEFAULT 1.20,
                    workload_warning_threshold NUMERIC(5, 2) DEFAULT 1.00,
                    kpi_floor NUMERIC(5, 2) DEFAULT 0.0,
                    kpi_ceiling NUMERIC(5, 2) DEFAULT 1.20,
                    is_active BOOLEAN DEFAULT TRUE,
                    effective_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                );

                CREATE TABLE IF NOT EXISTS workload_snapshots (
                    id SERIAL PRIMARY KEY,
                    task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE NOT NULL,
                    assignee_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
                    workload_index NUMERIC(5, 2) NOT NULL DEFAULT 1.0,
                    overload_status VARCHAR(20) NOT NULL DEFAULT 'NORMAL',
                    formula_version_id INTEGER REFERENCES kpi_formula_versions(id) ON DELETE SET NULL,
                    captured_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                );
                CREATE INDEX IF NOT EXISTS ix_workload_snapshots_task_id ON workload_snapshots(task_id);
                CREATE INDEX IF NOT EXISTS ix_workload_snapshots_assignee_id ON workload_snapshots(assignee_id);

                CREATE TABLE IF NOT EXISTS request_extensions (
                    id SERIAL PRIMARY KEY,
                    task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE NOT NULL,
                    requested_by_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
                    original_deadline TIMESTAMP WITH TIME ZONE,
                    requested_new_deadline TIMESTAMP WITH TIME ZONE NOT NULL,
                    reason TEXT NOT NULL,
                    approved_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
                    note TEXT,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    resolved_at TIMESTAMP WITH TIME ZONE
                );
                CREATE INDEX IF NOT EXISTS ix_request_extensions_task_id ON request_extensions(task_id);

                CREATE TABLE IF NOT EXISTS kpi_logs (
                    id SERIAL PRIMARY KEY,
                    subject_type VARCHAR(20) NOT NULL,
                    subject_id INTEGER NOT NULL,
                    period VARCHAR(20) NOT NULL,
                    kpi_value NUMERIC(6, 2) NOT NULL,
                    base_score_total NUMERIC(8, 2) DEFAULT 0.0,
                    actual_score_total NUMERIC(8, 2) DEFAULT 0.0,
                    is_final BOOLEAN DEFAULT FALSE,
                    formula_version_id INTEGER REFERENCES kpi_formula_versions(id) ON DELETE SET NULL,
                    evidence_task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
                    details TEXT,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                );
                CREATE INDEX IF NOT EXISTS ix_kpi_logs_subject ON kpi_logs(subject_type, subject_id);
                CREATE INDEX IF NOT EXISTS ix_kpi_logs_period ON kpi_logs(period);
            """))

            # Ràng buộc toàn vẹn nâng cao (Constraints & Index)
            conn.execute(text("""
                DO $$ BEGIN
                    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_task_user_assignment') THEN
                        ALTER TABLE task_assignments ADD CONSTRAINT uq_task_user_assignment UNIQUE (task_id, assigned_to_id);
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_task_progress_percent') THEN
                        ALTER TABLE tasks ADD CONSTRAINT chk_task_progress_percent CHECK (progress_percent >= 0.0 AND progress_percent <= 100.0);
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_task_escalation_level') THEN
                        ALTER TABLE tasks ADD CONSTRAINT chk_task_escalation_level CHECK (escalation_level >= 0 AND escalation_level <= 3);
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_task_weight') THEN
                        ALTER TABLE tasks ADD CONSTRAINT chk_task_weight CHECK (weight > 0.0);
                    END IF;
                END $$;
            """))
            conn.commit()
    except Exception as e:
        print(f"⚠️ Kiểm tra cập nhật cột CSDL: {e}")

    # Seed KpiFormulaVersion v1.0 nếu chưa có
    try:
        from app.models.kpi import KpiFormulaVersion
        existing_version = db.query(KpiFormulaVersion).first()
        if not existing_version:
            v1 = KpiFormulaVersion(
                version_name="v1.0 (Quy chuẩn Blueprint)",
                version_number=1,
                late_penalty_rate=0.15,
                early_bonus_rate=0.10,
                early_bonus_cap=0.15,
                late_severe_floor=0.50,
                reject_penalty_rate=0.15,
                assignment_reject_factor=0.50,
                proposal_bonus_points=15.0,
                proposal_bonus_cap=30.0,
                escalation_penalty_24h=0.05,
                escalation_penalty_48h=0.10,
                escalation_penalty_72h=0.15,
                coordination_penalty_cap=0.30,
                workload_overload_threshold=1.20,
                workload_warning_threshold=1.00,
                kpi_floor=0.0,
                kpi_ceiling=1.20,
                is_active=True
            )
            db.add(v1)
            db.commit()
            print("✅ Đã khởi tạo KpiFormulaVersion v1.0 chuẩn hóa thành công.")
    except Exception as e:
        db.rollback()
        print(f"⚠️ Không thể seed KpiFormulaVersion: {e}")

    # 2. Khởi tạo danh sách Phòng/Khoa/Ban chuẩn của HueIC
    default_departments = [
        {"code": "BGH", "name": "Ban Giám hiệu", "type": "BGH", "order_index": 1, "phone": "0234.3822123", "email": "bgh@hueic.edu.vn", "description": "Lãnh đạo và chỉ đạo chung toàn trường"},
        {"code": "HCTH", "name": "Phòng Hành chính - Tổng hợp", "type": "DEPARTMENT", "order_index": 2, "phone": "0234.3822124", "email": "hcth@hueic.edu.vn", "description": "Công tác hành chính, văn thư lưu trữ, tổng hợp và pháp chế"},
        {"code": "ĐT", "name": "Phòng Đào tạo", "type": "DEPARTMENT", "order_index": 3, "phone": "0234.3822125", "email": "daotao@hueic.edu.vn", "description": "Quản lý công tác đào tạo, kế hoạch giảng dạy, thi cử và chuẩn đầu ra"},
        {"code": "QTĐT", "name": "Phòng Quản trị - Đầu tư", "type": "DEPARTMENT", "order_index": 4, "phone": "0234.3822126", "email": "qtdt@hueic.edu.vn", "description": "Quản lý tài sản, cơ sở vật chất, đầu tư xây dựng và thiết bị"},
        {"code": "TSDV", "name": "Trung tâm Tuyển sinh - dịch vụ & Công tác sinh viên", "type": "CENTER", "order_index": 5, "phone": "0234.3822127", "email": "tsdv@hueic.edu.vn", "description": "Công tác tuyển sinh, dịch vụ hỗ trợ sinh viên và rèn luyện"},
        {"code": "CKOT", "name": "Khoa Cơ khí - Ô tô", "type": "FACULTY", "order_index": 6, "phone": "0234.3822128", "email": "ckot@hueic.edu.vn", "description": "Đào tạo Công nghệ Chế tạo máy, Kỹ thuật Ô tô, Hàn"},
        {"code": "DC", "name": "Khoa Điện - Điện tử", "type": "FACULTY", "order_index": 7, "phone": "0234.3822129", "email": "diendientu@hueic.edu.vn", "description": "Đào tạo Kỹ thuật Điện, Điện tử công nghiệp, Tự động hóa"},
        {"code": "CNTT", "name": "Khoa Công nghệ thông tin và Kinh tế số", "type": "FACULTY", "order_index": 8, "phone": "0234.3822130", "email": "cntt@hueic.edu.vn", "description": "Đào tạo CNTT, An ninh mạng, Phần mềm, Thương mại điện tử & Kinh tế số"},
        {"code": "NL", "name": "Khoa Nhiệt lạnh", "type": "FACULTY", "order_index": 9, "phone": "0234.3822131", "email": "nhietlanh@hueic.edu.vn", "description": "Đào tạo Kỹ thuật Nhiệt lạnh, Điều hòa không khí"},
        {"code": "KHCB", "name": "Khoa Khoa học cơ bản", "type": "FACULTY", "order_index": 10, "phone": "0234.3822132", "email": "khcb@hueic.edu.vn", "description": "Giảng dạy các môn khoa học đại cương, toán học, ngoại ngữ"},
        {"code": "TTGD", "name": "Tổ Thanh tra giáo dục", "type": "SECTION", "order_index": 11, "phone": "0234.3822133", "email": "ttgd@hueic.edu.vn", "description": "Thanh tra, giám sát chất lượng đào tạo và nền nếp chuyên môn"},
        {"code": "CĐ", "name": "Ban Chuyển đổi số", "type": "SECTION", "order_index": 12, "phone": "0234.3822134", "email": "cds@hueic.edu.vn", "description": "Xây dựng hạ tầng số, phần mềm quản trị và ứng dụng CNTT toàn trường"}
    ]

    # Đồng bộ / Cập nhật bảng departments
    dept_map = {}
    
    # 2.1 Cập nhật hoặc thêm mới các đơn vị cốt lõi
    for d_data in default_departments:
        dept = db.query(Department).filter((Department.code == d_data["code"]) | (Department.name == d_data["name"])).first()
        if dept:
            dept.code = d_data["code"]
            dept.name = d_data["name"]
            dept.type = d_data.get("type", "DEPARTMENT")
            dept.order_index = d_data.get("order_index", 0)
            dept.phone = d_data["phone"]
            dept.email = d_data["email"]
            dept.description = d_data["description"]
            if not dept.path:
                dept.path = f"/{dept.code}"
        else:
            dept_dict = dict(d_data)
            dept_dict["path"] = f"/{d_data['code']}"
            dept = Department(**dept_dict)
            db.add(dept)
        db.commit()
        db.refresh(dept)
        dept_map[dept.code] = dept

    # 3. Tạo tài khoản SuperAdmin
    admin_user = db.query(User).filter(User.username == settings.FIRST_SUPERADMIN_USERNAME).first()
    if not admin_user:
        bgh_dept = dept_map.get("BGH")
        admin_user = User(
            username=settings.FIRST_SUPERADMIN_USERNAME,
            email=settings.FIRST_SUPERADMIN_EMAIL,
            full_name=settings.FIRST_SUPERADMIN_FULLNAME,
            hashed_password=get_password_hash(settings.FIRST_SUPERADMIN_PASSWORD),
            role=UserRole.SUPERADMIN,
            position="Ban Giám Hiệu / Quản trị viên",
            department_id=bgh_dept.id if bgh_dept else None,
            permissions=get_default_permissions_for_role(UserRole.SUPERADMIN),
            phone="0905.123.456",
            is_active=True
        )
        db.add(admin_user)
        db.commit()
        db.refresh(admin_user)
    else:
        bgh_dept = dept_map.get("BGH")
        if bgh_dept:
            admin_user.department_id = bgh_dept.id
        if not admin_user.permissions:
            admin_user.permissions = get_default_permissions_for_role(UserRole.SUPERADMIN)
        db.commit()

    # 4. Tạo một vài tài khoản mẫu để trải nghiệm phân công (CHỈ TẠO LẦN ĐẦU KHI CSDL TRỐNG)
    total_non_admin_users = db.query(User).filter(User.username != settings.FIRST_SUPERADMIN_USERNAME).count()
    if total_non_admin_users == 0:
        demo_users = [
            {"username": "qtdt", "email": "qtdt@hueic.edu.vn", "full_name": "ThS. Trưởng Phòng QTĐT", "role": UserRole.DEPT_HEAD, "dept": "QTĐT", "position": "Trưởng Phòng Quản trị - Đầu tư", "phone": "0914.111.222"},
            {"username": "ndltrung", "email": "ndltrung@hueic.edu.vn", "full_name": "Nguyễn Đình Lê Trung", "role": UserRole.STAFF, "dept": "QTĐT", "position": "Nhân viên Phòng Quản trị - Đầu tư", "phone": "0914.888.999"},
            {"username": "cv_cntt", "email": "cv_cntt@hueic.edu.vn", "full_name": "KST. Phạm Hoàng Dũng", "role": UserRole.STAFF, "dept": "CNTT", "position": "Chuyên viên Khoa CNTT & KTS", "phone": "0914.777.888"},
        ]

        for u in demo_users:
            dept = dept_map.get(u["dept"])
            user_obj = User(
                username=u["username"],
                email=u["email"],
                full_name=u["full_name"],
                hashed_password=get_password_hash("HueIC@123"),
                role=u["role"],
                position=u["position"],
                phone=u["phone"],
                department_id=dept.id if dept else None,
                permissions=get_default_permissions_for_role(u["role"]),
                is_active=True
            )
            db.add(user_obj)
        db.commit()

    # Thu thập map toàn bộ User theo username để gán đúng ID cho demo tasks
    user_map = {u.username: u for u in db.query(User).all()}

    # 5. Cập nhật hoặc tạo Công việc mẫu
    existing_tasks = db.query(Task).count()
    if existing_tasks == 0:
        now = datetime.now(timezone.utc)
        demo_tasks = [
            {
                "title": "Nâng cấp hệ thống mạng Wi-Fi và đường truyền số giảng đường",
                "description": "Khảo sát và lắp đặt thiết bị Access Point công suất cao phục vụ chuyển đổi số và năm học mới.",
                "leading_dept_id": dept_map["QTĐT"].id if "QTĐT" in dept_map else None,
                "assisting_dept_id": dept_map["CNTT"].id if "CNTT" in dept_map else None,
                "assignee_id": user_map.get("cv_cntt").id if "cv_cntt" in user_map else None,
                "created_by_id": admin_user.id,
                "priority": TaskPriority.CAO,
                "status": TaskStatus.DANG_THUC_HIEN,
                "progress_percent": 65,
                "start_date": now - timedelta(days=5),
                "due_date": now + timedelta(days=10)
            },
            {
                "title": "Rà soát & cập nhật đề cương chi tiết học phần khóa 2026",
                "description": "Các khoa hoàn thiện đề cương giảng dạy theo chuẩn đầu ra CDIO và gửi về phòng Đào tạo tổng hợp.",
                "leading_dept_id": dept_map["ĐT"].id if "ĐT" in dept_map else None,
                "assisting_dept_id": dept_map["CNTT"].id if "CNTT" in dept_map else None,
                "assignee_id": user_map.get("qtdt").id if "qtdt" in user_map else None,
                "created_by_id": admin_user.id,
                "priority": TaskPriority.KHAN_CAP,
                "status": TaskStatus.CHO_DUYET,
                "progress_percent": 90,
                "start_date": now - timedelta(days=15),
                "due_date": now + timedelta(days=2)
            },
            {
                "title": "Triển khai chiến dịch truyền thông tuyển sinh Cao đẳng chính quy đợt 1",
                "description": "Phát động tư vấn hướng nghiệp online và quảng bá hình ảnh các ngành trọng điểm của trường.",
                "leading_dept_id": dept_map["TSDV"].id if "TSDV" in dept_map else None,
                "assisting_dept_id": dept_map["HCTH"].id if "HCTH" in dept_map else None,
                "assignee_id": admin_user.id,
                "created_by_id": admin_user.id,
                "priority": TaskPriority.CAO,
                "status": TaskStatus.DANG_THUC_HIEN,
                "progress_percent": 40,
                "start_date": now - timedelta(days=3),
                "due_date": now + timedelta(days=20)
            }
        ]

        for t_data in demo_tasks:
            task = Task(**t_data)
            db.add(task)
            db.commit()
            db.refresh(task)

            # Thêm bình luận mẫu
            comment = TaskComment(
                task_id=task.id,
                author_id=admin_user.id,
                content=f"Khởi tạo nhiệm vụ: {task.title}. Đề nghị đơn vị chủ trì bám sát tiến độ."
            )
            db.add(comment)
            db.commit()

    # 5. Khởi tạo Danh mục Quy trình chuẩn (Workflow Templates) nếu chưa có
    total_workflows = db.query(WorkflowTemplate).count()
    if total_workflows == 0:
        standard_workflows = [
            {
                "code": "QT_CHUNG_01",
                "name": "Quy trình Soạn thảo & Trình ký văn bản (2 bước)",
                "department_id": None,
                "description": "Áp dụng cho các công văn, thông báo và tờ trình nội bộ thông thường",
                "steps": [
                    {"id": 1, "title": "Soạn thảo văn bản & Thu thập ý kiến các bên liên quan", "description": "Dự thảo nội dung theo mẫu quy chuẩn"},
                    {"id": 2, "title": "Trình lãnh đạo phê duyệt, ký ban hành & Lưu trữ văn thư", "description": "Ký số hoặc ký tươi và phát hành"}
                ]
            },
            {
                "code": "QT_CHUNG_02",
                "name": "Quy trình Quản trị chất lượng & Cải tiến PDCA (4 bước)",
                "department_id": None,
                "description": "Chu trình 4 bước chuẩn hóa theo mô hình Quản lý chất lượng quốc tế",
                "steps": [
                    {"id": 1, "title": "Lập kế hoạch mục tiêu & Khảo sát hiện trạng (Plan)", "description": "Xác định mục tiêu và phân bổ nguồn lực"},
                    {"id": 2, "title": "Triển khai thực hiện nhiệm vụ (Do)", "description": "Thực thi kế hoạch theo đúng tiến độ đề ra"},
                    {"id": 3, "title": "Kiểm tra, giám sát & Đánh giá kết quả (Check)", "description": "Đối chiếu kết quả đạt được với chỉ tiêu ban đầu"},
                    {"id": 4, "title": "Nghiệm thu, chuẩn hóa & Đề xuất cải tiến (Act)", "description": "Hoàn tất bàn giao và cải tiến chu trình mới"}
                ]
            },
            {
                "code": "QT_DT_01",
                "name": "Quy trình Xây dựng & Thẩm định Đề cương CTĐT (5 bước)",
                "department_id": dept_map["ĐT"].id if "ĐT" in dept_map else None,
                "description": "Quy trình phát triển và thẩm định chương trình đào tạo của Phòng Đào tạo",
                "steps": [
                    {"id": 1, "title": "Khảo sát nhu cầu doanh nghiệp & Xây dựng đề cương chi tiết", "description": "Khoa chuyên môn chủ trì soạn thảo"},
                    {"id": 2, "title": "Họp Hội đồng Khoa thẩm định & Lấy ý kiến chuyên gia", "description": "Hội đồng khoa đánh giá chuẩn đầu ra"},
                    {"id": 3, "title": "Báo cáo Hội đồng thẩm định cấp Trường", "description": "Phòng Đào tạo chủ trì thẩm định tổng thể"},
                    {"id": 4, "title": "Trình Ban Giám Hiệu phê duyệt ban hành", "description": "Hiệu trưởng ký quyết định ban hành CTĐT"},
                    {"id": 5, "title": "Tập huấn giảng viên & Triển khai giảng dạy", "description": "Đưa vào kế hoạch đào tạo năm học mới"}
                ]
            },
            {
                "code": "QT_QTDT_01",
                "name": "Quy trình Mua sắm & Đầu tư Cơ sở vật chất (8 bước)",
                "department_id": dept_map["QTĐT"].id if "QTĐT" in dept_map else None,
                "description": "Quy trình 8 bước chuẩn của Phòng Quản trị - Đầu tư phục vụ mua sắm trang thiết bị",
                "steps": [
                    {"id": 1, "title": "Khảo sát hiện trạng & Lập tờ trình đề xuất mua sắm", "description": "Kiểm tra thực tế nhu cầu tại các đơn vị"},
                    {"id": 2, "title": "Lập dự toán chi tiết & Xây dựng bảng thông số kỹ thuật", "description": "Lập danh mục trang thiết bị và định mức kinh phí"},
                    {"id": 3, "title": "Trình Ban Giám Hiệu phê duyệt chủ trương đầu tư", "description": "Ban Giám hiệu xem xét tính cấp thiết"},
                    {"id": 4, "title": "Lấy báo giá cạnh tranh / Phát hành hồ sơ mời thầu", "description": "Thu thập tối thiểu 3 báo giá từ các nhà cung cấp"},
                    {"id": 5, "title": "Thương thảo & Ký kết hợp đồng cung cấp", "description": "Ký hợp đồng kinh tế theo quy định"},
                    {"id": 6, "title": "Giao hàng, thi công, lắp đặt & Chạy thử thiết bị", "description": "Nhà thầu triển khai lắp đặt tại hiện trường"},
                    {"id": 7, "title": "Nghiệm thu kỹ thuật & Đánh giá vận hành", "description": "Hội đồng nghiệm thu cơ sở kiểm tra đạt chuẩn"},
                    {"id": 8, "title": "Bàn giao đơn vị thụ hưởng & Quyết toán kinh phí", "description": "Bàn giao tài sản và hoàn tất hồ sơ thanh quyết toán"}
                ]
            },
            {
                "code": "QT_HCTH_01",
                "name": "Quy trình Tổ chức Sự kiện / Hội thảo Toàn trường (6 bước)",
                "department_id": dept_map["HCTH"].id if "HCTH" in dept_map else None,
                "description": "Quy trình tổ chức các lễ kỷ niệm, hội thảo khoa học và hội nghị cán bộ viên chức",
                "steps": [
                    {"id": 1, "title": "Lập kế hoạch tổng thể & Dự trù kinh phí tổ chức", "description": "Xác định quy mô, thời gian, địa điểm và đại biểu"},
                    {"id": 2, "title": "Trình Ban Giám Hiệu phê duyệt kế hoạch", "description": "BGH duyệt chủ trương và phân công ban tổ chức"},
                    {"id": 3, "title": "Thiết kế maket, phát hành giấy mời & Truyền thông sự kiện", "description": "Chuẩn bị backdrop, thư mời đại biểu"},
                    {"id": 4, "title": "Chuẩn bị hậu cần, âm thanh ánh sáng & Phòng hội trường", "description": "Kiểm tra kỹ thuật và điều kiện tiếp đón"},
                    {"id": 5, "title": "Tổ chức điều hành sự kiện chính thức", "description": "Triển khai kịch bản chi tiết chương trình"},
                    {"id": 6, "title": "Tổng kết, viết bài truyền thông & Quyết toán kinh phí", "description": "Đăng tin website trường và thanh toán hóa đơn"}
                ]
            },
            {
                "code": "QT_TSDV_01",
                "name": "Quy trình Tiếp nhận & Xét duyệt Học bổng Sinh viên (4 bước)",
                "department_id": dept_map["TSDV"].id if "TSDV" in dept_map else None,
                "description": "Quy trình xét duyệt học bổng khuyến khích học tập và học bổng doanh nghiệp",
                "steps": [
                    {"id": 1, "title": "Thông báo tiêu chí & Hướng dẫn sinh viên nộp hồ sơ", "description": "Phát động đăng ký trên cổng thông tin sinh viên"},
                    {"id": 2, "title": "Tiếp nhận, phân loại & Thẩm định tính hợp lệ của hồ sơ", "description": "Kiểm tra điểm học tập và điểm rèn luyện"},
                    {"id": 3, "title": "Họp Hội đồng xét duyệt học bổng cấp trường", "description": "Hội đồng thông qua danh sách sinh viên đạt chuẩn"},
                    {"id": 4, "title": "Công bố kết quả & Chi trả học bổng cho sinh viên", "description": "Phòng Tài chính chi trả qua tài khoản ngân hàng"}
                ]
            },
            {
                "code": "QT_CNTT_01",
                "name": "Quy trình Nâng cấp & Bảo trì Hệ thống Máy chủ (5 bước)",
                "department_id": dept_map["CNTT"].id if "CNTT" in dept_map else None,
                "description": "Quy trình bảo trì hạ tầng công nghệ thông tin và chuyển đổi số",
                "steps": [
                    {"id": 1, "title": "Đánh giá hiệu năng hệ thống & Sao lưu toàn bộ dữ liệu (Backup)", "description": "Backup CSDL và cấu hình hệ thống"},
                    {"id": 2, "title": "Thông báo kế hoạch bảo trì đến toàn thể cán bộ giảng viên", "description": "Thông báo thời gian gián đoạn dịch vụ (nếu có)"},
                    {"id": 3, "title": "Triển khai nâng cấp phần cứng, bản vá bảo mật và phần mềm", "description": "Thực hiện nâng cấp trong khung giờ thấp điểm"},
                    {"id": 4, "title": "Kiểm thử toàn diện các dịch vụ mạng và cổng thông tin", "description": "Kiểm tra tốc độ tải trang và tính năng cốt lõi"},
                    {"id": 5, "title": "Khôi phục trạng thái hoạt động chính thức & Báo cáo kết quả", "description": "Ghi nhật ký hệ thống và bàn giao vận hành"}
                ]
            }
        ]

        for wf_data in standard_workflows:
            wf = WorkflowTemplate(**wf_data)
            db.add(wf)
        db.commit()
        print(f"✅ Đã khởi tạo thành công {len(standard_workflows)} quy trình mẫu chuẩn cho HueIC!")

