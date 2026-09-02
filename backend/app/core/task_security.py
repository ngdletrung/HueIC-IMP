"""
HueIC IMP - Task Security & Granular RBAC Engine
Đảm bảo kiểm soát truy cập hạt mịn, ngăn chặn IDOR và leo thang đặc quyền trái phép.
"""
from typing import List, Tuple, Set, Dict, Any
from app.models.user import User, UserRole
from app.models.task import Task, TaskType, VisibilityScope, TaskAssignment

def is_dept_leader(user: User) -> bool:
    """Kiểm tra người dùng có thuộc vai trò Lãnh đạo Đơn vị (Trưởng hoặc Phó) hay không"""
    if not user:
        return False
    return user.role in [UserRole.DEPT_HEAD, UserRole.DEPT_VICE]

def can_user_create_task(user: User, task_data: Dict[str, Any]) -> Tuple[bool, str]:
    """
    Kiểm tra quyền tạo nhiệm vụ theo Ma trận Phân quyền Hạt mịn:
    - SUPERADMIN / BGH: Toàn quyền tạo mọi loại nhiệm vụ.
    - DEPT_HEAD / DEPT_VICE:
      + PROPOSAL (Đề xuất): Có thể gửi lên cấp trường (ORGANIZATIONAL) hoặc nội bộ (DEPARTMENT).
      + ROUTINE / STRATEGIC: Được tạo và phân công cho đơn vị mình (leading_dept_id == user.department_id).
      + SELF: Việc cá nhân.
    - STAFF:
      + Chỉ được tạo Việc cá nhân (SELF + PRIVATE) hoặc Đề xuất sáng kiến (PROPOSAL + DEPARTMENT/ORGANIZATIONAL).
      + Không được phép tự tạo ROUTINE / STRATEGIC cấp trường / cấp phòng để tránh vượt quyền.
    """
    if not user:
        return False, "Người dùng chưa đăng nhập hoặc không hợp lệ."

    # 1. Ban Giám Hiệu & SuperAdmin: Toàn quyền
    if user.role in [UserRole.SUPERADMIN, UserRole.BGH]:
        return True, ""

    task_type = str(task_data.get("type") or TaskType.ROUTINE.value)
    visibility = str(task_data.get("visibility") or VisibilityScope.DEPARTMENT.value)
    leading_dept_id = task_data.get("leading_dept_id")

    # 2. Lãnh đạo Đơn vị (Trưởng / Phó Khoa/Phòng)
    if is_dept_leader(user):
        # Đề xuất sáng kiến
        if "PROPOSAL" in task_type:
            if leading_dept_id and user.department_id and leading_dept_id != user.department_id:
                return False, "Lãnh đạo đơn vị chỉ có thể gửi đề xuất xuất phát từ đơn vị của mình."
            return True, ""
        
        # Việc cá nhân
        if "SELF" in task_type:
            return True, ""

        # Việc thường quy / Chiến lược: Bắt buộc thuộc đơn vị của mình
        if leading_dept_id and user.department_id and leading_dept_id != user.department_id:
            return False, "Lãnh đạo đơn vị chỉ có quyền giao việc và phân công trong phạm vi đơn vị chủ trì của mình."

        return True, ""

    # 3. Cán bộ / Giảng viên (STAFF)
    if user.role == UserRole.STAFF:
        if "SELF" in task_type:
            return True, ""
        
        if "PROPOSAL" in task_type:
            if leading_dept_id and user.department_id and leading_dept_id != user.department_id:
                return False, "Cán bộ chỉ có thể tạo đề xuất thuộc đơn vị công tác của mình."
            return True, ""

        return False, "Cán bộ/Giảng viên chỉ có quyền tạo Việc cá nhân (SELF) hoặc Đề xuất sáng kiến (PROPOSAL). Vui lòng chọn loại nhiệm vụ là 'Đề xuất sáng kiến' để trình duyệt cấp trên."

    return False, "Vai trò của bạn không có quyền tạo nhiệm vụ này."

