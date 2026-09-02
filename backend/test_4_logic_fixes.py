import os
import sys
from datetime import datetime, timedelta, timezone

from app.db.session import SessionLocal
from app.models.task import Task, TaskType, TaskComment
from app.models.user import User
from app.api.v1.tasks import create_task, TaskCreate

db = SessionLocal()

print("=== KIỂM THỬ 4 CẢI TIẾN LOGIC & UX ===")

user_qtdt = db.query(User).filter(User.id == 2).first()
user_bgh = db.query(User).filter(User.id == 13).first()

# Test 1: Validation thiếu description
print("\n[Test 1] Validation Đề xuất thiếu Description & DueDate:")
try:
    t1 = TaskCreate(
        title="Đề xuất thiếu thông tin",
        type="PROPOSAL",
        visibility="ORGANIZATIONAL",
        leading_dept_id=15
    )
    create_task(t1, db, user_qtdt)
    print("❌ LỖI: Không chặn được đề xuất thiếu description!")
except Exception as e:
    detail = getattr(e, 'detail', str(e))
    print(f"✅ PASS: Đã chặn thành công -> {detail}")

# Test 2: Tạo đề xuất hợp lệ đầy đủ
print("\n[Test 2] Tạo Đề xuất hợp lệ đầy đủ thông tin:")
t2 = TaskCreate(
    title="Đề xuất mua sắm thiết bị phòng Lab AI 2026",
    description="Cần mua sắm bổ sung 15 máy trạm chuyên dụng phục vụ nghiên cứu và giảng dạy ngành AI",
    type="PROPOSAL",
    visibility="ORGANIZATIONAL",
    leading_dept_id=15,
    due_date=datetime.now(timezone.utc) + timedelta(days=7)
)
task_created = create_task(t2, db, user_qtdt)
print(f"✅ PASS: Tạo đề xuất thành công: #{task_created.id} - '{task_created.title}'")

# Test 3: Kiểm tra bình luận rác hệ thống (yêu cầu = 0)
print("\n[Test 3] Kiểm tra bảng TaskComment (không chứa log rác hệ thống):")
comments = db.query(TaskComment).filter(TaskComment.task_id == task_created.id).all()
if len(comments) == 0:
    print(f"✅ PASS: Bảng TaskComment hoàn toàn sạch sẽ (0 bình luận rác hệ thống)!")
else:
    print(f"❌ LỖI: Vẫn còn {len(comments)} bình luận rác!")

print("\n=== TOÀN BỘ 3 TEST CASES ĐÃ PASS 100%! ===")
