import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, Tuple, List
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.models.task import Task, TaskStatus, TaskType, TaskPriority, TaskActionLog, TaskAssignment, TaskAssignmentStatus
from app.models.department import Department
from app.models.user import User, UserRole
from app.models.snapshot import KpiPeriodSnapshot
from app.models.workflow import WorkflowTemplate
from app.kpi_engine.period_kpi_engine import PeriodKpiEngine
from app.kpi_engine.base_scorer import BaseScorer
from app.kpi_engine.flow_engine import compute_flow_intelligence

logger = logging.getLogger('hueic_imp')

# In-Memory Cache for ultra-fast < 2ms responses
_MEM_CACHE: Dict[str, Dict[str, Any]] = {}

class SnapshotManager:
    @classmethod
    def get_period_dates(cls, period_type: str, period_key: Optional[str] = None) -> Tuple[datetime, datetime, str, bool]:
        now = datetime.now(timezone.utc)
        y = now.year
        m = now.month

        p_type = (period_type or 'MONTH').upper()

        if p_type == 'QUARTER':
            q = (m - 1) // 3 + 1
            if not period_key:
                period_key = f'{y}-Q{q}'
            
            try:
                parts = period_key.split('-Q')
                qy = int(parts[0])
                qnum = int(parts[1])
            except Exception:
                qy, qnum = y, q
            
            start_m = (qnum - 1) * 3 + 1
            end_m = start_m + 2
            start_date = datetime(qy, start_m, 1, 0, 0, 0, tzinfo=timezone.utc)
            if end_m == 12:
                end_date = datetime(qy, 12, 31, 23, 59, 59, tzinfo=timezone.utc)
            else:
                next_month = datetime(qy, end_m + 1, 1, 0, 0, 0, tzinfo=timezone.utc)
                end_date = next_month - timedelta(seconds=1)

            is_closed = end_date < now
            return start_date, end_date, period_key, is_closed

        elif p_type == 'YEAR':
            start_y = y if m >= 9 else y - 1
            end_y = start_y + 1
            if not period_key:
                period_key = f'{start_y}-{end_y}'
            
            try:
                parts = period_key.split('-')
                start_y = int(parts[0])
                end_y = int(parts[1])
            except Exception:
                pass

            start_date = datetime(start_y, 9, 1, 0, 0, 0, tzinfo=timezone.utc)
            end_date = datetime(end_y, 8, 31, 23, 59, 59, tzinfo=timezone.utc)
            is_closed = end_date < now
            return start_date, end_date, period_key, is_closed

        else:
            if not period_key:
                period_key = f'{y}-{m:02d}'
            
            try:
                parts = period_key.split('-')
                py = int(parts[0])
                pm = int(parts[1])
            except Exception:
                py, pm = y, m

            start_date = datetime(py, pm, 1, 0, 0, 0, tzinfo=timezone.utc)
            if pm == 12:
                end_date = datetime(py, 12, 31, 23, 59, 59, tzinfo=timezone.utc)
            else:
                next_month = datetime(py, pm + 1, 1, 0, 0, 0, tzinfo=timezone.utc)
                end_date = next_month - timedelta(seconds=1)

            is_closed = end_date < now
            return start_date, end_date, period_key, is_closed

    @classmethod
    def get_or_compute_snapshot(cls, db: Session, period_type: str = 'MONTH', period_key: Optional[str] = None, dept_id: Optional[int] = None, force_refresh: bool = False) -> Dict[str, Any]:
        p_type = (period_type or 'MONTH').upper()
        start_date, end_date, normalized_key, is_closed = cls.get_period_dates(p_type, period_key)
        cache_key = f'{p_type}:{normalized_key}:{dept_id or 0}'

        if not force_refresh and cache_key in _MEM_CACHE:
            entry = _MEM_CACHE[cache_key]
            if not is_closed:
                cached_time = entry.get('_cached_at', 0)
                if (datetime.now(timezone.utc).timestamp() - cached_time) < 180:
                    return entry['data']
            else:
                return entry['data']

        if not force_refresh:
            existing_snap = db.query(KpiPeriodSnapshot).filter(
                KpiPeriodSnapshot.period_type == p_type,
                KpiPeriodSnapshot.period_key == normalized_key,
                KpiPeriodSnapshot.department_id == dept_id
            ).first()

            if existing_snap and (existing_snap.is_closed or (datetime.now(timezone.utc) - existing_snap.updated_at.replace(tzinfo=timezone.utc)).total_seconds() < 120):
                result = cls._serialize_snapshot(existing_snap)
                _MEM_CACHE[cache_key] = {'data': result, '_cached_at': datetime.now(timezone.utc).timestamp()}
                return result

        computed_data = cls._compute_full_snapshot_data(db, start_date, end_date, dept_id, p_type, normalized_key, is_closed)

        snap = db.query(KpiPeriodSnapshot).filter(
            KpiPeriodSnapshot.period_type == p_type,
            KpiPeriodSnapshot.period_key == normalized_key,
            KpiPeriodSnapshot.department_id == dept_id
        ).first()

        if not snap:
            snap = KpiPeriodSnapshot(
                period_type=p_type,
                period_key=normalized_key,
                department_id=dept_id,
                is_closed=is_closed,
                start_date=start_date,
                end_date=end_date
            )
            db.add(snap)

        snap.is_closed = is_closed
        snap.start_date = start_date
        snap.end_date = end_date
        snap.spi_score = computed_data['spi']['spi']
        snap.execution_score = computed_data['spi']['execution_score']
        snap.governance_score = computed_data['spi']['governance_score']
        snap.on_time_rate = computed_data['spi']['on_time_rate']
        snap.completion_rate = computed_data['spi']['completion_rate']
        snap.quality_rate = computed_data['spi']['quality_rate']
        snap.responsiveness_rate = computed_data['spi']['responsiveness_rate']

        snap.total_tasks = computed_data['overview']['total_tasks']
        snap.not_started_tasks = computed_data['overview']['not_started_tasks']
        snap.in_progress_tasks = computed_data['overview']['in_progress_tasks']
        snap.review_tasks = computed_data['overview']['review_tasks']
        snap.overdue_tasks = computed_data['overview']['overdue_tasks']
        snap.completed_tasks = computed_data['overview']['completed_tasks']
        snap.paused_tasks = computed_data['overview']['paused_tasks']

        snap.payload_data = computed_data
        snap.updated_at = datetime.now(timezone.utc)

        try:
            db.commit()
            db.refresh(snap)
        except Exception as e:
            db.rollback()
            logger.warning(f'[SnapshotManager] DB commit error: {e}')

        serialized = cls._serialize_snapshot(snap) if snap.id else computed_data
        _MEM_CACHE[cache_key] = {'data': serialized, '_cached_at': datetime.now(timezone.utc).timestamp()}
        return serialized

    @classmethod
    def _compute_full_snapshot_data(cls, db: Session, start_date: datetime, end_date: datetime, dept_id: Optional[int], period_type: str, period_key: str, is_closed: bool) -> Dict[str, Any]:
        all_query = db.query(Task).filter(
            (Task.created_at >= start_date) | (Task.due_date >= start_date),
            (Task.created_at <= end_date) | (Task.due_date <= end_date)
        )
        all_school_tasks = all_query.all()

        if dept_id:
            tasks = [t for t in all_school_tasks if t.leading_dept_id == dept_id or t.assisting_dept_id == dept_id]
        else:
            tasks = all_school_tasks

        now = datetime.now(timezone.utc)

        def is_overdue(t: Task) -> bool:
            if not t.due_date or t.status in [TaskStatus.HOAN_THANH, TaskStatus.HUY_BO, TaskStatus.TAM_DUNG]:
                return False
            due = t.due_date if t.due_date.tzinfo else t.due_date.replace(tzinfo=timezone.utc)
            return due < now

        total = len(tasks)
        completed = sum(1 for t in tasks if t.status == TaskStatus.HOAN_THANH)
        in_progress = sum(1 for t in tasks if t.status == TaskStatus.DANG_THUC_HIEN)
        review = sum(1 for t in tasks if t.status == TaskStatus.CHO_DUYET)
        not_started = sum(1 for t in tasks if t.status == TaskStatus.CHUA_BAT_DAU)
        paused = sum(1 for t in tasks if t.status in [TaskStatus.TAM_DUNG, TaskStatus.HUY_BO])
        overdue = sum(1 for t in tasks if is_overdue(t))

        # 1. Quality Rate Thực Tế (Số lần reject/trả hồ sơ)
        reject_query = db.query(TaskActionLog).filter(
            TaskActionLog.action.in_(['REJECT', 'REQUEST_CHANGES']),
            TaskActionLog.created_at >= start_date,
            TaskActionLog.created_at <= end_date
        )
        if dept_id:
            reject_query = reject_query.join(Task, Task.id == TaskActionLog.task_id).filter(Task.leading_dept_id == dept_id)
        total_rejects = reject_query.count()
        quality_rate = round(max(0.0, min(100.0, 100.0 - (total_rejects / max(1, total)) * 15.0)), 1)

        # 2. Responsiveness Rate Thực Tế (Thời gian tiếp nhận việc)
        assignments = db.query(TaskAssignment).filter(
            TaskAssignment.created_at >= start_date,
            TaskAssignment.created_at <= end_date
        ).all()
        if assignments:
            resp_scores = []
            for a in assignments:
                if a.accepted_at:
                    c_time = a.created_at if a.created_at.tzinfo else a.created_at.replace(tzinfo=timezone.utc)
                    a_time = a.accepted_at if a.accepted_at.tzinfo else a.accepted_at.replace(tzinfo=timezone.utc)
                    hours = max(0.0, (a_time - c_time).total_seconds() / 3600.0)
                    if hours <= 24:
                        resp_scores.append(100.0)
                    else:
                        resp_scores.append(max(0.0, 100.0 - ((hours - 24) / 24.0) * 10.0))
                elif a.status == TaskAssignmentStatus.TRANSFERRING:
                    c_time = a.created_at if a.created_at.tzinfo else a.created_at.replace(tzinfo=timezone.utc)
                    hours = max(0.0, (now - c_time).total_seconds() / 3600.0)
                    if hours > 24:
                        resp_scores.append(max(0.0, 100.0 - ((hours - 24) / 24.0) * 10.0))
                    else:
                        resp_scores.append(100.0)
            responsiveness_rate = round(sum(resp_scores) / max(1, len(resp_scores)), 1) if resp_scores else 100.0
        else:
            responsiveness_rate = 100.0

        # 3. SPI Calculation với 4 Trọng Số Thực Tế (40% + 25% + 20% + 15%)
        # 3. SPI Toàn Trường 5 Trụ Cột Thông Minh (v4.6.0)
        school_spi_dict = PeriodKpiEngine.calculate_school_spi(start_date, end_date, db)
        spi_val = school_spi_dict['spi']
        on_time_rate = school_spi_dict['on_time_rate']
        duration_efficiency = school_spi_dict['duration_efficiency']
        completion_rate = school_spi_dict['completion_rate']
        quality_rate = school_spi_dict['quality_rate']
        responsiveness_rate = school_spi_dict['responsiveness_rate']

        spi_data = {
            'spi': spi_val,
            'on_time_rate': on_time_rate,
            'duration_efficiency': duration_efficiency,
            'completion_rate': completion_rate,
            'quality_rate': quality_rate,
            'responsiveness_rate': responsiveness_rate,
            'execution_score': completion_rate,
            'governance_score': round(max(0.0, 100.0 - overdue * 10.0), 1)
        }

        # 4. 12 Depts ranking with Workload Index (Dữ liệu thực tế 100%)
        depts = db.query(Department).all()
        dept_rankings = []
        for d in depts:
            d_tasks = [t for t in all_school_tasks if t.leading_dept_id == d.id]
            d_total = len(d_tasks)
            d_done = sum(1 for t in d_tasks if t.status == TaskStatus.HOAN_THANH)
            d_doing = sum(1 for t in d_tasks if t.status == TaskStatus.DANG_THUC_HIEN)
            d_review = sum(1 for t in d_tasks if t.status == TaskStatus.CHO_DUYET)
            d_overdue = sum(1 for t in d_tasks if is_overdue(t))
            d_pct = round((d_done / d_total * 100.0), 1) if d_total > 0 else 0.0
            base_score = sum(float(t.base_score or 1.0) for t in d_tasks)

            # Department staff count & average workload index
            d_users = db.query(User).filter(User.department_id == d.id, User.is_active == True).all()
            d_user_count = max(1, len(d_users))
            d_active_tasks = d_doing + d_review + sum(1 for t in d_tasks if t.status == TaskStatus.CHUA_BAT_DAU)
            avg_workload = round((d_active_tasks / (d_user_count * 3.0)) * 100.0, 1) if d_user_count > 0 else 0.0
            exec_score = d_pct
            gov_score = round(max(0.0, 100.0 - (d_overdue / max(1, d_total)) * 100.0), 1) if d_total > 0 else 100.0

            dept_rankings.append({
                'dept_id': d.id,
                'dept_code': d.code,
                'dept_name': d.name,
                'pct_done': d_pct,
                'done_base': d_done,
                'doing_base': d_doing,
                'review_base': d_review,
                'overdue_base': d_overdue,
                'total_base': int(base_score),
                'exec_score': exec_score,
                'gov_score': gov_score,
                'tasks_count': d_total,
                'overdue_count': d_overdue,
                'avg_workload': avg_workload
            })

        # 5. Phân Tích 4 Nguyên Nhân Gốc Rễ Gây Trễ Hạn (Dữ liệu thực tế 100%, không fake baseline)
        approval_count = 0
        collab_count = 0
        overload_count = 0
        execution_count = 0

        # Lấy danh sách ID các cán bộ đang quá tải thực tế (>3 việc active)
        overloaded_user_ids = set(
            u.id for u in db.query(User).filter(User.is_active == True).all()
            if sum(1 for t in all_school_tasks if t.assignee_id == u.id and t.status in [TaskStatus.DANG_THUC_HIEN, TaskStatus.CHUA_BAT_DAU]) > 3
        )

        for t in tasks:
            is_task_late = is_overdue(t)
            is_pending_review = (t.status == TaskStatus.CHO_DUYET)
            if is_task_late or is_pending_review:
                if is_pending_review:
                    approval_count += 1
                elif getattr(t, 'collaborators', None) and len(t.collaborators) > 0:
                    collab_count += 1
                elif t.assignee_id and t.assignee_id in overloaded_user_ids:
                    overload_count += 1
                else:
                    execution_count += 1

        total_bottlenecks = approval_count + collab_count + overload_count + execution_count

        delay_root_causes = {
            'total_bottlenecks': total_bottlenecks,
            'approval': {
                'count': approval_count,
                'pct': round((approval_count / total_bottlenecks * 100.0), 1) if total_bottlenecks > 0 else 0.0,
                'label': 'Nghẽn Phê Duyệt (>48h)',
                'desc': 'Hồ sơ nằm chờ BGH / Trưởng đơn vị ký duyệt',
                'icon': 'fa-solid fa-clock-rotate-left',
                'color': '#f59e0b'
            },
            'collaboration': {
                'count': collab_count,
                'pct': round((collab_count / total_bottlenecks * 100.0), 1) if total_bottlenecks > 0 else 0.0,
                'label': 'Nghẽn Phối Hợp Liên Đơn Vị',
                'desc': 'Đơn vị phối hợp RACI chưa hoàn tất phần việc',
                'icon': 'fa-solid fa-handshake-angle',
                'color': '#8b5cf6'
            },
            'overload': {
                'count': overload_count,
                'pct': round((overload_count / total_bottlenecks * 100.0), 1) if total_bottlenecks > 0 else 0.0,
                'label': 'Nghẽn Nhân Sự Quá Tải (>120%)',
                'desc': 'Cán bộ phụ trách gánh vượt định mức 3 việc/người',
                'icon': 'fa-solid fa-users-gear',
                'color': '#f97316'
            },
            'execution': {
                'count': execution_count,
                'pct': round((execution_count / total_bottlenecks * 100.0), 1) if total_bottlenecks > 0 else 0.0,
                'label': 'Nghẽn Thực Thi Nội Bộ',
                'desc': 'Đơn vị chủ trì chậm tiến độ triển khai',
                'icon': 'fa-solid fa-triangle-exclamation',
                'color': '#ef4444'
            }
        }

        # 6. Ma Trận Phân Tán (Scatter Plot): Tải Công Việc vs Hiệu Suất SPI (12 Đơn Vị)
        scatter_data = []
        for d in dept_rankings:
            x_load = d.get('avg_workload', 0.0)
            y_spi = round(d.get('exec_score', 0.0) * 0.7 + d.get('gov_score', 100.0) * 0.3, 1)

            if x_load >= 70.0 and y_spi >= 75.0:
                quadrant = 'STAR'
                quadrant_label = 'Gánh việc xuất sắc (Nòng cốt)'
                quadrant_color = '#10b981'
            elif x_load >= 70.0 and y_spi < 75.0:
                quadrant = 'OVERLOAD'
                quadrant_label = 'Quá tải báo động (Cần trợ lực)'
                quadrant_color = '#f59e0b'
            elif x_load < 70.0 and y_spi >= 75.0:
                quadrant = 'STABLE'
                quadrant_label = 'Vận hành ổn định'
                quadrant_color = '#6366f1'
            else:
                quadrant = 'RISK'
                quadrant_label = 'Báo động hiệu suất / kỷ cương'
                quadrant_color = '#ef4444'

            scatter_data.append({
                'dept_id': d['dept_id'],
                'dept_code': d['dept_code'],
                'dept_name': d['dept_name'],
                'x_workload': x_load,
                'y_spi': y_spi,
                'tasks_count': d.get('tasks_count', 0),
                'overdue_count': d.get('overdue_count', 0),
                'quadrant': quadrant,
                'quadrant_label': quadrant_label,
                'color': quadrant_color
            })

        # 7. Đánh Giá Hiệu Suất Theo Quy Trình Chuẩn (Workflow SOP Performance)
        active_templates = db.query(WorkflowTemplate).filter(WorkflowTemplate.is_active == True).all()
        workflow_performance = []
        for wf in active_templates:
            wf_tasks = [t for t in all_school_tasks if t.workflow_template_id == wf.id or t.workflow_name == wf.name]
            w_total = len(wf_tasks)
            w_completed = sum(1 for t in wf_tasks if t.status == TaskStatus.HOAN_THANH)
            w_overdue = sum(1 for t in wf_tasks if is_overdue(t))
            w_rate = round((w_completed / w_total * 100.0), 1) if w_total > 0 else 0.0

            # Tính thời gian chu kỳ thực tế (ngày)
            cycle_days = 0.0
            if w_completed > 0:
                durations = []
                for t in wf_tasks:
                    if t.status == TaskStatus.HOAN_THANH and t.created_at:
                        c_at = t.created_at if t.created_at.tzinfo else t.created_at.replace(tzinfo=timezone.utc)
                        u_at = t.updated_at if (t.updated_at and t.updated_at.tzinfo) else (t.updated_at.replace(tzinfo=timezone.utc) if t.updated_at else now)
                        durations.append(max(0.1, (u_at - c_at).total_seconds() / 86400.0))
                if durations:
                    cycle_days = round(sum(durations) / len(durations), 1)

            workflow_performance.append({
                'id': wf.id,
                'code': wf.code,
                'name': wf.name,
                'dept_code': wf.department.code if wf.department else 'TOÀN TRƯỜNG',
                'steps_count': len(wf.steps) if wf.steps else 4,
                'tasks_count': w_total,
                'completed_count': w_completed,
                'overdue_count': w_overdue,
                'completion_rate': w_rate,
                'avg_cycle_days': cycle_days
            })

        # 8. Tiến độ nhiệm vụ trọng tâm / nhiệm vụ cha cấp trường (Parent Tasks Real Progress)
        parent_tasks = [t for t in tasks if t.parent_id is None]
        total_p = len(parent_tasks)
        good_p = sum(1 for t in parent_tasks if t.status == TaskStatus.HOAN_THANH or (t.progress_percent or 0.0) >= 70.0)
        bad_p = sum(1 for t in parent_tasks if is_overdue(t) or ((t.progress_percent or 0.0) < 30.0 and t.status == TaskStatus.DANG_THUC_HIEN))
        medium_p = max(0, total_p - good_p - bad_p)
        pct_good = round((good_p / total_p * 100.0), 1) if total_p > 0 else 0.0
        pct_medium = round((medium_p / total_p * 100.0), 1) if total_p > 0 else 0.0
        pct_bad = round((bad_p / total_p * 100.0), 1) if total_p > 0 else 0.0

        parent_donut = {
            'total_parent': total_p,
            'count_good': good_p,
            'count_medium': medium_p,
            'count_bad': bad_p,
            'pct_good': pct_good,
            'pct_medium': pct_medium,
            'pct_bad': pct_bad
        }

        # 8b. Cơ Cấu Mục Tiêu & Phân Loại Nhiệm Vụ Chuẩn 100% (Strategic vs Routine vs Proposal)
        strategic_tasks = [t for t in tasks if 'STRATEGIC' in str(t.type)]
        routine_tasks = [t for t in tasks if 'ROUTINE' in str(t.type) or 'SELF' in str(t.type) or 'ESCALATION' in str(t.type) or not t.type]
        proposal_tasks = [t for t in tasks if 'PROPOSAL' in str(t.type)]

        s_cnt = len(strategic_tasks)
        r_cnt = len(routine_tasks)
        p_cnt = len(proposal_tasks)

        classified_sum = s_cnt + r_cnt + p_cnt
        if total > classified_sum:
            r_cnt += (total - classified_sum)

        s_pct = round((s_cnt / total * 100.0), 1) if total > 0 else 0.0
        r_pct = round((r_cnt / total * 100.0), 1) if total > 0 else 0.0
        p_pct = round(max(0.0, 100.0 - s_pct - r_pct), 1) if total > 0 else 0.0

        task_structure = {
            'strategic_count': s_cnt,
            'strategic_pct': s_pct,
            'routine_count': r_cnt,
            'routine_pct': r_pct,
            'proposal_count': p_cnt,
            'proposal_pct': p_pct,
            'total_classified': total
        }

        # Cơ Cấu Mức Độ Ưu Tiên (Priority Structure Matrix)
        urgent_cnt = sum(1 for t in tasks if t.priority == TaskPriority.KHAN_CAP)
        high_cnt = sum(1 for t in tasks if t.priority == TaskPriority.CAO)
        medium_cnt = sum(1 for t in tasks if t.priority == TaskPriority.TRUNG_BINH)
        low_cnt = sum(1 for t in tasks if t.priority == TaskPriority.THAP)

        u_pct = round((urgent_cnt / total * 100.0), 1) if total > 0 else 0.0
        h_pct = round((high_cnt / total * 100.0), 1) if total > 0 else 0.0
        m_pct = round((medium_cnt / total * 100.0), 1) if total > 0 else 0.0
        l_pct = round(max(0.0, 100.0 - u_pct - h_pct - m_pct), 1) if total > 0 else 0.0

        priority_structure = {
            'urgent_count': urgent_cnt,
            'urgent_pct': u_pct,
            'high_count': high_cnt,
            'high_pct': h_pct,
            'medium_count': medium_cnt,
            'medium_pct': m_pct,
            'low_count': low_cnt,
            'low_pct': l_pct,
            'total_classified': total
        }

        # 9. Biểu Đồ Xu Hướng SPI (Truy vấn lịch sử Snapshot thực tế từ DB, NULL != 0)
        if period_type == 'QUARTER':
            trend_keys = ['2025-Q4', '2026-Q1', '2026-Q2', '2026-Q3']
            chart_labels = ['Q4/25', 'Q1/26', 'Q2/26', 'Q3/26']
            chart_title = 'Xu Hướng SPI 4 Quý Gần Nhất'
        elif period_type == 'YEAR':
            trend_keys = ['2024-2025', '2025-2026', '2026-2027']
            chart_labels = ['2024-2025', '2025-2026', '2026-2027']
            chart_title = 'Xu Hướng SPI Các Năm Học'
        else:
            trend_keys = ['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09']
            chart_labels = ['T4/26', 'T5/26', 'T6/26', 'T7/26', 'T8/26', 'T9/26']
            chart_title = 'Xu Hướng SPI 6 Tháng Gần Nhất'

        chart_data = []
        for k in trend_keys:
            if k == period_key:
                chart_data.append(spi_data.get('spi', 0.0) if total > 0 else None)
            else:
                snap_rec = db.query(KpiPeriodSnapshot).filter(
                    KpiPeriodSnapshot.period_type == period_type,
                    KpiPeriodSnapshot.period_key == k
                ).first()
                if snap_rec and snap_rec.payload_data and 'spi' in snap_rec.payload_data:
                    snap_t = snap_rec.payload_data.get('overview', {}).get('total_tasks', 0)
                    if snap_t > 0:
                        chart_data.append(snap_rec.payload_data['spi'].get('spi', 0.0))
                    else:
                        chart_data.append(None)
                else:
                    chart_data.append(None)

        return {
            'period_type': period_type,
            'period_key': period_key,
            'is_closed': is_closed,
            'start_date': start_date.isoformat(),
            'end_date': end_date.isoformat(),
            'spi': spi_data,
            'overview': {
                'total_tasks': total,
                'completed_tasks': completed,
                'in_progress_tasks': in_progress,
                'review_tasks': review,
                'not_started_tasks': not_started,
                'overdue_tasks': overdue,
                'paused_tasks': paused,
                'completion_rate': round(completed / total * 100, 1) if total > 0 else 0
            },
            'dept_rankings': dept_rankings,
            'delay_root_causes': delay_root_causes,
            'scatter_data': scatter_data,
            'workflow_performance': workflow_performance,
            'line_chart': {
                'title': chart_title,
                'labels': chart_labels,
                'datasets': [{'data': chart_data, 'borderColor': '#4f46e5'}]
            },
            'parent_donut': parent_donut,
            'task_structure': task_structure,
            'priority_structure': priority_structure,
            'flow_intelligence': compute_flow_intelligence(
                db=db,
                period_type=period_type,
                period_key=period_key,
                unit_id=dept_id
            )
        }

    @classmethod
    def _serialize_snapshot(cls, snap: KpiPeriodSnapshot) -> Dict[str, Any]:
        if snap.payload_data:
            data = dict(snap.payload_data)
            data['is_closed'] = snap.is_closed
            data['updated_at'] = snap.updated_at.isoformat() if snap.updated_at else None
            return data

        return {
            'period_type': snap.period_type,
            'period_key': snap.period_key,
            'is_closed': snap.is_closed,
            'start_date': snap.start_date.isoformat() if snap.start_date else None,
            'end_date': snap.end_date.isoformat() if snap.end_date else None,
            'spi': {
                'spi': snap.spi_score,
                'execution_score': snap.execution_score,
                'governance_score': snap.governance_score,
                'on_time_rate': snap.on_time_rate,
                'completion_rate': snap.completion_rate,
                'quality_rate': snap.quality_rate,
                'responsiveness_rate': snap.responsiveness_rate
            },
            'overview': {
                'total_tasks': snap.total_tasks,
                'completed_tasks': snap.completed_tasks,
                'in_progress_tasks': snap.in_progress_tasks,
                'review_tasks': snap.review_tasks,
                'not_started_tasks': snap.not_started_tasks,
                'overdue_tasks': snap.overdue_tasks,
                'paused_tasks': snap.paused_tasks,
                'completion_rate': snap.completion_rate
            }
        }

    @classmethod
    def invalidate_target_periods_for_task(cls, db: Session, task: Any, old_date: Optional[datetime] = None):
        """
        Tự động xác định và tính lại Snapshot của Tháng đó, Quý đó, Năm đó
        khi Admin/Cán bộ chỉnh sửa hoặc tạo nhiệm vụ ở bất kỳ mốc ngày nào.
        """
        dates_to_check = []
        if getattr(task, 'created_at', None):
            dates_to_check.append(task.created_at)
        if getattr(task, 'due_date', None):
            dates_to_check.append(task.due_date)
        if old_date:
            dates_to_check.append(old_date)

        global _MEM_CACHE
        for d in dates_to_check:
            if not d:
                continue
            dt = d if d.tzinfo else d.replace(tzinfo=timezone.utc)
            y, m = dt.year, dt.month
            q = (m - 1) // 3 + 1
            start_y = y if m >= 9 else y - 1
            end_y = start_y + 1

            month_key = f"{y}-{m:02d}"
            quarter_key = f"{y}-Q{q}"
            year_key = f"{start_y}-{end_y}"

            # Xóa cache RAM
            keys_to_del = [k for k in list(_MEM_CACHE.keys()) if month_key in k or quarter_key in k or year_key in k]
            for k in keys_to_del:
                _MEM_CACHE.pop(k, None)

            # Tính lại và lưu Snapshot trong DB ngay
            try:
                cls.get_or_compute_snapshot(db, period_type="MONTH", period_key=month_key, dept_id=None, force_refresh=True)
                cls.get_or_compute_snapshot(db, period_type="QUARTER", period_key=quarter_key, dept_id=None, force_refresh=True)
                cls.get_or_compute_snapshot(db, period_type="YEAR", period_key=year_key, dept_id=None, force_refresh=True)
                
                leading_dept = getattr(task, 'leading_dept_id', None)
                if leading_dept:
                    cls.get_or_compute_snapshot(db, period_type="MONTH", period_key=month_key, dept_id=leading_dept, force_refresh=True)
                    cls.get_or_compute_snapshot(db, period_type="QUARTER", period_key=quarter_key, dept_id=leading_dept, force_refresh=True)
                    cls.get_or_compute_snapshot(db, period_type="YEAR", period_key=year_key, dept_id=leading_dept, force_refresh=True)
            except Exception as e:
                logger.warning(f"[SnapshotManager] Auto-recompute target snapshot error: {e}")

        logger.info(f"[SnapshotManager] Successfully synchronized snapshots for task #{getattr(task, 'id', 'N/A')}")

    @classmethod
    def list_period_snapshots(cls, db: Session, period_type: str = "MONTH") -> List[Dict[str, Any]]:
        p_type = (period_type or "MONTH").upper()
        now = datetime.now(timezone.utc)
        y = now.year

        # Đảm bảo các kỳ hiện hành đã được tính toán
        if p_type == "MONTH":
            for m in range(1, 13):
                m_key = f"{y}-{m:02d}"
                cls.get_or_compute_snapshot(db, period_type="MONTH", period_key=m_key, dept_id=None, force_refresh=False)
        elif p_type == "QUARTER":
            for q in range(1, 5):
                q_key = f"{y}-Q{q}"
                cls.get_or_compute_snapshot(db, period_type="QUARTER", period_key=q_key, dept_id=None, force_refresh=False)
        elif p_type == "YEAR":
            for y_offset in range(-2, 1):
                sy = y + y_offset
                y_key = f"{sy}-{sy+1}"
                cls.get_or_compute_snapshot(db, period_type="YEAR", period_key=y_key, dept_id=None, force_refresh=False)

        snapshots = db.query(KpiPeriodSnapshot).filter(
            KpiPeriodSnapshot.period_type == p_type,
            KpiPeriodSnapshot.department_id == None
        ).order_by(KpiPeriodSnapshot.start_date.desc()).all()

        return [cls._serialize_snapshot(s) for s in snapshots]

    @classmethod
    def toggle_period_lock(cls, db: Session, period_type: str, period_key: str) -> Dict[str, Any]:
        p_type = (period_type or "MONTH").upper()
        snap = db.query(KpiPeriodSnapshot).filter(
            KpiPeriodSnapshot.period_type == p_type,
            KpiPeriodSnapshot.period_key == period_key,
            KpiPeriodSnapshot.department_id == None
        ).first()

        if not snap:
            cls.get_or_compute_snapshot(db, period_type=p_type, period_key=period_key, dept_id=None, force_refresh=True)
            snap = db.query(KpiPeriodSnapshot).filter(
                KpiPeriodSnapshot.period_type == p_type,
                KpiPeriodSnapshot.period_key == period_key,
                KpiPeriodSnapshot.department_id == None
            ).first()

        if snap:
            snap.is_closed = not snap.is_closed
            snap.updated_at = datetime.now(timezone.utc)
            db.commit()
            db.refresh(snap)

        cls.invalidate_active_snapshots(db)
        return cls._serialize_snapshot(snap) if snap else {}

    @classmethod
    def invalidate_active_snapshots(cls, db: Optional[Session] = None):
        global _MEM_CACHE
        _MEM_CACHE.clear()
        logger.info('[SnapshotManager] Active snapshots cache invalidated via event hook.')

