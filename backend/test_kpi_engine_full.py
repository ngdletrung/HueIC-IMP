import sys
from datetime import datetime, timezone, timedelta

# Import modules từ backend
sys.path.insert(0, r"d:\Docker\HueIC IMP\backend")

from app.db.session import SessionLocal
from app.models.user import User, UserRole
from app.models.task import Task, TaskPriority, TaskStatus, TaskType, VisibilityScope
from app.models.kpi import KpiFormulaVersion, WorkloadSnapshot
from app.kpi_engine import BaseScorer, ParentScorer, WorkloadEngine, GovernanceEngine, PeriodKpiEngine

def run_kpi_tests():
    db = SessionLocal()
    print("=================================================================")
    print("🚀 BẮT ĐẦU KIỂM THỬ HỆ THỐNG KPI ENGINE (HUEIC IMP v1.0)")
    print("=================================================================")

    # 1. TEST BASE SCORE
    print("\n--- [TEST 1] BASE SCORE CALCULATION ---")
    bs_low = BaseScorer.calculate_base_score(TaskPriority.THAP, 1.0)
    bs_med = BaseScorer.calculate_base_score(TaskPriority.TRUNG_BINH, 1.5)
    bs_high = BaseScorer.calculate_base_score(TaskPriority.CAO, 2.0)
    bs_urgent = BaseScorer.calculate_base_score(TaskPriority.KHAN_CAP, 2.5)

    assert bs_low == 1.0, f"Expected 1.0, got {bs_low}"
    assert bs_med == 3.0, f"Expected 3.0, got {bs_med}"
    assert bs_high == 6.0, f"Expected 6.0, got {bs_high}"
    assert bs_urgent == 12.5, f"Expected 12.5, got {bs_urgent}"
    print(f"✅ PASS: Base Score logic (Thấp: {bs_low}, TB: {bs_med}, Cao: {bs_high}, Khẩn: {bs_urgent})")

    # 2. TEST QUALITY FACTOR (MULTIPLICATIVE 0.85^n)
    print("\n--- [TEST 2] QUALITY FACTOR (MULTIPLICATIVE 0.85^n) ---")
    version = BaseScorer.get_active_formula_version(db)
    
    t_q0 = Task(quality_reject_count=0, assignment_reject_count=0)
    t_q1 = Task(quality_reject_count=1, assignment_reject_count=0)
    t_q2 = Task(quality_reject_count=2, assignment_reject_count=0)
    t_q3 = Task(quality_reject_count=3, assignment_reject_count=0)
    t_reject_assign = Task(quality_reject_count=0, assignment_reject_count=1)

    q0 = BaseScorer.calculate_quality_factor(t_q0, version)
    q1 = BaseScorer.calculate_quality_factor(t_q1, version)
    q2 = BaseScorer.calculate_quality_factor(t_q2, version)
    q3 = BaseScorer.calculate_quality_factor(t_q3, version)
    q_assign = BaseScorer.calculate_quality_factor(t_reject_assign, version)

    assert q0 == 1.0, f"Expected 1.0, got {q0}"
    assert abs(q1 - 0.85) < 0.001, f"Expected 0.85, got {q1}"
    assert abs(q2 - 0.7225) < 0.001, f"Expected 0.7225, got {q2}"
    assert abs(q3 - 0.6141) < 0.001, f"Expected 0.6141, got {q3}"
    assert q_assign == 0.50, f"Expected 0.50, got {q_assign}"
    print(f"✅ PASS: Quality Multiplicative factor (Lần 0: {q0}, Lần 1: {q1}, Lần 2: {q2}, Lần 3: {q3}, Từ chối nhận việc: {q_assign})")

    # 3. TEST TIME FACTOR & OVERLOAD SHIELD
    print("\n--- [TEST 3] TIME FACTOR & OVERLOAD SHIELD PROTECTION ---")
    now = datetime.now(timezone.utc)
    due_today = now
    
    # Task đúng hạn
    t_ontime = Task(status=TaskStatus.HOAN_THANH, due_date=due_today, completed_at=now)
    tf_ontime = BaseScorer.calculate_time_factor(t_ontime, None, version)
    assert tf_ontime == 1.0, f"Expected 1.0, got {tf_ontime}"

    # Task sớm 2 ngày
    t_early = Task(status=TaskStatus.HOAN_THANH, due_date=due_today + timedelta(days=2), completed_at=now)
    tf_early = BaseScorer.calculate_time_factor(t_early, None, version)
    assert tf_early == 1.10, f"Expected 1.10, got {tf_early}"

    # Task trễ 1 ngày (không quá tải)
    t_late1 = Task(status=TaskStatus.HOAN_THANH, due_date=due_today - timedelta(days=1), completed_at=now)
    tf_late1 = BaseScorer.calculate_time_factor(t_late1, None, version)
    assert tf_late1 == 0.85, f"Expected 0.85, got {tf_late1}"

    # Task trễ 5 ngày (chặn sàn)
    t_late5 = Task(status=TaskStatus.HOAN_THANH, due_date=due_today - timedelta(days=5), completed_at=now)
    tf_late5 = BaseScorer.calculate_time_factor(t_late5, None, version)
    assert tf_late5 == 0.50, f"Expected 0.50, got {tf_late5}"

    # TASK TRỄ 3 NGÀY NHƯNG CÓ KHIÊN QUÁ TẢI (Workload Index = 1.35 > 1.20)
    snap_overload = WorkloadSnapshot(workload_index=1.35, overload_status="OVERLOAD")
    t_late3_shield = Task(status=TaskStatus.HOAN_THANH, due_date=due_today - timedelta(days=3), completed_at=now)
    tf_shield = BaseScorer.calculate_time_factor(t_late3_shield, snap_overload, version)
    assert tf_shield == 1.0, f"Expected 1.0 (Overload Shield), got {tf_shield}"

    print(f"✅ PASS: Time Factor (Đúng hạn: {tf_ontime}, Sớm 2 ngày: {tf_early}, Trễ 1 ngày: {tf_late1}, Trễ 5 ngày: {tf_late5})")
    print(f"🛡️ PASS: Khiên Quá Tải (Overload Shield) đã bảo vệ nhân viên: Trễ 3 ngày nhưng Hệ số Thời gian vẫn là {tf_shield} (Miễn phạt)")

    # 4. TEST WEIGHTED PARENT SCORE (INVARIANT I-01)
    print("\n--- [TEST 4] WEIGHTED PARENT SCORE (INVARIANT I-01) ---")
    # Tạo Parent và 2 Child trong DB thử nghiệm
    parent = Task(
        title="[TEST] Parent Strategic Project",
        priority=TaskPriority.KHAN_CAP,
        weight=2.0, # Base Score = 10.0
        status=TaskStatus.DANG_THUC_HIEN
    )
    db.add(parent)
    db.commit()
    db.refresh(parent)

    # Con 1: Việc nhỏ (Base=1.0), Hoàn thành 100% (Actual=1.0)
    child1 = Task(
        title="[TEST] Small Subtask",
        parent_id=parent.id,
        priority=TaskPriority.THAP,
        weight=1.0, # Base Score = 1.0
        status=TaskStatus.HOAN_THANH,
        base_score=1.0,
        actual_score=1.0
    )
    # Con 2: Việc lớn (Base=9.0), Thất bại 0% (Actual=0.0)
    child2 = Task(
        title="[TEST] Huge Critical Subtask",
        parent_id=parent.id,
        priority=TaskPriority.CAO,
        weight=3.0, # Base Score = 9.0
        status=TaskStatus.HOAN_THANH,
        base_score=9.0,
        actual_score=0.0
    )
    db.add_all([child1, child2])
    db.commit()

    # Tính điểm cha
    ParentScorer.update_parent_score(parent.id, db)
    db.refresh(parent)

    # Điểm cha phải là: (1.0*1.0 + 9.0*0.0) / (1.0+9.0) * 10.0 = 1.0 (10%)
    expected_parent_score = 1.0
    assert abs(parent.actual_score - expected_parent_score) < 0.01, f"Expected {expected_parent_score}, got {parent.actual_score}"
    assert parent.is_final == True, "Parent should be marked final"
    print(f"✅ PASS: Weighted Parent Score chính xác tuyệt đối: {parent.actual_score}/10.00 (10% - Việc lớn kéo điểm cha, không bị cào bằng 50%)")

    # Dọn dẹp task test
    db.delete(child1)
    db.delete(child2)
    db.delete(parent)
    db.commit()

    # 5. TEST SPI TOÀN TRƯỜNG & KPI CÁ NHÂN
    print("\n--- [TEST 5] SPI TOÀN TRƯỜNG & KPI CÁ NHÂN ---")
    spi_res = PeriodKpiEngine.calculate_school_spi(None, None, db)
    assert "spi" in spi_res
    assert "on_time_rate" in spi_res
    print(f"✅ PASS: Chỉ số SPI Toàn trường: {spi_res['spi']}% (On-time: {spi_res['on_time_rate']}%, Completion: {spi_res['completion_rate']}%, Quality: {spi_res['quality_rate']}%)")

    user = db.query(User).filter(User.role == UserRole.STAFF).first()
    if user:
        kpi_user = PeriodKpiEngine.calculate_individual_kpi(user.id, None, None, db)
        print(f"✅ PASS: KPI Cá nhân của Cán bộ [{user.full_name}]: {kpi_user['kpi']}% - Xếp loại: {kpi_user['rank']}")

    db.close()
    print("\n🎉 TOÀN BỘ 5 TEST SUITES CỦA KPI ENGINE ĐỀU PASS 100%!\n")

if __name__ == "__main__":
    run_kpi_tests()
