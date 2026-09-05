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
        this.renderAnalyticsCharts();
    },

    async renderAnalyticsCharts() {
        try {
            const [analyticsData, alertsData] = await Promise.all([
                API.getAnalyticsDashboard(this.selectedDeptId),
                API.getWorkloadAlerts(this.selectedDeptId)
            ]);

            this.renderLineTrendChart(analyticsData ? analyticsData.line_chart : null);
            this.renderStackedBaseScoreChart(analyticsData ? analyticsData.stacked_bar_chart : null);
            this.renderPriorityMetricCards(analyticsData ? analyticsData.priority_metrics : null);
            this.renderParentTaskDonut(analyticsData ? analyticsData.parent_donut : null);
            this.renderOperationalAlertsWidget(alertsData);
        } catch (e) {
            console.warn('[DashboardHub] Error loading analytics charts:', e);
        }
    },

    // 1. LINE CHART: XU HƯỚNG KPI / SPI THEO THÁNG
    renderLineTrendChart(lineData) {
        const container = document.getElementById('analyticsLineChartContainer');
        if (!container || !lineData) return;

        const labels = lineData.labels || [];
        const datasets = lineData.datasets || [];
        if (labels.length === 0 || datasets.length === 0) return;

        // Render SVG Line Chart mượt mà
        const width = 500;
        const height = 180;
        const padding = 35;

        let allValues = [];
        datasets.forEach(ds => allValues.push(...ds.data));
        const minVal = Math.max(0, Math.min(...allValues) - 10);
        const maxVal = Math.min(120, Math.max(...allValues) + 10);
        const range = (maxVal - minVal) || 1;

        const getX = (idx) => padding + (idx / (labels.length - 1)) * (width - 2 * padding);
        const getY = (val) => height - padding - ((val - minVal) / range) * (height - 2 * padding);

        const svgPaths = datasets.map(ds => {
            const points = ds.data.map((val, idx) => `${getX(idx)},${getY(val)}`);
            const d = points.reduce((acc, pt, i) => i === 0 ? `M ${pt}` : `${acc} L ${pt}`, '');
            const circles = ds.data.map((val, idx) => `
                <circle cx="${getX(idx)}" cy="${getY(val)}" r="4" fill="${ds.borderColor}" stroke="#ffffff" stroke-width="2">
                    <title>${ds.label}: ${val}% (${labels[idx]})</title>
                </circle>
                <text x="${getX(idx)}" y="${getY(val) - 8}" text-anchor="middle" font-size="10" font-weight="bold" fill="${ds.borderColor}">${val}%</text>
            `).join('');
            return `
                <path d="${d}" fill="none" stroke="${ds.borderColor}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
                ${circles}
            `;
        }).join('');

        const xLabelsSvg = labels.map((lbl, idx) => `
            <text x="${getX(idx)}" y="${height - 10}" text-anchor="middle" font-size="10" font-weight="bold" fill="#64748b">${lbl}</text>
        `).join('');

        container.innerHTML = `
            <div class="space-y-2">
                <div class="flex flex-wrap items-center justify-between gap-2">
                    <h4 class="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                        <i class="fa-solid fa-chart-line text-blue-700"></i>
                        <span>${lineData.title}</span>
                    </h4>
                    <div class="flex items-center gap-3 text-[11px] font-semibold">
                        ${datasets.map(ds => `
                            <span class="flex items-center gap-1">
                                <span class="w-2.5 h-2.5 rounded-full" style="background-color: ${ds.borderColor}"></span>
                                <span class="text-slate-700">${ds.label}</span>
                            </span>
                        `).join('')}
                    </div>
                </div>
                <div class="w-full overflow-x-auto bg-slate-50/50 rounded-xl p-2 border border-slate-100">
                    <svg viewBox="0 0 ${width} ${height}" class="w-full h-44">
                        <!-- Grid lines -->
                        <line x1="${padding}" y1="${padding}" x2="${width - padding}" y2="${padding}" stroke="#e2e8f0" stroke-dasharray="3,3" />
                        <line x1="${padding}" y1="${height / 2}" x2="${width - padding}" y2="${height / 2}" stroke="#e2e8f0" stroke-dasharray="3,3" />
                        <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" stroke="#cbd5e1" stroke-width="1.5" />
                        ${svgPaths}
                        ${xLabelsSvg}
                    </svg>
                </div>
            </div>
        `;
    },

    // 2. STACKED BAR CHART: TIẾN ĐỘ THEO TỔNG BASE SCORE
    renderStackedBaseScoreChart(stackedData) {
        const container = document.getElementById('analyticsStackedBarContainer');
        if (!container || !stackedData) return;

        const activeUnits = stackedData.filter(d => d.total_base > 0);
        if (activeUnits.length === 0) {
            container.innerHTML = `<div class="p-4 text-center text-xs text-slate-500 italic">Chưa có nhiệm vụ gán Base Score cho các đơn vị.</div>`;
            return;
        }

        container.innerHTML = `
            <div class="space-y-2.5">
                <div class="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100">
                    <h4 class="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                        <i class="fa-solid fa-bars-progress text-indigo-700"></i>
                        <span>Tiến Độ 12 Đơn Vị Theo Tổng Điểm Chuẩn (Base Score)</span>
                    </h4>
                    <!-- Legend -->
                    <div class="flex flex-wrap items-center gap-2.5 text-[10.5px] font-semibold text-slate-600">
                        <span class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-xs bg-emerald-600"></span><span>Hoàn thành</span></span>
                        <span class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-xs bg-blue-500"></span><span>Đang làm</span></span>
                        <span class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-xs bg-amber-400"></span><span>Chờ duyệt</span></span>
                        <span class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-xs bg-rose-500"></span><span>Quá hạn</span></span>
                    </div>
                </div>

                <div class="space-y-2 text-xs">
                    ${activeUnits.map(u => {
                        const total = u.total_base || 1;
                        const pctDone = (u.done_base / total) * 100;
                        const pctDoing = (u.doing_base / total) * 100;
                        const pctReview = (u.review_base / total) * 100;
                        const pctOverdue = (u.overdue_base / total) * 100;

                        return `
                            <div class="space-y-1">
                                <div class="flex items-center justify-between">
                                    <span class="font-bold text-slate-800">[${u.code}] ${u.name}</span>
                                    <span class="font-mono text-slate-600">
                                        <b class="text-emerald-700 font-bold">${u.done_base}</b> / ${u.total_base}đ (<b class="text-slate-900">${u.pct_done}%</b>)
                                    </span>
                                </div>
                                <div class="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden flex shadow-2xs">
                                    <div style="width: ${pctDone}%" class="bg-emerald-600 h-full transition-all duration-500" title="Hoàn thành: ${u.done_base}đ (${Math.round(pctDone)}%)"></div>
                                    <div style="width: ${pctDoing}%" class="bg-blue-500 h-full transition-all duration-500" title="Đang làm: ${u.doing_base}đ (${Math.round(pctDoing)}%)"></div>
                                    <div style="width: ${pctReview}%" class="bg-amber-400 h-full transition-all duration-500" title="Chờ duyệt: ${u.review_base}đ (${Math.round(pctReview)}%)"></div>
                                    <div style="width: ${pctOverdue}%" class="bg-rose-500 h-full transition-all duration-500" title="Quá hạn: ${u.overdue_base}đ (${Math.round(pctOverdue)}%)"></div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    },

    // 3. METRIC CARDS: CƠ CẤU CÔNG VIỆC THEO 4 MỨC ƯU TIÊN
    renderPriorityMetricCards(priorityData) {
        const container = document.getElementById('analyticsPriorityCardsContainer');
        if (!container || !priorityData) return;

        const pUrgent = priorityData.urgent || { count: 0, pct: 0 };
        const pHigh = priorityData.high || { count: 0, pct: 0 };
        const pMed = priorityData.medium || { count: 0, pct: 0 };
        const pLow = priorityData.low || { count: 0, pct: 0 };

        container.innerHTML = `
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <!-- Khẩn cấp -->
                <div class="p-3 bg-gradient-to-b from-white to-rose-50/50 border border-rose-200/90 rounded-2xl shadow-2xs">
                    <div class="flex items-center justify-between text-rose-800 text-[11px] font-bold">
                        <span>🔥 Khẩn Cấp (P5)</span>
                        <i class="fa-solid fa-triangle-exclamation"></i>
                    </div>
                    <div class="flex items-baseline space-x-1.5 my-1.5">
                        <span class="font-manrope font-black text-xl text-rose-900">${pUrgent.count}</span>
                        <span class="text-xs font-semibold text-rose-700">(${pUrgent.pct}%)</span>
                    </div>
                    <div class="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                        <div class="bg-rose-600 h-full rounded-full" style="width: ${pUrgent.pct}%"></div>
                    </div>
                </div>

                <!-- Cao -->
                <div class="p-3 bg-gradient-to-b from-white to-amber-50/50 border border-amber-200/90 rounded-2xl shadow-2xs">
                    <div class="flex items-center justify-between text-amber-800 text-[11px] font-bold">
                        <span>⚡ Cao (P3)</span>
                        <i class="fa-solid fa-bolt"></i>
                    </div>
                    <div class="flex items-baseline space-x-1.5 my-1.5">
                        <span class="font-manrope font-black text-xl text-amber-900">${pHigh.count}</span>
                        <span class="text-xs font-semibold text-amber-700">(${pHigh.pct}%)</span>
                    </div>
                    <div class="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                        <div class="bg-amber-500 h-full rounded-full" style="width: ${pHigh.pct}%"></div>
                    </div>
                </div>

                <!-- Trung bình -->
                <div class="p-3 bg-gradient-to-b from-white to-blue-50/50 border border-blue-200/90 rounded-2xl shadow-2xs">
                    <div class="flex items-center justify-between text-blue-800 text-[11px] font-bold">
                        <span>🔷 Trung Bình (P2)</span>
                        <i class="fa-solid fa-circle-dot"></i>
                    </div>
                    <div class="flex items-baseline space-x-1.5 my-1.5">
                        <span class="font-manrope font-black text-xl text-blue-900">${pMed.count}</span>
                        <span class="text-xs font-semibold text-blue-700">(${pMed.pct}%)</span>
                    </div>
                    <div class="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                        <div class="bg-blue-600 h-full rounded-full" style="width: ${pMed.pct}%"></div>
                    </div>
                </div>

                <!-- Thấp -->
                <div class="p-3 bg-gradient-to-b from-white to-slate-50/50 border border-slate-200/90 rounded-2xl shadow-2xs">
                    <div class="flex items-center justify-between text-slate-700 text-[11px] font-bold">
                        <span>⚪ Thấp (P1)</span>
                        <i class="fa-solid fa-arrow-down"></i>
                    </div>
                    <div class="flex items-baseline space-x-1.5 my-1.5">
                        <span class="font-manrope font-black text-xl text-slate-800">${pLow.count}</span>
                        <span class="text-xs font-semibold text-slate-500">(${pLow.pct}%)</span>
                    </div>
                    <div class="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                        <div class="bg-slate-400 h-full rounded-full" style="width: ${pLow.pct}%"></div>
                    </div>
                </div>
            </div>
        `;
    },

    // 4. DONUT CHART: SỨC KHỎE NHIỆM VỤ TRỌNG TÂM / TASK CHA
    renderParentTaskDonut(donutData) {
        const container = document.getElementById('analyticsParentDonutContainer');
        if (!container || !donutData) return;

        const total = donutData.total_parents || 0;
        const high = donutData.high_count || 0;
        const med = donutData.med_count || 0;
        const low = donutData.low_count || 0;

        container.innerHTML = `
            <div class="flex items-center space-x-4">
                <div class="relative w-24 h-24 shrink-0 flex items-center justify-center">
                    <svg viewBox="0 0 36 36" class="w-full h-full transform -rotate-90">
                        <circle cx="18" cy="18" r="15.915" fill="transparent" stroke="#f1f5f9" stroke-width="4"></circle>
                        <circle cx="18" cy="18" r="15.915" fill="transparent" stroke="#059669" stroke-width="4" stroke-dasharray="${donutData.high_pct} ${100 - donutData.high_pct}" stroke-dashoffset="0"></circle>
                        <circle cx="18" cy="18" r="15.915" fill="transparent" stroke="#f59e0b" stroke-width="4" stroke-dasharray="${donutData.med_pct} ${100 - donutData.med_pct}" stroke-dashoffset="-${donutData.high_pct}"></circle>
                        <circle cx="18" cy="18" r="15.915" fill="transparent" stroke="#e11d48" stroke-width="4" stroke-dasharray="${donutData.low_pct} ${100 - donutData.low_pct}" stroke-dashoffset="-${donutData.high_pct + donutData.med_pct}"></circle>
                    </svg>
                    <div class="absolute inset-0 flex flex-col items-center justify-center text-center">
                        <span class="font-manrope font-black text-base text-slate-900 leading-none">${total}</span>
                        <span class="text-[8.5px] font-bold text-slate-400 uppercase">Dự án cha</span>
                    </div>
                </div>

                <div class="flex-1 space-y-1.5 text-xs">
                    <div class="flex items-center justify-between">
                        <span class="flex items-center gap-1.5 text-slate-600 font-medium">
                            <span class="w-2 h-2 rounded-full bg-emerald-600"></span>
                            <span>An toàn (≥80%):</span>
                        </span>
                        <b class="text-emerald-700 font-bold">${high} việc</b>
                    </div>
                    <div class="flex items-center justify-between">
                        <span class="flex items-center gap-1.5 text-slate-600 font-medium">
                            <span class="w-2 h-2 rounded-full bg-amber-500"></span>
                            <span>Theo dõi (50-79%):</span>
                        </span>
                        <b class="text-amber-700 font-bold">${med} việc</b>
                    </div>
                    <div class="flex items-center justify-between">
                        <span class="flex items-center gap-1.5 text-slate-600 font-medium">
                            <span class="w-2 h-2 rounded-full bg-rose-600"></span>
                            <span>Rủi ro (<50%):</span>
                        </span>
                        <b class="text-rose-700 font-bold">${low} việc</b>
                    </div>
                </div>
            </div>
        `;
    },

    // 5. OPERATIONAL ALERTS WIDGET (HÀNG ĐỢI ESCALATE & CẢNH BÁO QUÁ TẢI)
    renderOperationalAlertsWidget(alertsData) {
        const container = document.getElementById('portalOperationalAlerts');
        if (!container || !alertsData) return;

        const escQueue = alertsData.escalate_queue || [];
        const overloadStaff = alertsData.overload_alerts || [];

        container.innerHTML = `
            <div class="space-y-3">
                <!-- Hàng đợi Escalate -->
                <div class="p-3 bg-amber-50/60 rounded-xl border border-amber-200/80">
                    <div class="flex items-center justify-between pb-1.5 mb-1.5 border-b border-amber-200">
                        <span class="text-[11px] font-bold text-amber-950 flex items-center gap-1.5">
                            <i class="fa-solid fa-clock-rotate-left text-amber-600"></i> Hàng Đợi Escalate (24h/48h/72h)
                        </span>
                        <span class="font-bold px-1.5 py-0.2 rounded bg-amber-200 text-amber-900 text-[10px]">${escQueue.length}</span>
                    </div>
                    ${escQueue.length === 0 ? `
                        <p class="text-[11px] text-slate-500 italic">Không có việc nào bị ngâm phân công.</p>
                    ` : `
                        <div class="space-y-1.5 text-xs">
                            ${escQueue.slice(0, 2).map(item => `
                                <div class="flex items-center justify-between text-[11px]">
                                    <span class="truncate max-w-[170px] text-slate-800 font-medium" title="${item.title}">• ${item.title}</span>
                                    <span class="font-bold text-rose-700 shrink-0">${item.hours_elapsed}h (${item.level})</span>
                                </div>
                            `).join('')}
                        </div>
                    `}
                </div>

                <!-- Cảnh báo quá tải -->
                <div class="p-3 bg-purple-50/60 rounded-xl border border-purple-200/80">
                    <div class="flex items-center justify-between pb-1.5 mb-1.5 border-b border-purple-200">
                        <span class="text-[11px] font-bold text-purple-950 flex items-center gap-1.5">
                            <i class="fa-solid fa-user-shield text-purple-600"></i> Nhân Sự Quá Tải (>120%)
                        </span>
                        <span class="font-bold px-1.5 py-0.2 rounded bg-purple-200 text-purple-900 text-[10px]">${overloadStaff.length}</span>
                    </div>
                    ${overloadStaff.length === 0 ? `
                        <p class="text-[11px] text-slate-500 italic">Nhân lực phân bổ cân bằng.</p>
                    ` : `
                        <div class="space-y-1.5 text-xs">
                            ${overloadStaff.slice(0, 2).map(s => `
                                <div class="flex items-center justify-between text-[11px]">
                                    <span class="text-slate-800 font-medium">${s.full_name}</span>
                                    <span class="font-bold text-purple-900">${s.active_tasks_count} việc (${s.workload_index}%)</span>
                                </div>
                            `).join('')}
                        </div>
                    `}
                </div>
            </div>
        `;
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

                const rankInfo = Common.getRankInfo(kpiRes.kpi || 0);

                if (elVal) elVal.innerText = `${kpiRes.kpi || 0}%`;
                if (elRank) {
                    elRank.innerText = rankInfo.label;
                    elRank.className = `text-[10px] font-bold px-2 py-0.5 rounded-full ${rankInfo.badgeClass}`;
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
