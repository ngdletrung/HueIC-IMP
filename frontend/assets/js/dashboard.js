// Dashboard Page Logic (index.html) - HueIC IMP v2.4.0
// Executive Operational & Decision-Making Dashboard
const Dashboard = {
    departments: [],
    users: [],
    statusChartInstance: null,
    deptChartInstance: null,
    currentTab: 'list',
    lastSummaryData: null,

    async init() {
        Common.init('dashboard');

        try {
            const [depts, users] = await Promise.all([
                API.getDepartments(),
                API.getUsers()
            ]);
            this.departments = depts;
            this.users = users;

            this.populateScopeFilters();
            await this.loadStats();
        } catch (e) {
            console.error('Lỗi khởi tạo Dashboard:', e);
            Common.showToast('Không thể tải dữ liệu tổng quan', 'error');
        }
    },

    populateScopeFilters() {
        const dashFilterDept = document.getElementById('dashFilterDept');
        if (dashFilterDept) {
            dashFilterDept.innerHTML = '<option value="">🏢 Cấp Toàn Trường (12 Đơn vị)</option>' +
                this.departments.map(d => `<option value="${d.id}">${d.name} (${d.code})</option>`).join('');
        }
        this.renderScopeUserOptions();
    },

    renderScopeUserOptions(deptId = '') {
        const dashFilterUser = document.getElementById('dashFilterUser');
        if (!dashFilterUser) return;

        let userList = this.users || [];
        if (deptId) {
            userList = userList.filter(u => u.department_id == deptId);
        }

        dashFilterUser.innerHTML = '<option value="">👥 Tất Cả Cán Bộ</option>' +
            userList.map(u => `<option value="${u.id}">${u.full_name} (${u.position || u.role})</option>`).join('');
    },

    handleScopeChange(type) {
        const deptId = document.getElementById('dashFilterDept')?.value || '';
        if (type === 'dept') {
            this.renderScopeUserOptions(deptId);
        }
        this.loadStats();
    },

    resetScope() {
        const dashFilterDept = document.getElementById('dashFilterDept');
        const dashFilterUser = document.getElementById('dashFilterUser');
        if (dashFilterDept) dashFilterDept.value = '';
        this.renderScopeUserOptions('');
        if (dashFilterUser) dashFilterUser.value = '';
        this.loadStats();
        Common.showToast('Đã chuyển về báo cáo Cấp Toàn Trường', 'info');
    },

    async loadStats() {
        try {
            const dept_id = document.getElementById('dashFilterDept')?.value || '';
            const user_id = document.getElementById('dashFilterUser')?.value || '';

            // 1. Xác định Scope Name động
            let scopeName = 'Cấp Toàn Trường (12 Đơn vị)';
            let scopeParam = '';
            if (user_id) {
                const u = this.users.find(x => x.id == user_id);
                scopeName = u ? `Cán bộ ${u.full_name}` : `Cán bộ #${user_id}`;
                scopeParam = `&user_id=${user_id}`;
            } else if (dept_id) {
                const d = this.departments.find(x => x.id == dept_id);
                scopeName = d ? `${d.name} (${d.code})` : `Đơn vị #${dept_id}`;
                scopeParam = `&dept_id=${dept_id}`;
            }

            // 2. Cập nhật Badge phạm vi và Nút Reset
            const badge = document.getElementById('dashScopeBadge');
            const resetBtn = document.getElementById('btnResetDashScope');
            if (dept_id || user_id) {
                resetBtn?.classList.remove('hidden');
                if (badge) badge.innerText = scopeName;
            } else {
                resetBtn?.classList.add('hidden');
                if (badge) badge.innerText = `Cấp Toàn Trường (12 Đơn vị)`;
            }

            const data = await API.getStatsSummary({ dept_id, user_id });
            this.lastSummaryData = data;
            const ov = data.overview;
            const actionQueue = data.action_queue || { overdue: [], due_soon: [], review: [] };
            const prio = data.priority_stats || {};
            const deptStats = data.department_stats || [];
            const staffStats = data.staff_stats || [];
            const userTasks = data.user_tasks || [];

            // 3. Cập nhật các thẻ KPI
            if (document.getElementById('statTotalTasks')) document.getElementById('statTotalTasks').innerText = ov.total_tasks;
            if (document.getElementById('statInProgress')) document.getElementById('statInProgress').innerText = ov.in_progress_tasks;
            if (document.getElementById('statReview')) document.getElementById('statReview').innerText = ov.review_tasks;
            if (document.getElementById('statOverdue')) document.getElementById('statOverdue').innerText = ov.overdue_tasks || 0;
            if (document.getElementById('statCompleted')) document.getElementById('statCompleted').innerText = ov.completed_tasks;
            if (document.getElementById('statRate')) document.getElementById('statRate').innerText = `${ov.completion_rate}%`;

            // 4. Cập nhật Sidebar Badge
            const navBadgeTasks = document.getElementById('navBadgeTasks');
            if (navBadgeTasks) {
                const pendingAlerts = (ov.overdue_tasks || 0) + (ov.review_tasks || 0);
                if (pendingAlerts > 0) {
                    navBadgeTasks.classList.remove('hidden');
                    navBadgeTasks.innerText = pendingAlerts;
                } else {
                    navBadgeTasks.classList.add('hidden');
                }
            }

            // 5. Render Executive Action Queue (Việc cần xử lý ngay)
            this.renderActionQueue(actionQueue);

            // 6. Cập nhật Action Strip theo Mức Độ Ưu Tiên
            const prioTitle = document.getElementById('prioSectionTitle');
            if (prioTitle) prioTitle.innerText = `Ưu Tiên Xử Lý & Phân Bổ: ${scopeName}`;

            if (document.getElementById('statPrioKhanCap')) document.getElementById('statPrioKhanCap').innerText = prio.KHAN_CAP || 0;
            if (document.getElementById('statPrioCao')) document.getElementById('statPrioCao').innerText = prio.CAO || 0;
            if (document.getElementById('statPrioTrungBinh')) document.getElementById('statPrioTrungBinh').innerText = prio.TRUNG_BINH || 0;
            if (document.getElementById('statPrioThap')) document.getElementById('statPrioThap').innerText = prio.THAP || 0;

            const odBadge = document.getElementById('statPrioKhanCapOdBadge');
            if (odBadge) {
                if (prio.KHAN_CAP_OVERDUE > 0) {
                    odBadge.classList.remove('hidden');
                    odBadge.innerText = `🚨 ${prio.KHAN_CAP_OVERDUE} trễ`;
                } else {
                    odBadge.classList.add('hidden');
                }
            }

            // 7. Cập nhật Tiêu đề Biểu Đồ Khối Lượng
            const chartBarTitle = document.getElementById('chartBarTitle');
            const chartBarSubtitle = document.getElementById('chartBarSubtitle');
            const chartBarBadge = document.getElementById('chartBarBadge');
            const chartBarHint = document.getElementById('chartBarHint');

            if (user_id && userTasks.length > 0) {
                if (chartBarTitle) chartBarTitle.innerText = `Tiến Độ Các Nhiệm Vụ: ${scopeName}`;
                if (chartBarSubtitle) chartBarSubtitle.innerText = `Chi tiết tỷ lệ hoàn thành (%) từng công việc được giao`;
                if (chartBarBadge) chartBarBadge.innerText = `Cá Nhân`;
                if (chartBarHint) chartBarHint.innerText = `💡 Bấm vào thanh tiến độ để xem chi tiết nhiệm vụ`;
            } else if (dept_id && staffStats.length > 0) {
                if (chartBarTitle) chartBarTitle.innerText = `Tiến Độ Cán Bộ Thuộc: ${scopeName}`;
                if (chartBarSubtitle) chartBarSubtitle.innerText = `So sánh tỷ lệ hoàn thành (%) và tổng việc từng cán bộ`;
                if (chartBarBadge) chartBarBadge.innerText = `Cấp Đơn Vị`;
                if (chartBarHint) chartBarHint.innerText = `💡 Bấm vào cán bộ để xem danh sách nhiệm vụ`;
            } else {
                if (chartBarTitle) chartBarTitle.innerText = `Tiến Độ & Khối Lượng 12 Đơn Vị HueIC`;
                if (chartBarSubtitle) chartBarSubtitle.innerText = `So sánh tỷ lệ hoàn thành (%) và khối lượng công việc`;
                if (chartBarBadge) chartBarBadge.innerText = `Cấp Toàn Trường`;
                if (chartBarHint) chartBarHint.innerText = `💡 Bấm vào từng đơn vị để xem chi tiết danh sách công việc`;
            }

            // 8. Render TRỰC TIẾP cả 2 biểu đồ Visual Charts (Doughnut Chart & Horizontal Bar Chart)
            this.renderStatusDoughnutChart(ov, scopeParam);
            if (user_id && userTasks.length > 0) {
                this.renderUserTasksBarChart(userTasks);
            } else if (dept_id && staffStats.length > 0) {
                this.renderStaffProgressBarChart(staffStats);
            } else {
                this.renderDeptProgressBarChart(deptStats);
            }

            // 8. Cập nhật Bảng Theo Dõi Chi Tiết
            const tableTitle = document.getElementById('dashboardTableTitle');
            const tableSubtitle = document.getElementById('dashboardTableSubtitle');
            const thead = document.getElementById('dashboardTableHead');
            const tbody = document.getElementById('dashboardDeptTable');

            if (user_id) {
                if (tableTitle) tableTitle.innerText = `Danh Sách Nhiệm Vụ Của: ${scopeName}`;
                if (tableSubtitle) tableSubtitle.innerText = `Toàn bộ công việc đang phụ trách hoặc theo dõi`;
                if (thead) {
                    thead.innerHTML = `
                        <tr>
                            <th class="px-4 py-3 w-12 text-center whitespace-nowrap">#</th>
                            <th class="px-4 py-3 whitespace-nowrap">Tiêu đề nhiệm vụ</th>
                            <th class="px-4 py-3 text-center whitespace-nowrap">Đơn vị</th>
                            <th class="px-4 py-3 text-center whitespace-nowrap">Ưu tiên</th>
                            <th class="px-4 py-3 text-center whitespace-nowrap">Trạng thái</th>
                            <th class="px-4 py-3 min-w-[150px] whitespace-nowrap">Tiến độ (%)</th>
                            <th class="px-4 py-3 text-center whitespace-nowrap">Thời hạn</th>
                            <th class="px-4 py-3 text-right whitespace-nowrap">Thao tác</th>
                        </tr>
                    `;
                }
                if (tbody) {
                    if (userTasks.length === 0) {
                        tbody.innerHTML = `<tr><td colspan="8" class="text-center py-8 text-slate-400 text-xs italic">Cán bộ này hiện chưa có công việc nào.</td></tr>`;
                    } else {
                        tbody.innerHTML = userTasks.map((t, idx) => {
                            const ds = Common.getDeadlineStatus(t.due_date, t.status === 'HOAN_THANH');
                            return `
                                <tr class="hover:bg-blue-50/40 border-b border-slate-100 transition text-xs">
                                    <td class="px-4 py-3 text-center font-mono text-slate-400 font-bold">${idx + 1}</td>
                                    <td class="px-4 py-3 font-bold text-slate-900">
                                        <a href="tasks.html?task_id=${t.id}" class="hover:text-blue-800 transition block max-w-xs truncate" title="${t.title}">
                                            ${t.title}
                                        </a>
                                    </td>
                                    <td class="px-4 py-3 text-center font-bold text-blue-900">${t.leading_dept_code || '-'}</td>
                                    <td class="px-4 py-3 text-center font-semibold text-slate-700">${t.priority}</td>
                                    <td class="px-4 py-3 text-center">
                                        <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-800">${this._sn(t.status)}</span>
                                    </td>
                                    <td class="px-4 py-3 min-w-[150px]">
                                        <div class="flex items-center space-x-2">
                                            <div class="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                                                <div class="h-2 rounded-full ${t.progress_percent >= 80 ? 'bg-emerald-600' : 'bg-blue-600'}" style="width: ${t.progress_percent}%"></div>
                                            </div>
                                            <span class="text-xs font-bold text-slate-700 w-8 text-right font-mono">${t.progress_percent}%</span>
                                        </div>
                                    </td>
                                    <td class="px-4 py-3 text-center whitespace-nowrap">
                                        <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${ds.badgeClass}">${ds.shortLabel}</span>
                                    </td>
                                    <td class="px-4 py-3 text-right whitespace-nowrap">
                                        <a href="tasks.html?task_id=${t.id}" class="inline-flex items-center space-x-1 px-2.5 py-1 bg-blue-50 hover:bg-blue-800 hover:text-white text-blue-700 rounded-lg text-xs font-semibold transition" title="Xem chi tiết">
                                            <i class="fa-solid fa-arrow-up-right-from-square text-[10px]"></i>
                                            <span>Chi tiết</span>
                                        </a>
                                    </td>
                                </tr>
                            `;
                        }).join('');
                    }
                }
            } else if (dept_id) {
                if (tableTitle) tableTitle.innerText = `Bảng Phân Công & Tiến Độ Cán Bộ Thuộc: ${scopeName}`;
                if (tableSubtitle) tableSubtitle.innerText = `Danh sách cán bộ trực thuộc và khối lượng công việc được giao`;
                if (thead) {
                    thead.innerHTML = `
                        <tr>
                            <th class="px-4 py-3 w-12 text-center whitespace-nowrap">Mã</th>
                            <th class="px-4 py-3 whitespace-nowrap">Họ và Tên Cán Bộ</th>
                            <th class="px-4 py-3 text-center whitespace-nowrap">Tổng việc</th>
                            <th class="px-4 py-3 text-center whitespace-nowrap">Đang làm</th>
                            <th class="px-4 py-3 text-center whitespace-nowrap">Hoàn thành</th>
                            <th class="px-4 py-3 min-w-[150px] whitespace-nowrap">Tiến độ (%)</th>
                            <th class="px-4 py-3 text-center whitespace-nowrap">Trạng thái Vận hành</th>
                            <th class="px-4 py-3 text-right whitespace-nowrap">Thao tác</th>
                        </tr>
                    `;
                }
                if (tbody) {
                    if (staffStats.length === 0) {
                        tbody.innerHTML = `<tr><td colspan="8" class="text-center py-8 text-slate-400 text-xs italic">Đơn vị này hiện chưa có cán bộ hoặc công việc.</td></tr>`;
                    } else {
                        tbody.innerHTML = staffStats.map((s, idx) => `
                            <tr class="hover:bg-blue-50/40 border-b border-slate-100 transition text-xs">
                                <td class="px-4 py-3 text-center font-mono font-bold text-blue-900">
                                    <span class="px-2 py-0.5 bg-blue-50 border border-blue-200 rounded">CB${idx + 1}</span>
                                </td>
                                <td class="px-4 py-3 font-semibold text-slate-800">
                                    <a href="tasks.html?user_id=${s.user_id}" class="font-bold text-slate-900 hover:text-blue-800 transition">
                                        ${s.full_name}
                                    </a>
                                    <span class="text-xs text-slate-400 font-normal ml-1">(${s.position})</span>
                                </td>
                                <td class="px-4 py-3 text-center font-bold text-slate-800">${s.total_tasks}</td>
                                <td class="px-4 py-3 text-center font-bold text-cyan-700">${s.total_tasks - s.completed_tasks}</td>
                                <td class="px-4 py-3 text-center font-bold text-emerald-600">${s.completed_tasks}</td>
                                <td class="px-4 py-3">
                                    <div class="flex items-center space-x-2">
                                        <div class="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                                            <div class="h-2.5 rounded-full ${s.avg_progress >= 80 ? 'bg-emerald-600' : s.avg_progress >= 50 ? 'bg-blue-600' : 'bg-amber-500'}" style="width: ${s.avg_progress}%"></div>
                                        </div>
                                        <span class="text-xs font-bold text-slate-700 w-10 text-right font-mono">${s.avg_progress}%</span>
                                    </div>
                                </td>
                                <td class="px-4 py-3 text-center whitespace-nowrap">
                                    <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold ${s.status_badge}">${s.status_label}</span>
                                </td>
                                <td class="px-4 py-3 text-right whitespace-nowrap">
                                    <a href="tasks.html?user_id=${s.user_id}" class="inline-flex items-center space-x-1 px-2.5 py-1 bg-blue-50 hover:bg-blue-800 hover:text-white text-blue-700 rounded-lg text-xs font-semibold transition" title="Xem công việc cán bộ này">
                                        <i class="fa-solid fa-arrow-up-right-from-square text-[10px]"></i>
                                        <span>Xem việc</span>
                                    </a>
                                </td>
                            </tr>
                        `).join('');
                    }
                }
            } else {
                if (tableTitle) tableTitle.innerText = `Bảng Theo Dõi Tiến Độ Chi Tiết 12 Đơn Vị HueIC`;
                if (tableSubtitle) tableSubtitle.innerText = `Bấm vào tên đơn vị để xem danh sách nhiệm vụ tương ứng`;
                if (thead) {
                    thead.innerHTML = `
                        <tr>
                            <th class="px-4 py-3 w-12 text-center whitespace-nowrap">Mã</th>
                            <th class="px-4 py-3 whitespace-nowrap">Tên Đơn vị / Phòng / Khoa</th>
                            <th class="px-4 py-3 text-center whitespace-nowrap">Tổng việc</th>
                            <th class="px-4 py-3 text-center whitespace-nowrap">Đang làm</th>
                            <th class="px-4 py-3 text-center whitespace-nowrap">Hoàn thành</th>
                            <th class="px-4 py-3 min-w-[150px] whitespace-nowrap">Tiến độ (%)</th>
                            <th class="px-4 py-3 text-center whitespace-nowrap">Trạng thái Vận hành</th>
                            <th class="px-4 py-3 text-right whitespace-nowrap">Thao tác</th>
                        </tr>
                    `;
                }
                if (tbody) {
                    if (deptStats.length === 0) {
                        tbody.innerHTML = `<tr><td colspan="8" class="text-center py-8 text-slate-400 text-xs italic">Chưa có dữ liệu phòng ban.</td></tr>`;
                    } else {
                        tbody.innerHTML = deptStats.map(d => `
                            <tr class="hover:bg-blue-50/40 border-b border-slate-100 transition text-xs">
                                <td class="px-4 py-3 text-center font-mono font-bold text-blue-900">
                                    <span class="px-2 py-0.5 bg-blue-50 border border-blue-200 rounded">${d.dept_code}</span>
                                </td>
                                <td class="px-4 py-3 font-semibold text-slate-800">
                                    <a href="tasks.html?dept_id=${d.dept_id}" class="font-bold text-slate-900 hover:text-blue-800 transition">
                                        ${d.dept_name}
                                    </a>
                                </td>
                                <td class="px-4 py-3 text-center font-bold text-slate-800">${d.total_tasks}</td>
                                <td class="px-4 py-3 text-center font-bold text-cyan-700">${d.in_progress_tasks || 0}</td>
                                <td class="px-4 py-3 text-center font-bold text-emerald-600">${d.completed_tasks}</td>
                                <td class="px-4 py-3">
                                    <div class="flex items-center space-x-2">
                                        <div class="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                                            <div class="h-2.5 rounded-full ${d.avg_progress >= 80 ? 'bg-emerald-600' : d.avg_progress >= 50 ? 'bg-blue-600' : 'bg-amber-500'}" style="width: ${d.avg_progress}%"></div>
                                        </div>
                                        <span class="text-xs font-bold text-slate-700 w-10 text-right font-mono">${d.avg_progress}%</span>
                                    </div>
                                </td>
                                <td class="px-4 py-3 text-center whitespace-nowrap">
                                    <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${d.status_badge}">${d.status_label}</span>
                                </td>
                                <td class="px-4 py-3 text-right whitespace-nowrap">
                                    <a href="tasks.html?dept_id=${d.dept_id}" class="inline-flex items-center space-x-1 px-2.5 py-1 bg-blue-50 hover:bg-blue-800 hover:text-white text-blue-700 rounded-lg text-xs font-semibold transition" title="Xem danh sách nhiệm vụ của đơn vị này">
                                        <i class="fa-solid fa-arrow-up-right-from-square text-[10px]"></i>
                                        <span>Xem việc</span>
                                    </a>
                                </td>
                            </tr>
                        `).join('');
                    }
                }
            }
        } catch (e) {
            console.error('Lỗi tải dữ liệu thống kê:', e);
        }
    },

    renderActionQueue(queue) {
        const container = document.getElementById('actionQueueContainer');
        const badgeEl = document.getElementById('actionQueueCountBadge');
        if (!container) return;

        const totalActions = (queue.overdue?.length || 0) + (queue.due_soon?.length || 0) + (queue.review?.length || 0);
        if (badgeEl) badgeEl.innerText = `${totalActions} việc`;

        if (totalActions === 0) {
            container.innerHTML = `
                <div class="p-8 text-center bg-emerald-50/50 rounded-xl border border-emerald-200">
                    <i class="fa-solid fa-circle-check text-3xl text-emerald-500 mb-2 block"></i>
                    <h4 class="font-bold text-sm text-emerald-900">Không có điểm nghẽn tồn đọng</h4>
                    <p class="text-xs text-emerald-700 mt-1">Toàn bộ nhiệm vụ đang vận hành đúng tiến độ và kế hoạch.</p>
                </div>
            `;
            return;
        }

        let html = '';

        // 1. Việc quá hạn
        if (queue.overdue && queue.overdue.length > 0) {
            queue.overdue.forEach(item => {
                html += `
                    <div class="p-3 bg-red-50/80 hover:bg-red-100 border border-red-200 rounded-xl transition flex items-center justify-between gap-3">
                        <div class="flex items-start gap-2.5 min-w-0">
                            <span class="w-2 h-2 rounded-full bg-red-600 animate-ping shrink-0 mt-1.5"></span>
                            <div class="min-w-0">
                                <div class="font-bold text-xs text-slate-900 truncate" title="${item.title}">${item.title}</div>
                                <div class="flex items-center gap-2 mt-1 text-[10px] text-slate-500">
                                    <span class="font-bold text-red-700 bg-red-100 px-1.5 py-0.2 rounded">[${item.dept_code}]</span>
                                    <span class="truncate">${item.assignee_name}</span>
                                    <span class="font-black text-red-600">🚨 Trễ ${item.days_overdue} ngày</span>
                                </div>
                            </div>
                        </div>
                        <a href="tasks.html?task_id=${item.id}" class="shrink-0 px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg text-[10px] font-bold transition flex items-center gap-1 shadow-xs">
                            <span>Xử lý</span>
                            <i class="fa-solid fa-arrow-right text-[8px]"></i>
                        </a>
                    </div>
                `;
            });
        }

        // 2. Việc sắp đến hạn trong 72h
        if (queue.due_soon && queue.due_soon.length > 0) {
            queue.due_soon.forEach(item => {
                html += `
                    <div class="p-3 bg-amber-50/80 hover:bg-amber-100 border border-amber-200 rounded-xl transition flex items-center justify-between gap-3">
                        <div class="flex items-start gap-2.5 min-w-0">
                            <span class="w-2 h-2 rounded-full bg-amber-500 shrink-0 mt-1.5"></span>
                            <div class="min-w-0">
                                <div class="font-bold text-xs text-slate-900 truncate" title="${item.title}">${item.title}</div>
                                <div class="flex items-center gap-2 mt-1 text-[10px] text-slate-500">
                                    <span class="font-bold text-amber-800 bg-amber-100 px-1.5 py-0.2 rounded">[${item.dept_code}]</span>
                                    <span class="truncate">${item.assignee_name}</span>
                                    <span class="font-bold text-amber-700">⏳ ${item.time_text}</span>
                                </div>
                            </div>
                        </div>
                        <a href="tasks.html?task_id=${item.id}" class="shrink-0 px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[10px] font-bold transition flex items-center gap-1 shadow-xs">
                            <span>Đôn đốc</span>
                            <i class="fa-solid fa-arrow-right text-[8px]"></i>
                        </a>
                    </div>
                `;
            });
        }

        // 3. Việc chờ nghiệm thu
        if (queue.review && queue.review.length > 0) {
            queue.review.forEach(item => {
                html += `
                    <div class="p-3 bg-blue-50/80 hover:bg-blue-100 border border-blue-200 rounded-xl transition flex items-center justify-between gap-3">
                        <div class="flex items-start gap-2.5 min-w-0">
                            <span class="w-2 h-2 rounded-full bg-blue-600 shrink-0 mt-1.5"></span>
                            <div class="min-w-0">
                                <div class="font-bold text-xs text-slate-900 truncate" title="${item.title}">${item.title}</div>
                                <div class="flex items-center gap-2 mt-1 text-[10px] text-slate-500">
                                    <span class="font-bold text-blue-800 bg-blue-100 px-1.5 py-0.2 rounded">[${item.dept_code}]</span>
                                    <span class="truncate">${item.assignee_name}</span>
                                    <span class="font-bold text-blue-700">🟡 Chờ phê duyệt (${item.progress_percent}%)</span>
                                </div>
                            </div>
                        </div>
                        <a href="tasks.html?task_id=${item.id}" class="shrink-0 px-2.5 py-1 bg-blue-800 hover:bg-blue-900 text-white rounded-lg text-[10px] font-bold transition flex items-center gap-1 shadow-xs">
                            <span>Phê duyệt</span>
                            <i class="fa-solid fa-arrow-right text-[8px]"></i>
                        </a>
                    </div>
                `;
            });
        }

        container.innerHTML = html;
    },

    renderStatusDoughnutChart(ov, scopeParam = '') {
        const ctx = document.getElementById('chartTaskStatus');
        if (!ctx || typeof Chart === 'undefined') return;

        if (this.statusChartInstance) {
            this.statusChartInstance.destroy();
        }

        const labels = ['Hoàn thành', 'Đang làm', 'Chờ duyệt', 'Chưa bắt đầu', 'Tạm dừng', 'Quá hạn'];
        const values = [
            ov.completed_tasks || 0,
            ov.in_progress_tasks || 0,
            ov.review_tasks || 0,
            ov.not_started_tasks || 0,
            ov.paused_tasks || 0,
            ov.overdue_tasks || 0
        ];
        const statusMap = ['HOAN_THANH', 'DANG_THUC_HIEN', 'CHO_DUYET', 'CHUA_BAT_DAU', 'TAM_DUNG', 'TRE_HAN'];
        const colors = ['#16a34a', '#06b6d4', '#f59e0b', '#94a3b8', '#8b5cf6', '#dc2626'];

        const total = values.reduce((a, b) => a + b, 0);
        const dataValues = total === 0 ? [1] : values;
        const bgColors = total === 0 ? ['#e2e8f0'] : colors;
        const chartLabels = total === 0 ? ['Chưa có công việc'] : labels;

        this.statusChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: chartLabels,
                datasets: [{
                    data: dataValues,
                    backgroundColor: bgColors,
                    borderWidth: 2,
                    borderColor: '#ffffff',
                    hoverOffset: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '70%',
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            boxWidth: 12,
                            boxHeight: 12,
                            font: { size: 11, weight: '600' },
                            padding: 10
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                if (total === 0) return ' Chưa có dữ liệu';
                                const val = context.raw || 0;
                                const pct = Math.round((val / total) * 100);
                                return ` ${context.label}: ${val} việc (${pct}%)`;
                            }
                        }
                    }
                },
                onClick: (evt, elements) => {
                    if (elements.length > 0 && total > 0) {
                        const index = elements[0].index;
                        const selectedStatus = statusMap[index];
                        if (selectedStatus) {
                            window.location.href = `tasks.html?status=${selectedStatus}${scopeParam}`;
                        }
                    }
                }
            }
        });
    },

    renderDeptProgressBarChart(deptStats) {
        const ctx = document.getElementById('chartDeptProgress');
        const container = document.getElementById('chartDeptProgressContainer');
        if (!ctx || typeof Chart === 'undefined') return;

        if (this.deptChartInstance) {
            this.deptChartInstance.destroy();
        }

        const labels = deptStats.map(d => `${d.dept_code} - ${d.dept_name}`);
        const progressValues = deptStats.map(d => d.avg_progress || 0);
        const totalTasksValues = deptStats.map(d => d.total_tasks || 0);

        if (container) {
            container.style.height = `${Math.max(480, labels.length * 40 + 40)}px`;
        }

        this.deptChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Tiến độ trung bình (%)',
                        data: progressValues,
                        backgroundColor: progressValues.map(p => p >= 80 ? '#16a34a' : p >= 50 ? '#0284c7' : '#f59e0b'),
                        borderRadius: 6,
                        barThickness: 13,
                        barPercentage: 0.85,
                        categoryPercentage: 0.85
                    },
                    {
                        label: 'Tổng số nhiệm vụ',
                        data: totalTasksValues,
                        backgroundColor: '#94a3b8',
                        borderRadius: 6,
                        barThickness: 13,
                        barPercentage: 0.85,
                        categoryPercentage: 0.85
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y',
                scales: {
                    x: {
                        beginAtZero: true,
                        max: 100,
                        ticks: { font: { size: 10, weight: '600' }, color: '#64748b' },
                        grid: { color: '#f1f5f9' }
                    },
                    y: {
                        ticks: {
                            font: { size: 11, weight: '700' },
                            color: '#334155',
                            autoSkip: false
                        },
                        grid: { display: false }
                    }
                },
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            boxWidth: 12,
                            boxHeight: 12,
                            font: { size: 11, weight: '700' },
                            padding: 10
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                if (context.datasetIndex === 0) {
                                    return ` Tiến độ: ${context.raw}%`;
                                }
                                return ` Khối lượng: ${context.raw} công việc`;
                            }
                        }
                    }
                },
                onClick: (evt, elements) => {
                    if (elements.length > 0) {
                        const index = elements[0].index;
                        const dept = deptStats[index];
                        if (dept) {
                            window.location.href = `tasks.html?dept_id=${dept.dept_id}`;
                        }
                    }
                }
            }
        });
    },

    renderStaffProgressBarChart(staffStats) {
        const ctx = document.getElementById('chartDeptProgress');
        const container = document.getElementById('chartDeptProgressContainer');
        if (!ctx || typeof Chart === 'undefined') return;

        if (this.deptChartInstance) {
            this.deptChartInstance.destroy();
        }

        const labels = staffStats.map(s => `${s.full_name} (${s.position})`);
        const progressValues = staffStats.map(s => s.avg_progress || 0);
        const totalTasksValues = staffStats.map(s => s.total_tasks || 0);

        if (container) {
            container.style.height = `${Math.max(360, labels.length * 40 + 40)}px`;
        }

        this.deptChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Tiến độ trung bình (%)',
                        data: progressValues,
                        backgroundColor: progressValues.map(p => p >= 80 ? '#16a34a' : p >= 50 ? '#0284c7' : '#f59e0b'),
                        borderRadius: 6,
                        barThickness: 13,
                        barPercentage: 0.85,
                        categoryPercentage: 0.85
                    },
                    {
                        label: 'Tổng số nhiệm vụ',
                        data: totalTasksValues,
                        backgroundColor: '#94a3b8',
                        borderRadius: 6,
                        barThickness: 13,
                        barPercentage: 0.85,
                        categoryPercentage: 0.85
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y',
                scales: {
                    x: {
                        beginAtZero: true,
                        max: 100,
                        ticks: { font: { size: 10, weight: '600' }, color: '#64748b' },
                        grid: { color: '#f1f5f9' }
                    },
                    y: {
                        ticks: {
                            font: { size: 11, weight: '700' },
                            color: '#334155',
                            autoSkip: false
                        },
                        grid: { display: false }
                    }
                },
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            boxWidth: 12,
                            boxHeight: 12,
                            font: { size: 11, weight: '700' },
                            padding: 10
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                if (context.datasetIndex === 0) {
                                    return ` Tiến độ: ${context.raw}%`;
                                }
                                return ` Khối lượng: ${context.raw} công việc`;
                            }
                        }
                    }
                },
                onClick: (evt, elements) => {
                    if (elements.length > 0) {
                        const index = elements[0].index;
                        const staff = staffStats[index];
                        if (staff) {
                            window.location.href = `tasks.html?user_id=${staff.user_id}`;
                        }
                    }
                }
            }
        });
    },

    renderUserTasksBarChart(userTasks) {
        const ctx = document.getElementById('chartDeptProgress');
        const container = document.getElementById('chartDeptProgressContainer');
        if (!ctx || typeof Chart === 'undefined') return;

        if (this.deptChartInstance) {
            this.deptChartInstance.destroy();
        }

        const labels = userTasks.map(t => t.title.length > 25 ? t.title.substring(0, 25) + '...' : t.title);
        const progressValues = userTasks.map(t => t.progress_percent || 0);

        if (container) {
            container.style.height = `${Math.max(360, labels.length * 40 + 40)}px`;
        }

        this.deptChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Tiến độ thực hiện (%)',
                        data: progressValues,
                        backgroundColor: progressValues.map(p => p >= 100 ? '#16a34a' : p >= 50 ? '#0284c7' : '#f59e0b'),
                        borderRadius: 6,
                        barThickness: 14,
                        barPercentage: 0.85
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y',
                scales: {
                    x: {
                        beginAtZero: true,
                        max: 100,
                        ticks: { font: { size: 10, weight: '600' }, color: '#64748b' },
                        grid: { color: '#f1f5f9' }
                    },
                    y: {
                        ticks: {
                            font: { size: 11, weight: '700' },
                            color: '#334155',
                            autoSkip: false
                        },
                        grid: { display: false }
                    }
                },
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            boxWidth: 12,
                            boxHeight: 12,
                            font: { size: 11, weight: '700' },
                            padding: 10
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return ` Tiến độ: ${context.raw}%`;
                            }
                        }
                    }
                },
                onClick: (evt, elements) => {
                    if (elements.length > 0) {
                        const index = elements[0].index;
                        const task = userTasks[index];
                        if (task) {
                            window.location.href = `tasks.html?task_id=${task.id}`;
                        }
                    }
                }
            }
        });
    },

    _sn(s) {
        return ({
            'CHUA_BAT_DAU': 'Chưa bắt đầu',
            'DANG_THUC_HIEN': 'Đang thực hiện',
            'CHO_DUYET': 'Chờ nghiệm thu',
            'HOAN_THANH': 'Đã hoàn thành',
            'TAM_DUNG': 'Tạm dừng',
            'HUY_BO': 'Hủy bỏ'
        })[s] || s;
    }
};

document.addEventListener('DOMContentLoaded', () => Dashboard.init());
