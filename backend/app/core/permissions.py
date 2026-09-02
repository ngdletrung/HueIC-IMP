from typing import Dict, List, Any
from app.models.user import UserRole

# ==============================================================================
# DANH MỤC 4 NHÓM QUYỀN THỰC TẾ CHUẨN HÓA THEO MÔ HÌNH QUẢN TRỊ GIÁO DỤC HUEIC
# ==============================================================================
SYSTEM_PERMISSIONS_CATALOG = [
    {
        "group_id": "module",
        "group_name": "📱 Quyền Truy Cập Phân Hệ / Module (Navigation & Access)",
        "description": "Kiểm soát các Menu chức năng được hiển thị trên Sidebar và cấp phép truy cập các phân hệ",
        "permissions": [
            {
                "code": "module:dashboard",
                "name": "Tổng Quan & Báo Cáo (Dashboard)",
                "description": "Truy cập màn hình tổng quan, theo dõi biểu đồ thống kê KPI toàn trường và đơn vị"
            },
            {
                "code": "module:tasks",
                "name": "Quản Lý Công Việc & Nhiệm Vụ (Tasks)",
                "description": "Truy cập không gian làm việc, danh sách và bảng Kanban công việc"
            },
            {
                "code": "module:calendar",
                "name": "Lịch Biểu & Sự Kiện (Calendar)",
                "description": "Theo dõi lịch công tác, hạn chót nhiệm vụ trên giao diện Lịch trực quan"
            },
            {
                "code": "module:assets",
                "name": "Quản Trị Cơ Sở Vật Chất & Thiết Bị (Assets)",
                "description": "Quản lý danh mục phòng học, thiết bị máy móc, hồ sơ tài sản công nghệ"
            },
            {
                "code": "module:documents",
                "name": "Văn Bản & Hồ Sơ Số (Documents)",
                "description": "Tra cứu, lưu trữ và khai thác văn bản điều hành, hồ sơ số hóa"
            },
            {
                "code": "module:database",
                "name": "Quản Trị CSDL & Truy Vấn SQL (Database)",
                "description": "Truy cập công cụ quản trị dữ liệu cấp thấp, sao lưu và bảo trì CSDL"
            },
            {
                "code": "module:settings",
                "name": "Thiết Lập & Quản Trị Hệ Thống (Settings)",
                "description": "Cấu hình danh mục tổ chức, cơ cấu nhân sự, quy trình số và phân quyền"
            }
        ]
    },
    {
        "group_id": "scope",
        "group_name": "🌐 Phạm Vi Quan Sát Dữ Liệu (Data Scope)",
        "description": "Giới hạn phạm vi công việc và báo cáo mà cán bộ được phép nhìn thấy trên Dashboard và Danh sách",
        "permissions": [
            {
                "code": "scope:school",
                "name": "Quan sát toàn trường (School-Wide Scope)",
                "description": "Xem công việc, tiến độ và báo cáo của tất cả 12 Phòng / Khoa / Trung tâm"
            },
            {
                "code": "scope:dept",
                "name": "Quan sát nội bộ đơn vị (Department Scope)",
                "description": "Xem toàn bộ công việc và nhân sự trong phạm vi Phòng / Khoa của mình"
            },
            {
                "code": "scope:personal",
                "name": "Cá nhân & Phối hợp (Personal & Assigned Scope)",
                "description": "Chỉ xem các nhiệm vụ do chính mình chủ trì hoặc được mời phối hợp"
            }
        ]
    },
    {
        "group_id": "dispatch",
        "group_name": "📋 Thẩm Quyền Giao Việc & Điều Hành (Task Dispatch)",
        "description": "Phân cấp quyền hạn khởi tạo nhiệm vụ theo đúng luồng chỉ đạo hành chính",
        "permissions": [
            {
                "code": "task:dispatch_school",
                "name": "Giao nhiệm vụ cấp trường (BGH Dispatch)",
                "description": "Ban Giám Hiệu giao nhiệm vụ trọng tâm toàn trường cho các Trưởng đơn vị"
            },
            {
                "code": "task:dispatch_dept",
                "name": "Phân công việc nội bộ đơn vị (Dept Dispatch)",
                "description": "Trưởng/Phó đơn vị phân công nhiệm vụ cho cán bộ, giảng viên trong khoa/phòng"
            },
            {
                "code": "task:todo_personal",
                "name": "Lập danh sách việc cá nhân (My To-Do)",
                "description": "Tự lập kế hoạch công việc hàng ngày cho chính mình"
            },
            {
                "code": "task:edit",
                "name": "Chỉnh sửa thông tin nhiệm vụ",
                "description": "Điều chỉnh nội dung, nhân sự phối hợp và thông tin chi tiết nhiệm vụ"
            },
            {
                "code": "task:progress",
                "name": "Báo cáo % tiến độ & Kết quả",
                "description": "Kéo thanh % tiến độ, nộp báo cáo giải trình và đính kèm minh chứng"
            }
        ]
    },
    {
        "group_id": "approval",
        "group_name": "💡 Thẩm Quyền Phê Duyệt & Nghiệm Thu (Approval & Sign-off)",
        "description": "Kiểm soát các nút thắt phê duyệt đề xuất, gia hạn và kết luận hoàn thành",
        "permissions": [
            {
                "code": "task:approve_proposal",
                "name": "Phê duyệt Đề xuất nhiệm vụ",
                "description": "Xem xét và phê duyệt các ý kiến/đề xuất nhiệm vụ do cấp dưới gửi lên"
            },
            {
                "code": "task:approve_complete",
                "name": "Ký duyệt Nghiệm thu & Chấm điểm KPI",
                "description": "Đánh giá chất lượng và xác nhận nghiệm thu khi nhiệm vụ đạt 100%"
            },
            {
                "code": "task:extend_deadline",
                "name": "Phê duyệt gia hạn Hạn chót (Deadline)",
                "description": "Xét duyệt các yêu cầu xin lùi hạn chót hoàn thành nhiệm vụ"
            },
            {
                "code": "task:delete",
                "name": "Hủy bỏ / Xóa nhiệm vụ",
                "description": "Hủy bỏ hoặc xóa hẳn nhiệm vụ khỏi hệ thống"
            }
        ]
    },
    {
        "group_id": "system",
        "group_name": "🏢 Quản Trị Hệ Thống & Tổ Chức (Administration)",
        "description": "Quản trị danh mục tổ chức, cơ sở dữ liệu nhân sự, quy trình số và phân quyền",
        "permissions": [
            {
                "code": "dept:manage",
                "name": "Quản lý danh mục 12 Phòng / Khoa",
                "description": "Thêm mới, cập nhật thông tin liên hệ và cơ cấu các đơn vị HueIC"
            },
            {
                "code": "user:manage",
                "name": "Quản lý Cán bộ & Tài khoản",
                "description": "Tạo tài khoản, đổi mật khẩu, phân bổ cán bộ vào đơn vị"
            },
            {
                "code": "workflow:manage",
                "name": "Quản lý Danh mục Quy trình mẫu",
                "description": "Soạn thảo và ban hành các quy trình nghiệp vụ số chuẩn hóa"
            },
            {
                "code": "perm:manage",
                "name": "Cấu hình Ma trận Phân quyền",
                "description": "Truy cập bảng phân quyền và thiết lập quyền hạn cho cán bộ"
            }
        ]
    }
]

