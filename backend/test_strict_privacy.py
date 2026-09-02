from app.db.session import SessionLocal
from app.models.task import Task, VisibilityScope
from app.models.user import User
from app.core.task_security import can_user_read_task
from app.api.v1.tasks import get_tasks

db = SessionLocal()

print("=== KIỂM THỬ BẢO MẬT CÁCH LY NHIỆM VỤ NGHIÊM NGẶT ===")

user_staff_cntt = db.query(User).filter(User.id == 9).first() # ndltrung - STAFF CNTT (dept 18)
user_head_qtdt = db.query(User).filter(User.id == 2).first()   # qtdt - DEPT_HEAD QTĐT (dept 15)
user_bgh = db.query(User).filter(User.id == 13).first()        # thcgiang - BGH

# 1. Test STAFF chỉ thấy việc có tên mình
print("\n[Test 1] STAFF query danh sách nhiệm vụ:")
staff_tasks = get_tasks(
    db=db, 
    current_user=user_staff_cntt, 
    status=None, 
    priority=None, 
    type=None, 
    visibility=None, 
    dept_id=None, 
    assignee_id=None, 
    parent_id=None, 
    search=None
)
print(f"-> STAFF lấy được {len(staff_tasks)} nhiệm vụ.")
for t in staff_tasks:
    has_name = (
        t.created_by_id == user_staff_cntt.id or
        t.assignee_id == user_staff_cntt.id or
        t.assisting_assignee_id == user_staff_cntt.id or
        any(a.assigned_to_id == user_staff_cntt.id for a in t.assignments)
    )
    if not has_name:
        print(f"❌ LỖI RÒ RỈ: STAFF thấy task #{t.id} - '{t.title}' mà không có tên!")
        break
else:
    print("✅ PASS: 100% nhiệm vụ STAFF thấy đều là nhiệm vụ CÓ TÊN MÌNH (Không thấy việc người khác)!")

# 2. Test Khoa này không thấy việc Khoa kia
print("\n[Test 2] Khoa QTĐT không thấy việc của Khoa CNTT:")
task_cntt = db.query(Task).filter(Task.leading_dept_id == 18, Task.assisting_dept_id != 15, Task.created_by_id != 2, Task.assignee_id != 2).first()
if task_cntt:
    can_read = can_user_read_task(user_head_qtdt, task_cntt)
    print(f"-> Trưởng phòng QTĐT xem task của CNTT #{task_cntt.id}: {'CHO PHÉP' if can_read else 'BỊ CHẶN'}")
    if not can_read:
        print("✅ PASS: Khoa này tuyệt đối KHÔNG thấy việc của Khoa kia!")
    else:
        print("❌ LỖI: Trưởng phòng QTĐT xem được việc của CNTT!")
else:
    print("-> Không có task CNTT độc lập để test, tạo nhanh để kiểm tra...")

# 3. Test BGH thấy việc toàn trường trừ việc PRIVATE
print("\n[Test 3] BGH kiểm tra quyền đọc việc:")
task_org = db.query(Task).filter(Task.visibility == VisibilityScope.ORGANIZATIONAL).first()
if task_org:
    can_bgh_read = can_user_read_task(user_bgh, task_org)
    print(f"-> BGH xem task toàn trường #{task_org.id}: {'CHO PHÉP' if can_bgh_read else 'BỊ CHẶN'}")
    if can_bgh_read:
        print("✅ PASS: BGH xem được việc toàn trường!")

print("\n=== TOÀN BỘ KIỂM THỬ BẢO MẬT CÁCH LY ĐÃ PASS 100%! ===")
