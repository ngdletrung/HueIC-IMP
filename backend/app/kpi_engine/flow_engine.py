from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from typing import Dict, Any, List, Optional
import math

from app.models.task import Task, TaskStatus, TaskPriority, VisibilityScope, TaskActionLog
from app.models.department import Department

def calculate_business_hours(
    start_dt: Optional[datetime],
    end_dt: Optional[datetime],
    config: Optional[Dict[str, Any]] = None
) -> float:
    """
    Tính số giờ làm việc chuẩn hành chính HueIC (Hỗ trợ nạp động từ CSDL Settings).
    Mặc định: Sáng 07:30-11:30 (4h), Chiều 13:00-17:00 (4h) = 8h/ngày, Nghỉ T7 & CN.
    Đồng thời bảo đảm không tính giờ ngủ đêm và ngày nghỉ cuối tuần (T7, CN) khi tính thời gian trễ.
    Nếu công việc được xử lý ngoài giờ (OT/Tối/CN), hệ thống vẫn ghi nhận thời gian thực làm để thưởng DPI.
    """
    if not start_dt or not end_dt or start_dt > end_dt:
        return 0.0
    
    total_seconds = (end_dt - start_dt).total_seconds()
    if total_seconds <= 0:
        return 0.0

    cfg = config or {}
    ms_h, ms_m = cfg.get("morning_start", (7, 30))
    me_h, me_m = cfg.get("morning_end", (11, 30))
    as_h, as_m = cfg.get("afternoon_start", (13, 0))
    ae_h, ae_m = cfg.get("afternoon_end", (17, 0))
    weekend_pause = cfg.get("weekend_pause", True)

    cur = start_dt
    worked_seconds = 0.0
    cur_date = cur.date()
    end_date = end_dt.date()

    while cur_date <= end_date:
        if cur_date.weekday() < 5 or not weekend_pause:  # Ngày làm việc hành chính
            m_start = datetime.combine(cur_date, datetime.min.time()).replace(tzinfo=cur.tzinfo) + timedelta(hours=ms_h, minutes=ms_m)
            m_end = datetime.combine(cur_date, datetime.min.time()).replace(tzinfo=cur.tzinfo) + timedelta(hours=me_h, minutes=me_m)
            a_start = datetime.combine(cur_date, datetime.min.time()).replace(tzinfo=cur.tzinfo) + timedelta(hours=as_h, minutes=as_m)
            a_end = datetime.combine(cur_date, datetime.min.time()).replace(tzinfo=cur.tzinfo) + timedelta(hours=ae_h, minutes=ae_m)
            
            overlap_m_start = max(cur, m_start)
            overlap_m_end = min(end_dt, m_end)
            if overlap_m_start < overlap_m_end:
                worked_seconds += (overlap_m_end - overlap_m_start).total_seconds()
                
            overlap_a_start = max(cur, a_start)
            overlap_a_end = min(end_dt, a_end)
            if overlap_a_start < overlap_a_end:
                worked_seconds += (overlap_a_end - overlap_a_start).total_seconds()
        else:
            # Thứ 7 hoặc CN: Nếu người làm chủ động hoàn thành, ghi nhận thời gian OT thực tế
            overlap_w_start = max(cur, datetime.combine(cur_date, datetime.min.time()).replace(tzinfo=cur.tzinfo))
            overlap_w_end = min(end_dt, datetime.combine(cur_date, datetime.max.time()).replace(tzinfo=cur.tzinfo))
            if overlap_w_start < overlap_w_end:
                worked_seconds += min(28800.0, (overlap_w_end - overlap_w_start).total_seconds())

        cur_date += timedelta(days=1)
        cur = datetime.combine(cur_date, datetime.min.time()).replace(tzinfo=start_dt.tzinfo)

    hours = worked_seconds / 3600.0
    if hours == 0.0 and total_seconds > 0:
        # Nếu việc hoàn thành trong giờ nghỉ trưa hoặc ban đêm: công nhận thời gian thực tế đó
        hours = min(8.0, total_seconds / 3600.0)

    return max(0.1, round(hours, 2))


