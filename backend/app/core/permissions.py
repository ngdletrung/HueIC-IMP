from typing import Dict, List, Any
from app.models.user import UserRole

# Danh mục các mã quyền chuẩn trong hệ thống HueIC IMP
SYSTEM_PERMISSIONS_CATALOG = [
    {
        "group_id": "tasks",
        "group_name": "📋 Phân Hệ Quản Lý Công Việc",
        "description": "Các quyền liên quan đến xem, giao việc, cập nhật tiến độ và nghiệm thu",
        "permissions": [
            {
                "code": "task:view_all",
                "name": "Xem toàn bộ công việc trường",
                "description": "Cho phép xem công việc của tất cả các phòng ban thay vì chỉ đơn vị mình"
            },
            {
                "code": "task:create",
                "name": "Tạo & Giao việc mới",
                "description": "Cho phép tạo nhiệm vụ và phân công cho các đơn vị / cá nhân"
            },
            {
                "code": "task:edit",
                "name": "Sửa thông tin nhiệm vụ",
                "description": "Thay đổi tiêu đề, mô tả, đơn vị phối hợp, hạn chót (deadline)"
            },
            {
                "code": "task:progress",
                "name": "Cập nhật % tiến độ",
                "description": "Kéo thanh tiến độ % và viết báo cáo giải trình công việc"
            },
            {
                "code": "task:approve",
                "name": "Duyệt nghiệm thu hoàn thành",
                "description": "Phê duyệt hoàn tất nhiệm vụ khi đơn vị thực hiện báo cáo 100%"
            },
            {
                "code": "task:delete",
                "name": "Xóa công việc",
                "description": "Hủy bỏ hoặc xóa hoàn toàn nhiệm vụ khỏi hệ thống"
            }
        ]
    },
    {
        "group_id": "org_users",
        "group_name": "🏢 Phân Hệ Tổ Chức & Nhân Sự",
        "description": "Quản lý cơ cấu phòng ban và danh sách tài khoản",
        "permissions": [
            {
                "code": "dept:manage",
                "name": "Quản lý danh mục Phòng / Khoa",
                "description": "Thêm mới, sửa đổi thông tin liên hệ các đơn vị trong trường"
            },
            {
                "code": "user:manage",
                "name": "Quản lý Cán bộ & Tài khoản",
                "description": "Tạo mới tài khoản, đổi mật khẩu, khóa/mở khóa người dùng"
            },
            {
                "code": "perm:manage",
                "name": "Cấu hình Phân quyền Hệ thống",
                "description": "Quyền truy cập bảng Checkbox phân quyền cho người khác"
            }
        ]
    },
    {
        "group_id": "assets",
        "group_name": "🏛️ Phân Hệ Quản Lý Tài Sản (Mở rộng)",
        "description": "Quản lý cơ sở vật chất, phòng máy, hạ tầng thiết bị",
        "permissions": [
            {
                "code": "asset:view",
                "name": "Tra cứu danh mục tài sản",
                "description": "Xem thông tin máy móc, thiết bị và tình trạng phòng máy"
            },
            {
                "code": "asset:manage",
                "name": "Thêm, sửa & điều chuyển tài sản",
                "description": "Quản lý nhập mới, luân chuyển và bảo dưỡng thiết bị"
            }
        ]
    },
    {
        "group_id": "documents",
        "group_name": "📄 Phân Hệ Văn Bản & Hồ Sơ (Mở rộng)",
        "description": "Quản lý công văn, tờ trình và luồng phê duyệt",
        "permissions": [
            {
                "code": "doc:view",
                "name": "Tra cứu công văn & hồ sơ",
                "description": "Xem văn bản, quyết định ban hành nội bộ"
            },
            {
                "code": "doc:manage",
                "name": "Soạn thảo & Phát hành văn bản",
                "description": "Tạo dự thảo văn bản, gửi luồng trình duyệt và ban hành"
            }
        ]
    }
]

def get_default_permissions_for_role(role: UserRole) -> List[str]:
    """Trả về danh sách quyền mặc định phù hợp với từng vai trò"""
    if role == UserRole.SUPERADMIN:
        # SuperAdmin sở hữu toàn bộ quyền
        all_perms = []
        for group in SYSTEM_PERMISSIONS_CATALOG:
            for p in group["permissions"]:
                all_perms.append(p["code"])
        return all_perms
    elif role == UserRole.DEPT_HEAD:
        # Trưởng phòng/Khoa có quyền giao việc, sửa việc phòng mình, cập nhật tiến độ, duyệt hoàn thành, xem tài sản & văn bản
        return [
            "task:create",
            "task:edit",
            "task:progress",
            "task:approve",
            "asset:view",
            "doc:view"
        ]
    else:
        # Cán bộ/Chuyên viên mặc định chỉ cập nhật tiến độ và tra cứu
        return [
            "task:progress",
            "asset:view",
            "doc:view"
        ]