def can_user_read_task(user: User, task: Task) -> bool:
    """
    Kiểm tra quyền xem chi tiết một nhiệm vụ.
    """
    if not user or not task:
        return False

    # 1. Trực tiếp có tên trong danh sách nhiệm vụ: Người tạo, Người làm chính, Cán bộ phối hợp RACI
    if task.created_by_id == user.id or task.assignee_id == user.id or task.assisting_assignee_id == user.id:
        return True

    if task.assignments:
        for assignment in task.assignments:
            if getattr(assignment, 'is_active', True) and assignment.assigned_to_id == user.id:
                return True

    # Nếu task là PRIVATE -> chỉ những người có tên ở trên mới thấy
    if task.visibility == VisibilityScope.PRIVATE:
        return False

    # 2. SuperAdmin / Ban Giám Hiệu hoặc người có quyền scope:school: Xem các nhiệm vụ toàn trường / cấp phòng
    if user.role in [UserRole.SUPERADMIN, UserRole.BGH] or (user.permissions and "scope:school" in user.permissions):
        return True

    # 3. Lãnh đạo Đơn vị (DEPT_HEAD, DEPT_VICE): Chỉ xem nhiệm vụ của đơn vị mình (Khoa này không thấy Khoa kia)
    if is_dept_leader(user) and user.department_id:
        if task.leading_dept_id == user.department_id or task.assisting_dept_id == user.department_id:
            return True

    # 4. Cán bộ (STAFF): Tuyệt đối KHÔNG thấy việc của người khác / khoa khác nếu không có tên trong danh sách
    return False


def can_user_update_task(user: User, task: Task, update_fields: Set[str]) -> Tuple[bool, str]:
    """
    Kiểm tra quyền cập nhật nhiệm vụ hạt mịn (Field-level RBAC).
    """
    if not user or not task:
        return False, "Dữ liệu không hợp lệ."

    # 1. SuperAdmin / BGH: Toàn quyền
    if user.role in [UserRole.SUPERADMIN, UserRole.BGH]:
        return True, ""

    # 2. Người tạo nhiệm vụ: Toàn quyền
    if task.created_by_id == user.id:
        return True, ""

    # 3. Lãnh đạo đơn vị chủ trì: Toàn quyền với công việc thuộc đơn vị mình
    if is_dept_leader(user) and user.department_id and task.leading_dept_id == user.department_id:
        return True, ""

    # 4. Người thực hiện chính (Assignee) hoặc Phối hợp: Quyền cập nhật tiến độ
    is_assignee = (task.assignee_id == user.id or task.assisting_assignee_id == user.id)
    if not is_assignee and task.assignments:
        is_assignee = any(getattr(a, 'is_active', True) and a.assigned_to_id == user.id for a in task.assignments)

    if is_assignee:
        allowed_worker_fields = {
            "progress_percent", "status", "workflow_steps", "notes", "comment", "completed_at"
        }
        forbidden_fields = update_fields - allowed_worker_fields
        if forbidden_fields:
            return False, f"Bạn chỉ có quyền cập nhật tiến độ, trạng thái và các bước thực hiện. Không thể sửa: {', '.join(forbidden_fields)}"
        return True, ""

    # 5. Lãnh đạo đơn vị phối hợp: Được phép cập nhật đơn vị phối hợp & phân công cán bộ phối hợp
    if is_dept_leader(user) and user.department_id and task.assisting_dept_id == user.department_id:
        allowed_assisting_head_fields = {
            "assisting_assignee_id", "collaboration_status", "collaboration_reject_reason", "workflow_steps", "progress_percent", "status"
        }
        forbidden_fields = update_fields - allowed_assisting_head_fields
        if forbidden_fields:
            return False, f"Đơn vị phối hợp chỉ được phân công cán bộ phối hợp hoặc cập nhật tiến độ. Không thể sửa: {', '.join(forbidden_fields)}"
        return True, ""

    return False, "Bạn không có quyền chỉnh sửa công việc này."


def can_user_delete_task(user: User, task: Task) -> Tuple[bool, str]:
    """
    Kiểm tra quyền xóa nhiệm vụ.
    - SuperAdmin / BGH / Creator: Có quyền xóa.
    - Trưởng đơn vị (DEPT_HEAD): Có quyền xóa nhiệm vụ thuộc đơn vị chủ trì của mình.
    """
    if not user or not task:
        return False, "Dữ liệu không hợp lệ."

    if user.role in [UserRole.SUPERADMIN, UserRole.BGH]:
        return True, ""

    if task.created_by_id == user.id:
        return True, ""

    if user.role == UserRole.DEPT_HEAD and user.department_id and task.leading_dept_id == user.department_id:
        return True, ""

    return False, "Bạn không có quyền xóa công việc này."


def can_user_manage_assignments(user: User, task: Task) -> bool:
    """
    Kiểm tra quyền phân công RACI (Thêm/Sửa/Xóa phân công).
    - SuperAdmin / BGH / Creator / Lãnh đạo đơn vị chủ trì / Lãnh đạo đơn vị phối hợp.
    """
    if not user or not task:
        return False

    if user.role in [UserRole.SUPERADMIN, UserRole.BGH]:
        return True

    if task.created_by_id == user.id:
        return True

    if is_dept_leader(user) and user.department_id in [task.leading_dept_id, task.assisting_dept_id]:
        return True

    return False

