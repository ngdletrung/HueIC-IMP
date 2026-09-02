/**
 * DashboardHub v2.6.0 - HueIC Master Executive Portal Controller
 * Central Command Hub: Aggregates Macro KPIs across Tasks, Calendar, Assets, Documents
 */
const DashboardHub = {
    allTasks: [],
    departments: [],
    selectedDeptId: null,

    async init() {
        Common.init('dashboard');

        await this.loadDepartments();
        await this.loadData();
    },

    async loadDepartments() {
        try {
            this.departments = await API.getDepartments();
            const count = Array.isArray(this.departments) ? this.departments.length : 0;
            const sel = document.getElementById('portalDeptFilter');
            if (sel) {
                sel.innerHTML = `<option value="">🏢 Cấp Toàn Trường (${count} Đơn vị)</option>` +
                    this.departments.map(d => `<option value="${d.id}">[${d.code}] ${d.name}</option>`).join('');
            }
            const textEl = document.getElementById('portalScopeText');
            if (textEl && !this.selectedDeptId) {
                textEl.innerText = `Cấp Toàn Trường (${count} Đơn vị)`;
            }
        } catch (e) {
            console.error('[DashboardHub] Error loading departments:', e);
            this.departments = [];
        }
    },

    async loadData() {
        try {
            const params = {};
            if (this.selectedDeptId) {
                params.department_id = this.selectedDeptId;
            }
            this.allTasks = await API.getTasks(params);
        } catch (e) {
            console.error('[DashboardHub] Error loading tasks:', e);
            this.allTasks = [];
        }

        this.renderMacroKPIs();
        this.renderActionQueue();
        this.renderDeptProgress();
        this.renderUpcomingCalendar();
        this.loadKpiMetrics();
    },

    async loadKpiMetrics() {
        try {
            // 1. Chỉ số SPI Toàn trường
            const spiRes = await API.getSchoolSPI();
            if (spiRes) {
                const elSpi = document.getElementById('spiValue');
                const elOnTime = document.getElementById('spiOnTime');
                const elQuality = document.getElementById('spiQuality');
                if (elSpi) elSpi.innerText = `${spiRes.spi || 0}%`;
                if (elOnTime) elOnTime.innerText = `${spiRes.on_time_rate || 0}%`;
                if (elQuality) elQuality.innerText = `${spiRes.quality_rate || 0}%`;
            }

            // 2. KPI Cá Nhân
            const kpiRes = await API.getPersonalKPI();
            if (kpiRes) {
                const elVal = document.getElementById('userKpiValue');
                const elRank = document.getElementById('userKpiRank');
                const elExec = document.getElementById('userExecRate');
                const elBonus = document.getElementById('userProposalBonus');
                const elBase = document.getElementById('userActualBase');
                const elTotal = document.getElementById('userTotalTasks');
                const elDone = document.getElementById('userCompletedTasks');

                if (elVal) elVal.innerText = `${kpiRes.kpi || 0}%`;
                if (elRank) {
                    elRank.innerText = kpiRes.rank || 'Chưa chốt';
                    if (kpiRes.kpi >= 110) elRank.className = 'text-[11px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-900';
                    else if (kpiRes.kpi >= 95) elRank.className = 'text-[11px] font-bold px-1.5 py-0.2 rounded bg-green-100 text-green-900';
                    else if (kpiRes.kpi >= 80) elRank.className = 'text-[11px] font-bold px-1.5 py-0.2 rounded bg-blue-100 text-blue-900';
                    else elRank.className = 'text-[11px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-900';
                }
                if (elExec) elExec.innerText = `${kpiRes.execution_rate || 0}%`;
                if (elBonus) elBonus.innerText = `+${kpiRes.proposal_bonus || 0}đ`;
                if (elBase) elBase.innerText = `${kpiRes.total_actual_score || 0} / ${kpiRes.total_base_score || 0}`;
                if (elTotal) elTotal.innerText = kpiRes.total_tasks || 0;
                if (elDone) elDone.innerText = kpiRes.completed_tasks || 0;
            }
        } catch (e) {
            console.warn('[DashboardHub] Could not load KPI metrics:', e);
        }
    },

    handleScopeChange() {
        const sel = document.getElementById('portalDeptFilter');
        const textEl = document.getElementById('portalScopeText');
        if (!sel) return;

        this.selectedDeptId = sel.value ? parseInt(sel.value) : null;
        if (textEl) {
            if (this.selectedDeptId) {
                const d = this.departments.find(item => item.id === this.selectedDeptId);
                textEl.innerText = d ? `Đơn vị: ${d.name} (${d.code})` : 'Đơn vị đã chọn';
            } else {
                const count = Array.isArray(this.departments) ? this.departments.length : 0;
                textEl.innerText = `Cấp Toàn Trường (${count} Đơn vị)`;
            }
        }
        this.loadData();
    },

    renderMacroKPIs() {
        const total = this.allTasks.length;
        const done = this.allTasks.filter(t => t.status === 'HOAN_THANH').length;
        const rate = total > 0 ? Math.round((done / total) * 100) : 0;

        let overdue = 0;
        let todayEvents = 0;
        let weekEvents = 0;

        const todayStr = new Date().toISOString().split('T')[0];
        const next7Days = new Date();
        next7Days.setDate(next7Days.getDate() + 7);
        const next7Str = next7Days.toISOString().split('T')[0];

        this.allTasks.forEach(t => {
            if (t.due_date) {
                const dStr = t.due_date.split('T')[0];
                if (dStr === todayStr) todayEvents++;
                if (dStr >= todayStr && dStr <= next7Str) weekEvents++;
            }
            if (t.status !== 'HOAN_THANH' && t.due_date) {
                const ds = typeof Common !== 'undefined' && Common.getDeadlineStatus 
                    ? Common.getDeadlineStatus(t.due_date, false)
                    : { isOverdue: new Date(t.due_date) < new Date() };
                if (ds.isOverdue) overdue++;
            }
        });

        const setT = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };
        setT('statTotalTasks', total);
        setT('statRate', rate + '%');
        setT('statOverdueBadge', `${overdue} trễ hạn`);
        setT('statTodayEvents', todayEvents);
        setT('statWeekEvents', `${weekEvents} lịch trình`);

        const badge = document.getElementById('navBadgeTasks');
        if (badge) {
            if (overdue > 0) {
                badge.innerText = overdue;
                badge.classList.remove('hidden');
            } else {
                badge.classList.add('hidden');
            }
        }
    },

    renderActionQueue() {
        const container = document.getElementById('portalActionQueue');
        if (!container) return;

        const actionItems = [];
        this.allTasks.forEach(t => {
            if (t.status === 'HOAN_THANH' || t.status === 'HUY_BO') return;
            const ds = typeof Common !== 'undefined' && Common.getDeadlineStatus 
                ? Common.getDeadlineStatus(t.due_date, false)
                : { isOverdue: false, isDueSoon: false };

            if (ds.isOverdue || t.status === 'TRE_HAN') {
                actionItems.push({ task: t, type: 'overdue', priority: 1 });
            } else if (t.status === 'CHO_DUYET') {
                actionItems.push({ task: t, type: 'pending_approval', priority: 2 });
            } else if (ds.isDueSoon) {
                actionItems.push({ task: t, type: 'due_soon', priority: 3 });
            }
        });

        actionItems.sort((a, b) => a.priority - b.priority);

        if (actionItems.length === 0) {
            container.innerHTML = `
                <div class="p-4 bg-[#E7F3EC] border border-[#3B8B6E]/30 rounded-xl text-center">
                    <i class="fa-solid fa-circle-check text-[#3B8B6E] text-lg mb-1 block"></i>
                    <p class="text-xs font-bold text-[#3B8B6E]">Không có điểm nghẽn tiến độ nào</p>
                    <p class="text-[11px] text-[#5B6472]">Tất cả các nhiệm vụ đang vận hành đúng tiến độ cam kết.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = actionItems.slice(0, 3).map(item => {
            const t = item.task;
            const isOd = item.type === 'overdue';
            const isAppr = item.type === 'pending_approval';

            const bgClass = isOd ? 'bg-[#FBE9E7] border-[#B3261E]/40 text-[#B3261E]' : 
                           (isAppr ? 'bg-[#FBF0DF] border-[#C17817]/40 text-[#C17817]' : 'bg-[#E4F1F0] border-[#0E7C7B]/40 text-[#0E7C7B]');
            
            const badgeLabel = isOd ? '🚨 Quá hạn cần đôn đốc' : (isAppr ? '🟡 Chờ nghiệm thu' : '⏳ Sắp đến hạn');
            const deptCode = t.leading_department ? `[${t.leading_department.code}]` : '[HueIC]';

            return `
                <div onclick="window.location.href='tasks.html?task_id=${t.id}'" class="p-3 rounded-xl border ${bgClass} cursor-pointer hover:shadow-xs transition flex items-center justify-between gap-3">
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-1.5 mb-1">
                            <span class="text-[10px] font-bold px-1.5 py-0.2 rounded bg-white font-mono">${deptCode}</span>
                            <span class="text-[10.5px] font-bold">${badgeLabel}</span>
                        </div>
                        <div class="font-bold text-xs text-[#16233D] truncate">${t.title}</div>
                        <div class="text-[10.5px] text-[#5B6472] mt-0.5">${t.assignee ? `Cán bộ: ${t.assignee.full_name}` : 'Chưa phân công'} · Hạn: ${t.due_date ? t.due_date.split('T')[0] : 'Không có'}</div>
                    </div>
                    <div class="text-right shrink-0">
                        <span class="text-xs font-bold font-mono text-[#16233D]">${t.progress_percent || 0}%</span>
                        <div class="text-[10px] text-[#0E7C7B] font-bold flex items-center gap-0.5 mt-1">
                            <span>Chỉ đạo</span>
                            <i class="fa-solid fa-chevron-right text-[8px]"></i>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    },

    renderDeptProgress() {
        const container = document.getElementById('portalDeptProgress');
        if (!container) return;

        // Group tasks by leading department
        const deptMap = {};
        this.departments.forEach(d => {
            deptMap[d.id] = { id: d.id, code: d.code, name: d.name, total: 0, sumProgress: 0, overdue: 0 };
        });

        this.allTasks.forEach(t => {
            const did = t.leading_department_id;
            if (deptMap[did]) {
                deptMap[did].total++;
                deptMap[did].sumProgress += (t.progress_percent || 0);
                if (t.status !== 'HOAN_THANH' && t.due_date) {
                    const ds = typeof Common !== 'undefined' && Common.getDeadlineStatus 
                        ? Common.getDeadlineStatus(t.due_date, false)
                        : { isOverdue: false };
                    if (ds.isOverdue) deptMap[did].overdue++;
                }
            }
        });

        const activeUnits = Object.values(deptMap)
            .filter(d => d.total > 0)
            .map(d => ({
                ...d,
                avg: Math.round(d.sumProgress / d.total)
            }))
            .sort((a, b) => b.avg - a.avg);

        if (activeUnits.length === 0) {
            container.innerHTML = `<div class="p-3 text-center text-xs text-[#5B6472] italic">Chưa có dữ liệu phân công công việc các đơn vị.</div>`;
            return;
        }

        container.innerHTML = activeUnits.slice(0, 4).map(d => {
            const barColor = d.avg >= 80 ? 'bg-[#3B8B6E]' : (d.avg >= 50 ? 'bg-[#0E7C7B]' : 'bg-[#C17817]');
            return `
                <div class="space-y-1">
                    <div class="flex items-center justify-between text-xs">
                        <span class="font-bold text-[#16233D]">[${d.code}] ${d.name} <span class="font-normal text-[#5B6472]">(${d.total} việc)</span></span>
                        <span class="font-mono font-bold text-[#16233D]">${d.avg}%</span>
                    </div>
                    <div class="w-full bg-[#E4E1D8] h-2 rounded-full overflow-hidden">
                        <div class="h-full rounded-full ${barColor}" style="width: ${d.avg}%"></div>
                    </div>
                </div>
            `;
        }).join('');
    },

    renderUpcomingCalendar() {
        const container = document.getElementById('portalUpcomingEvents');
        if (!container) return;

        const events = this.allTasks
            .filter(t => t.due_date)
            .map(t => ({
                task: t,
                date: new Date(t.due_date)
            }))
            .sort((a, b) => a.date - b.date)
            .slice(0, 4);

        if (events.length === 0) {
            container.innerHTML = `
                <div class="p-4 text-center text-xs text-[#5B6472] italic">
                    <i class="fa-regular fa-calendar-check text-2xl text-[#C7C2B4] mb-1.5 block"></i>
                    Không có lịch trình trọng tâm nào sắp tới.
                </div>
            `;
            return;
        }

        container.innerHTML = events.map(ev => {
            const t = ev.task;
            const d = ev.date;
            const dateStr = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
            const dayName = d.toLocaleDateString('vi-VN', { weekday: 'short' });

            return `
                <div onclick="window.location.href='calendar.html'" class="flex items-center gap-3 p-2.5 bg-[#FBFAF7] hover:bg-[#F1F0EB] rounded-xl border border-[#E4E1D8] cursor-pointer transition">
                    <div class="w-11 h-11 rounded-lg bg-[#FFFFFF] border border-[#E4E1D8] flex flex-col items-center justify-center shrink-0 shadow-xs">
                        <span class="text-[9px] font-bold text-[#0E7C7B] uppercase">${dayName}</span>
                        <span class="font-manrope font-extrabold text-sm text-[#16233D] leading-none">${dateStr}</span>
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="font-bold text-xs text-[#16233D] truncate">${t.title}</div>
                        <div class="text-[10.5px] text-[#5B6472] mt-0.5">
                            <span class="font-semibold text-[#0E7C7B]">${t.leading_department ? `[${t.leading_department.code}]` : ''}</span>
                            <span>${t.assignee ? `· ${t.assignee.full_name}` : ''}</span>
                        </div>
                    </div>
                    <i class="fa-solid fa-chevron-right text-xs text-[#8B96AC]"></i>
                </div>
            `;
        }).join('');
    }
};

document.addEventListener('DOMContentLoaded', () => DashboardHub.init());