def calculate_business_days(start_dt: Optional[datetime], end_dt: Optional[datetime]) -> float:
    """
    Quy đổi số ngày làm việc chuẩn hành chính (1 ngày làm việc = 8 business hours).
    """
    hrs = calculate_business_hours(start_dt, end_dt)
    return max(0.1, round(hrs / 8.0, 2))


def format_smart_duration(hours: float) -> str:
    """
    Định dạng thời gian thông minh thích ứng (Adaptive Duration Formatter):
    - Dưới 1 giờ: Hiển thị Phút (ví dụ: '22 phút', '45 phút')
    - Từ 1 đến dưới 8 giờ: Hiển thị Giờ & Phút (ví dụ: '1h 52p', '4.0 giờ')
    - Từ 8 giờ trở lên: Quy đổi theo ngày làm việc 8 tiếng (ví dụ: '1.5 ngày', '3 ngày làm việc')
    """
    if hours <= 0:
        return "0 phút"
    if hours < 1.0:
        mins = max(1, int(round(hours * 60)))
        return f"{mins} phút"
    elif hours < 8.0:
        h = int(hours)
        m = int(round((hours - h) * 60))
        if m > 0:
            return f"{h}h {m}p"
        return f"{h} giờ"
    else:
        days = hours / 8.0
        d = int(days)
        rem_h = round(hours - (d * 8), 1)
        if rem_h > 0:
            return f"{d} ngày {rem_h:g}h"
        return f"{d} ngày làm việc"


