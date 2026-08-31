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
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions JSON DEFAULT '[]'::json;"))
            conn.execute(text("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS workflow_steps JSON DEFAULT '[]'::json;"))
            conn.execute(text("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS workflow_name VARCHAR(255);"))
            conn.commit()
    except Exception as e:
        print(f"⚠️ Kiểm tra cập nhật cột CSDL: {e}")

    # 2. Khởi tạo danh sách Phòng/Khoa/Ban chuẩn của HueIC
    default_departments = [
        {"code": "BGH", "name": "Ban Giám hiệu", "phone": "0234.3822123", "email": "bgh@hueic.edu.vn", "description": "Lãnh đạo và chỉ đạo chung toàn trường"},
        {"code": "HCTH", "name": "Phòng Hành chính - Tổng hợp", "phone": "0234.3822124", "email": "hcth@hueic.edu.vn", "description": "Công tác hành chính, văn thư lưu trữ, tổng hợp và pháp chế"},
        {"code": "ĐT", "name": "Phòng Đào tạo", "phone": "0234.3822125", "email": "daotao@hueic.edu.vn", "description": "Quản lý công tác đào tạo, kế hoạch giảng dạy, thi cử và chuẩn đầu ra"},
        {"code": "QTĐT", "name": "Phòng Quản trị - Đầu tư", "phone": "0234.3822126", "email": "qtdt@hueic.edu.vn", "description": "Quản lý tài sản, cơ sở vật chất, đầu tư xây dựng và thiết bị"},
        {"code": "TSDV", "name": "Trung tâm Tuyển sinh - dịch vụ & Công tác sinh viên", "phone": "0234.3822127", "email": "tsdv@hueic.edu.vn", "description": "Công tác tuyển sinh, dịch vụ hỗ trợ sinh viên và rèn luyện"},
        {"code": "CKOT", "name": "Khoa Cơ khí - Ô tô", "phone": "0234.3822128", "email": "ckot@hueic.edu.vn", "description": "Đào tạo Công nghệ Chế tạo máy, Kỹ thuật Ô tô, Hàn"},
        {"code": "DC", "name": "Khoa Điện - Điện tử", "phone": "0234.3822129", "email": "diendientu@hueic.edu.vn", "description": "Đào tạo Kỹ thuật Điện, Điện tử công nghiệp, Tự động hóa"},
        {"code": "CNTT", "name": "Khoa Công nghệ thông tin và Kinh tế số", "phone": "0234.3822130", "email": "cntt@hueic.edu.vn", "description": "Đào tạo CNTT, An ninh mạng, Phần mềm, Thương mại điện tử & Kinh tế số"},
        {"code": "NL", "name": "Khoa Nhiệt lạnh", "phone": "0234.3822131", "email": "nhietlanh@hueic.edu.vn", "description": "Đào tạo Kỹ thuật Nhiệt lạnh, Điều hòa không khí"},
        {"code": "KHCB", "name": "Khoa Khoa học cơ bản", "phone": "0234.3822132", "email": "khcb@hueic.edu.vn", "description": "Giảng dạy các môn khoa học đại cương, toán học, ngoại ngữ"},
        {"code": "TTGD", "name": "Tổ Thanh tra giáo dục", "phone": "0234.3822133", "email": "ttgd@hueic.edu.vn", "description": "Thanh tra, giám sát chất lượng đào tạo và nền nếp chuyên môn"},
        {"code": "CĐ", "name": "Ban Chuyển đổi số", "phone": "0234.3822134", "email": "cds@hueic.edu.vn", "description": "Xây dựng hạ tầng số, phần mềm quản trị và ứng dụng CNTT toàn trường"}
    ]

    # Đồng bộ / Cập nhật bảng departments
    dept_map = {}
    
    # 2.1 Cập nhật hoặc thêm mới
    for d_data in default_departments:
        dept = db.query(Department).filter((Department.code == d_data["code"]) | (Department.name == d_data["name"])).first()
        if dept:
            dept.code = d_data["code"]
            dept.name = d_data["name"]
            dept.phone = d_data["phone"]
            dept.email = d_data["email"]
            dept.description = d_data["description"]
        else:
            dept = Department(**d_data)
            db.add(dept)
        db.commit()
        db.refresh(dept)
        dept_map[dept.code] = dept

    # 2.2 Xóa các phòng ban cũ không còn trong danh sách chuẩn (nếu có)
    valid_codes = [d["code"] for d in default_departments]
    old_depts = db.query(Department).filter(~Department.code.in_(valid_codes)).all()
    for od in old_depts:
        db.delete(od)
    db.commit()

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