# Preset quyền chuẩn gốc theo từng vai trò (Baseline Role Permissions)
ROLE_PRESET_PERMISSIONS: Dict[str, List[str]] = {
    "admin": [
        "module:dashboard", "module:tasks", "module:calendar", "module:assets", "module:documents", "module:database", "module:settings",
        "scope:school", "scope:dept", "scope:personal",
        "task:dispatch_school", "task:dispatch_dept", "task:todo_personal", "task:edit", "task:progress",
        "task:approve_proposal", "task:approve_complete", "task:extend_deadline", "task:delete",
        "dept:manage", "user:manage", "workflow:manage", "perm:manage"
    ],
    "bgh": [
        "module:dashboard", "module:tasks", "module:calendar", "module:assets", "module:documents", "module:settings",
        "scope:school", "scope:dept", "scope:personal",
        "task:dispatch_school", "task:dispatch_dept", "task:todo_personal", "task:edit", "task:progress",
        "task:approve_proposal", "task:approve_complete", "task:extend_deadline", "task:delete",
        "dept:manage", "user:manage", "workflow:manage", "perm:manage"
    ],
    "dept_head": [
        "module:tasks",
        "scope:dept", "scope:personal",
        "task:dispatch_dept", "task:todo_personal", "task:edit", "task:progress",
        "task:approve_proposal", "task:approve_complete", "task:extend_deadline"
    ],
    "dept_vice": [
        "module:tasks",
        "scope:dept", "scope:personal",
        "task:dispatch_dept", "task:todo_personal", "task:edit", "task:progress",
        "task:approve_proposal", "task:approve_complete"
    ],
    "staff": [
        "module:tasks",
        "scope:personal",
        "task:todo_personal", "task:progress"
    ]
}


def get_default_permissions_for_role(role: UserRole) -> List[str]:
    """Trả về danh sách quyền mặc định phù hợp với từng vai trò"""
    if role == UserRole.SUPERADMIN:
        return ROLE_PRESET_PERMISSIONS["admin"]
    elif role == UserRole.BGH:
        return ROLE_PRESET_PERMISSIONS["bgh"]
    elif role == UserRole.DEPT_HEAD:
        return ROLE_PRESET_PERMISSIONS["dept_head"]
    elif role == UserRole.DEPT_VICE:
        return ROLE_PRESET_PERMISSIONS["dept_vice"]
    else:
        return ROLE_PRESET_PERMISSIONS["staff"]