def compute_flow_intelligence(
    db: Session,
    period_type: str = "MONTH",
    period_key: Optional[str] = None,
    unit_id: Optional[int] = None
) -> Dict[str, Any]:
    """
    Tầng Quản Trị Dòng Chảy & Vận Tốc Thực Thi (Time & Flow Management Layer).
    Đo lường: Lead Time, Execution Time, Wait Time, Flow Efficiency, DPI,
    Bóc tách nguyên nhân chờ đợi và Chẩn đoán nút thắt 12 đơn vị.
    """
    now = datetime.now(timezone.utc)
    
    # Lấy danh sách 12 phòng ban chuẩn
    all_depts = db.query(Department).order_by(Department.id).all()
    dept_map = {d.id: d for d in all_depts}
    
    # Lọc danh sách tasks (loại trừ PRIVATE)
    q = db.query(Task).filter(Task.visibility != VisibilityScope.PRIVATE)
    if unit_id:
        q = q.filter(or_(Task.leading_dept_id == unit_id, Task.assignee_id == unit_id))
    
    tasks = q.all()
    
    if not tasks:
        return {
            "period": {"type": period_type, "key": period_key or now.strftime("%Y-%m")},
            "summary": {
                "avg_lead_time": 0.0,
                "avg_execution_time": 0.0,
                "avg_wait_time": 0.0,
                "flow_efficiency": 100.0,
                "weighted_dpi": 100.0,
                "on_schedule_rate": 100.0,
                "total_completed": 0,
                "total_analyzed": 0,
                "time_distribution": {
                    "active_work_pct": 100.0,
                    "wait_approval_pct": 0.0,
                    "wait_collab_pct": 0.0,
                    "wait_assignment_pct": 0.0,
                    "wait_blocked_pct": 0.0
                }
            },
            "by_unit": []
        }
        
    # Nạp cấu hình thời gian từ CSDL SystemSetting
    def _parse_time(val_str, def_h, def_m):
        try:
            parts = val_str.split(":")
            return (int(parts[0]), int(parts[1]))
        except Exception:
            return (def_h, def_m)

    wh_config = {
        "morning_start": (7, 30),
        "morning_end": (11, 30),
        "afternoon_start": (13, 0),
        "afternoon_end": (17, 0),
        "weekend_pause": True,
        "ot_bonus": True,
    }
    try:
        from app.models.system_setting import SystemSetting
        settings_rows = db.query(SystemSetting).all()
        s_map = {r.key: r.value for r in settings_rows}
        if s_map:
            wh_config["morning_start"] = _parse_time(s_map.get("working_morning_start", "07:30"), 7, 30)
            wh_config["morning_end"] = _parse_time(s_map.get("working_morning_end", "11:30"), 11, 30)
            wh_config["afternoon_start"] = _parse_time(s_map.get("working_afternoon_start", "13:00"), 13, 0)
            wh_config["afternoon_end"] = _parse_time(s_map.get("working_afternoon_end", "17:00"), 17, 0)
            wh_config["weekend_pause"] = s_map.get("working_weekend_pause", "true").lower() in ["true", "1"]
            wh_config["ot_bonus"] = s_map.get("working_ot_bonus", "true").lower() in ["true", "1"]
    except Exception:
        pass

    # Tính toán cho từng task
    task_flow_records = []
    
    for t in tasks:
        t_created = t.created_at or (now - timedelta(days=3))
        t_start = t.start_date or t.received_at or t.assigned_at or t_created
        t_end = t.completed_at if t.status == TaskStatus.HOAN_THANH else now
        
        # Planned duration in business hours (Chuẩn 8h/ngày)
        t_due = t.effective_deadline or t.due_date
        if t_due and t_due >= t_start:
            planned_hours = calculate_business_hours(t_start, t_due, config=wh_config)
        else:
            planned_hours = 24.0  # Chuẩn SLA mặc định 3 ngày làm việc = 24 giờ
            
        lead_hours = calculate_business_hours(t_created, t_end, config=wh_config)
        execution_hours = calculate_business_hours(t_start, t_end, config=wh_config)
        if execution_hours > lead_hours:
            execution_hours = lead_hours
            
        wait_hours = max(0.0, round(lead_hours - execution_hours, 2))
        
        # Quy đổi sang ngày làm việc chuẩn 8h
        lead_time = round(lead_hours / 8.0, 2)
        execution_time = round(execution_hours / 8.0, 2)
        wait_time = round(wait_hours / 8.0, 2)
        planned_days = round(planned_hours / 8.0, 2)
        
        # Nhận diện làm ngoài giờ (OT: sau 18h tối, trước 7h sáng hoặc thứ 7, CN)
        is_overtime = False
        if t.completed_at:
            local_dt = t.completed_at + timedelta(hours=7)  # Giờ VN (UTC+7)
            if local_dt.hour >= 18 or local_dt.hour < 7 or local_dt.weekday() >= 5:
                is_overtime = True

        # Bóc tách cấu trúc thời gian chờ (Bottleneck breakdown)
        w_approval = 0.0
        w_collab = 0.0
        w_assignment = 0.0
        w_blocked = 0.0
        
        if t.status == TaskStatus.CHO_DUYET:
            w_approval = wait_time * 0.7
            w_assignment = wait_time * 0.3
        elif str(t.collaboration_status) not in ["NONE", "CollaborationStatus.NONE", ""]:
            w_collab = wait_time * 0.5
            w_approval = wait_time * 0.3
            w_assignment = wait_time * 0.2
        elif t.status == TaskStatus.TAM_DUNG:
            w_blocked = wait_time * 0.8
            w_assignment = wait_time * 0.2
        else:
            w_assignment = wait_time * 0.6
            w_approval = wait_time * 0.4
            
        base_score = float(t.base_score) if t.base_score else 1.0
        is_completed = (t.status == TaskStatus.HOAN_THANH)
        is_on_time = (t.completed_at and t.due_date and t.completed_at <= t.due_date) or (not t.due_date) or (t.due_date and now <= t.due_date)
        
        # Đơn vị chủ trì
        effective_dept_id = t.leading_dept_id or (t.assignee.department_id if t.assignee and t.assignee.department_id else None)
        
        task_flow_records.append({
            "task_id": t.id,
            "title": t.title,
            "dept_id": effective_dept_id,
            "is_completed": is_completed,
            "is_on_time": is_on_time,
            "is_overtime": is_overtime,
            "lead_hours": lead_hours,
            "execution_hours": execution_hours,
            "wait_hours": wait_hours,
            "lead_time": lead_time,
            "execution_time": execution_time,
            "wait_time": wait_time,
            "w_approval": w_approval,
            "w_collab": w_collab,
            "w_assignment": w_assignment,
            "w_blocked": w_blocked,
            "planned_days": max(0.5, planned_days),
            "actual_days": max(0.1, execution_time),
            "base_score": base_score
        })

    # Tổng hợp cấp Trường (Macro Aggregates)
    total_analyzed = len(task_flow_records)
    total_completed = sum(1 for r in task_flow_records if r["is_completed"])
    
    # Dùng tập bản ghi hoàn thành nếu có >= 2, ngược lại dùng toàn bộ để có chỉ số vận hành tức thời
    eval_set = [r for r in task_flow_records if r["is_completed"]] if total_completed >= 2 else task_flow_records
    
    sum_lead_h = sum(r["lead_hours"] for r in eval_set)
    sum_exec_h = sum(r["execution_hours"] for r in eval_set)
    sum_wait_h = sum(r["wait_hours"] for r in eval_set)
    
    avg_lead_h = round(sum_lead_h / len(eval_set), 2) if eval_set else 0.0
    avg_exec_h = round(sum_exec_h / len(eval_set), 2) if eval_set else 0.0
    avg_wait_h = round(sum_wait_h / len(eval_set), 2) if eval_set else 0.0
    
    avg_lead_days = round(avg_lead_h / 8.0, 2)
    avg_exec_days = round(avg_exec_h / 8.0, 2)
    avg_wait_days = round(avg_wait_h / 8.0, 2)
    
    flow_eff = round((sum_exec_h / sum_lead_h * 100.0), 1) if sum_lead_h > 0 else 100.0
    flow_eff = min(100.0, max(0.0, flow_eff))
    
    # Weighted DPI = sum(planned * score) / sum(actual * score) * 100 (Clamped [0, 120])
    sum_weighted_planned = sum(r["planned_days"] * r["base_score"] for r in eval_set)
    sum_weighted_actual = sum(r["actual_days"] * r["base_score"] for r in eval_set)
    
    raw_dpi = (sum_weighted_planned / sum_weighted_actual * 100.0) if sum_weighted_actual > 0 else 100.0
    weighted_dpi = round(min(120.0, max(0.0, raw_dpi)), 1)
    
    # On-schedule rate
    on_sched_cnt = sum(1 for r in eval_set if r["actual_days"] <= r["planned_days"])
    on_schedule_rate = round((on_sched_cnt / len(eval_set) * 100.0), 1) if eval_set else 100.0
    
    # Số nhiệm vụ xử lý ngoài giờ / cuối tuần
    ot_count = sum(1 for r in eval_set if r.get("is_overtime"))
    
    # Phân bổ tỷ lệ thời gian trong chu kỳ (Đóng đúng 100.0%)
    tot_active = sum_exec_h
    tot_appr = sum(r["w_approval"] * 8.0 for r in eval_set)
    tot_collab = sum(r["w_collab"] * 8.0 for r in eval_set)
    tot_assign = sum(r["w_assignment"] * 8.0 for r in eval_set)
    tot_block = sum(r["w_blocked"] * 8.0 for r in eval_set)
    
    grand_time = tot_active + tot_appr + tot_collab + tot_assign + tot_block
    if grand_time > 0:
        p_active = round((tot_active / grand_time * 100.0), 1)
        p_appr = round((tot_appr / grand_time * 100.0), 1)
        p_collab = round((tot_collab / grand_time * 100.0), 1)
        p_assign = round((tot_assign / grand_time * 100.0), 1)
        p_block = round(max(0.0, 100.0 - p_active - p_appr - p_collab - p_assign), 1)
    else:
        p_active, p_appr, p_collab, p_assign, p_block = 100.0, 0.0, 0.0, 0.0, 0.0

    # Tổng hợp chi tiết 12 đơn vị
    by_unit = []
    for d in all_depts:
        u_records = [r for r in task_flow_records if r["dept_id"] == d.id]
        if u_records:
            u_lead_h = round(sum(r["lead_hours"] for r in u_records) / len(u_records), 2)
            u_exec_h = round(sum(r["execution_hours"] for r in u_records) / len(u_records), 2)
            u_wait_h = max(0.0, round(u_lead_h - u_exec_h, 2))
            
            u_lead = round(u_lead_h / 8.0, 2)
            u_exec = round(u_exec_h / 8.0, 2)
            u_wait = round(u_wait_h / 8.0, 2)
            
            u_flow = round((u_exec_h / u_lead_h * 100.0), 1) if u_lead_h > 0 else 100.0
            u_flow = min(100.0, max(0.0, u_flow))
            
            u_wp = sum(r["planned_days"] * r["base_score"] for r in u_records)
            u_wa = sum(r["actual_days"] * r["base_score"] for r in u_records)
            u_dpi = round(min(120.0, max(0.0, (u_wp / u_wa * 100.0) if u_wa > 0 else 100.0)), 1)
            
            u_on_time = round(sum(1 for r in u_records if r["is_on_time"]) / len(u_records) * 100.0, 1)
            u_completed = sum(1 for r in u_records if r["is_completed"])
            
            # Đánh giá rủi ro & Chẩn đoán nút thắt
            if u_flow >= 60.0 and u_on_time >= 85.0:
                risk_status = "GREEN"
                bottleneck = "🟢 Luân chuyển thông suốt"
            elif u_flow < 40.0:
                risk_status = "RED"
                appr_wait = sum(r["w_approval"] for r in u_records)
                if appr_wait > u_wait * 0.4:
                    bottleneck = f"🔴 Nghẽn khâu duyệt hồ sơ ({format_smart_duration(u_wait_h)} chờ)"
                else:
                    bottleneck = f"🔴 Chờ luân chuyển cao ({format_smart_duration(u_wait_h)} chờ)"
            else:
                risk_status = "YELLOW"
                bottleneck = "🟡 Nhịp độ trung bình"
        else:
            # Baseline chuẩn cho đơn vị chưa phát sinh nhiều task
            u_lead_h = 20.0
            u_exec_h = 16.0
            u_wait_h = 4.0
            u_lead = 2.5
            u_exec = 2.0
            u_wait = 0.5
            u_flow = 80.0
            u_dpi = 100.0
            u_on_time = 100.0
            u_completed = 0
            risk_status = "GREEN"
            bottleneck = "⚪ Đang duy trì nhịp độ chuẩn"
            
        by_unit.append({
            "dept_id": d.id,
            "dept_code": d.code,
            "dept_name": d.name,
            "lead_time": u_lead,
            "execution_time": u_exec,
            "wait_time": u_wait,
            "lead_hours": u_lead_h,
            "execution_hours": u_exec_h,
            "wait_hours": u_wait_h,
            "lead_formatted": format_smart_duration(u_lead_h),
            "execution_formatted": format_smart_duration(u_exec_h),
            "wait_formatted": format_smart_duration(u_wait_h),
            "flow_efficiency": u_flow,
            "dpi": u_dpi,
            "on_time_rate": u_on_time,
            "completed_tasks": u_completed,
            "risk_status": risk_status,
            "bottleneck_diagnosis": bottleneck
        })
        
    # Sắp xếp đơn vị theo thứ tự ưu tiên quan sát (Flow thấp / Risk đỏ lên đầu)
    by_unit.sort(key=lambda x: (0 if x["risk_status"] == "RED" else 1 if x["risk_status"] == "YELLOW" else 2, x["flow_efficiency"]))

    return {
        "period": {
            "type": period_type,
            "key": period_key or now.strftime("%Y-%m"),
            "label": f"Kỳ {period_key or now.strftime('%Y-%m')}"
        },
        "summary": {
            "avg_lead_time": avg_lead_days,
            "avg_execution_time": avg_exec_days,
            "avg_wait_time": avg_wait_days,
            "avg_lead_hours": avg_lead_h,
            "avg_execution_hours": avg_exec_h,
            "avg_wait_hours": avg_wait_h,
            "avg_lead_formatted": format_smart_duration(avg_lead_h),
            "avg_execution_formatted": format_smart_duration(avg_exec_h),
            "avg_wait_formatted": format_smart_duration(avg_wait_h),
            "flow_efficiency": flow_eff,
            "weighted_dpi": weighted_dpi,
            "on_schedule_rate": on_schedule_rate,
            "overtime_completions_count": ot_count,
            "working_hours_standard": "8h/ngày (07:30-11:30 & 13:00-17:00, T2-T6, Nghỉ T7 & CN)",
            "total_completed": total_completed,
            "total_analyzed": total_analyzed,
            "time_distribution": {
                "active_work_pct": p_active,
                "wait_approval_pct": p_appr,
                "wait_collab_pct": p_collab,
                "wait_assignment_pct": p_assign,
                "wait_blocked_pct": p_block
            }
        },
        "by_unit": by_unit
    }
