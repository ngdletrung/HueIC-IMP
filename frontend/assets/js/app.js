// Quản lý trạng thái và tương tác giao diện HueIC IMP
const App = {
    currentUser: null,
    departments: [],
    users: [],
    tasks: [],

    async init() {
        // Kiểm tra đăng nhập
        const token = API.getToken();
        if (!token) {
            window.location.href = 'login.html';
            return;
        }

        this.currentUser = API.getUser();
        this.renderUserHeader();

        // Nạp danh mục dùng chung
        await this.loadInitialData();

        // Khởi động view mặc định
        this.switchTab('dashboard');
    },

    renderUserHeader() {
        if (!this.currentUser) return;
        document.getElementById('headerUserName').innerText = this.currentUser.full_name;
        document.getElementById('headerUserRole').innerText = `${this.currentUser.role} • ${this.currentUser.department_name || 'HueIC'}`;
        document.getElementById('headerUserAvatar').innerText = this.currentUser.full_name.charAt(0);
    },

    async loadInitialData() {
        try {
            const [depts, usersList] = await Promise.all([
                API.getDepartments(),
                API.getUsers()
            ]);
            this.departments = depts;
            this.users = usersList;
            this.populateSelects();
        } catch (e) {
            console.error('Lỗi nạp dữ liệu ban đầu:', e);
        }
    },

    populateSelects() {
        // Đổ dữ liệu vào các thẻ select trong modal
        const leadingDeptSelect = document.getElementById('taskLeadingDept');
        const assistingDeptSelect = document.getElementById('taskAssistingDept');
        const assigneeSelect = document.getElementById('taskAssignee');
        const filterDeptSelect = document.getElementById('filterDept');

        if (leadingDeptSelect) {
            leadingDeptSelect.innerHTML = '<option value="">-- Chọn đơn vị chủ trì --</option>' +
                this.departments.map(d => `<option value="${d.id}">${d.name} (${d.code})</option>`).join('');
        }

        if (assistingDeptSelect) {
            assistingDeptSelect.innerHTML = '<option value="">-- Chọn đơn vị phối hợp (nếu có) --</option>' +
                this.departments.map(d => `<option value="${d.id}">${d.name} (${d.code})</option>`).join('');
        }

        if (filterDeptSelect) {
            filterDeptSelect.innerHTML = '<option value="">Tất cả đơn vị</option>' +
                this.departments.map(d => `<option value="${d.id}">${d.name}</option>`).join('');
        }

        if (assigneeSelect) {
            assigneeSelect.innerHTML = '<option value="">-- Chọn cán bộ phụ trách --</option>' +
                this.users.map(u => `<option value="${u.id}">${u.full_name} (${u.position || u.role})</option>`).join('');
        }

        const formUserDeptSelect = document.getElementById('formUserDept');
        if (formUserDeptSelect) {
            formUserDeptSelect.innerHTML = '<option value="">-- Thuộc Đơn vị / Phòng / Khoa --</option>' +
                this.departments.map(d => `<option value="${d.id}">${d.name} (${d.code})</option>`).join('');
        }

        // Dropdown Bộ Lọc Phạm Vi Giám Sát (Dashboard Scope)
        const dashFilterDept = document.getElementById('dashFilterDept');
        if (dashFilterDept) {
            dashFilterDept.innerHTML = '<option value="">🏢 Cấp Toàn Trường (12 Đơn vị)</option>' +
                this.departments.map(d => `<option value="${d.id}">${d.name} (${d.code})</option>`).join('');
        }
        this.renderDashUserOptions();
    },

    renderDashUserOptions(deptId = '') {
        const dashFilterUser = document.getElementById('dashFilterUser');
        if (!dashFilterUser) return;

        let userList = this.users || [];
        if (deptId) {
            userList = userList.filter(u => u.department_id == deptId);
        }

        dashFilterUser.innerHTML = '<option value="">👥 Tất Cả Cán Bộ</option>' +
            userList.map(u => `<option value="${u.id}">${u.full_name} (${u.position || u.role})</option>`).join('');
    },

    handleDashScopeChange(type) {
        const deptId = document.getElementById('dashFilterDept')?.value || '';
        if (type === 'dept') {
            this.renderDashUserOptions(deptId);
        }
        this.loadDashboard();
    },

    resetDashboardScope() {
        const dashFilterDept = document.getElementById('dashFilterDept');
        const dashFilterUser = document.getElementById('dashFilterUser');
        if (dashFilterDept) dashFilterDept.value = '';
        this.renderDashUserOptions('');
        if (dashFilterUser) dashFilterUser.value = '';
        this.loadDashboard();
        this.showToast('Đã chuyển về báo cáo Cấp Toàn Trường', 'info');
    },

    toggleSidebar(show = null) {
        const sidebar = document.getElementById('mainSidebar');
        const backdrop = document.getElementById('sidebarBackdrop');
        if (!sidebar) return;

        const isCurrentlyOpen = !sidebar.classList.contains('-translate-x-full');
        const shouldOpen = show !== null ? show : !isCurrentlyOpen;

        if (shouldOpen) {
            sidebar.classList.remove('-translate-x-full');
            backdrop?.classList.remove('hidden');
        } else {
            sidebar.classList.add('-translate-x-full');
            backdrop?.classList.add('hidden');
        }
    },

    switchTab(tabId) {
        // Tự động đóng sidebar drawer trên điện thoại sau khi chọn tab
        this.toggleSidebar(false);

        document.querySelectorAll('.tab-pane').forEach(p => p.classList.add('hidden'));
        document.querySelectorAll('.nav-link').forEach(l => {
            l.classList.remove('bg-blue-900', 'text-white');
            l.classList.add('text-slate-300', 'hover:bg-blue-900/50');
        });

        const activePane = document.getElementById(`pane-${tabId}`);
        const activeNav = document.getElementById(`nav-${tabId}`);

        if (activePane) activePane.classList.remove('hidden');
        if (activeNav) {
            activeNav.classList.remove('text-slate-300', 'hover:bg-blue-900/50');
            activeNav.classList.add('bg-blue-900', 'text-white');
        }

        if (tabId === 'dashboard') this.loadDashboard();
        if (tabId === 'tasks') this.loadTasks();
        if (tabId === 'settings') this.switchSettingsSubTab(this.currentSettingsSubTab || 'departments');
    },

    currentSettingsSubTab: 'departments',

    switchSettingsSubTab(subTabId) {
        this.currentSettingsSubTab = subTabId;

        // Cập nhật giao diện nút sub-nav
        document.querySelectorAll('.settings-subnav').forEach(btn => {
            btn.classList.remove('bg-white', 'text-blue-900', 'shadow-xs');
            btn.classList.add('text-slate-600');
        });
        const activeBtn = document.getElementById(`subnav-${subTabId}`);
        if (activeBtn) {
            activeBtn.classList.remove('text-slate-600');
            activeBtn.classList.add('bg-white', 'text-blue-900', 'shadow-xs');
        }

        // Cập nhật nội dung sub-pane
        document.querySelectorAll('.settings-subpane').forEach(pane => pane.classList.add('hidden'));
        const activePane = document.getElementById(`subpane-${subTabId}`);
        if (activePane) activePane.classList.remove('hidden');

        // Nạp dữ liệu tương ứng
        if (subTabId === 'departments') this.loadDepartments();
        if (subTabId === 'users') this.loadUsersTable();
        if (subTabId === 'permissions') this.loadPermissionsView();
    },

    // 1. Dashboard Logic & Visual Charts
    statusChartInstance: null,
    deptChartInstance: null,

    async loadDashboard() {
        try {
            const dept_id = document.getElementById('dashFilterDept')?.value || '';
            const user_id = document.getElementById('dashFilterUser')?.value || '';

            // Cập nhật Badge phạm vi và Nút Reset
            const badge = document.getElementById('dashScopeBadge');
            const resetBtn = document.getElementById('btnResetDashScope');
            if (dept_id || user_id) {
                resetBtn?.classList.remove('hidden');
                if (user_id) {
                    const u = this.users.find(x => x.id == user_id);
                    if (badge) badge.innerText = `Cán bộ: ${u ? u.full_name : 'ID ' + user_id}`;
                } else if (dept_id) {
                    const d = this.departments.find(x => x.id == dept_id);
                    if (badge) badge.innerText = `Đơn vị: ${d ? d.name + ' (' + d.code + ')' : 'ID ' + dept_id}`;
                }
            } else {
                resetBtn?.classList.add('hidden');
                if (badge) badge.innerText = `Cấp Toàn Trường (12 Đơn vị)`;
            }

            const data = await API.getStatsSummary({ dept_id, user_id });
            const ov = data.overview;
            const prio = data.priority_stats || {};
            const deptStats = data.department_stats || [];
            const staffStats = data.staff_stats || [];

            // 1.1. Cập nhật KPI Counters
            if (document.getElementById('statTotalTasks')) document.getElementById('statTotalTasks').innerText = ov.total_tasks;
            if (document.getElementById('statInProgress')) document.getElementById('statInProgress').innerText = ov.in_progress_tasks;
            if (document.getElementById('statReview')) document.getElementById('statReview').innerText = ov.review_tasks;
            if (document.getElementById('statOverdue')) document.getElementById('statOverdue').innerText = ov.overdue_tasks || 0;
            if (document.getElementById('statCompleted')) document.getElementById('statCompleted').innerText = ov.completed_tasks;
            if (document.getElementById('statRate')) document.getElementById('statRate').innerText = `${ov.completion_rate}%`;

            // 1.2. Cập nhật Mức độ ưu tiên
            if (document.getElementById('statPrioKhanCap')) document.getElementById('statPrioKhanCap').innerText = prio.KHAN_CAP || 0;
            if (document.getElementById('statPrioCao')) document.getElementById('statPrioCao').innerText = prio.CAO || 0;
            if (document.getElementById('statPrioTrungBinh')) document.getElementById('statPrioTrungBinh').innerText = prio.TRUNG_BINH || 0;
            if (document.getElementById('statPrioThap')) document.getElementById('statPrioThap').innerText = prio.THAP || 0;

            // 1.3. Khởi tạo Biểu đồ 1: Doughnut Chart (Cơ cấu trạng thái nhiệm vụ)
            this.renderStatusDoughnutChart(ov);

            // 1.4. Khởi tạo Biểu đồ 2: Horizontal Bar Chart (Tiến độ 12 Đơn vị hoặc Cán bộ trong phòng)
            if (dept_id && staffStats.length > 0) {
                this.renderStaffProgressBarChart(staffStats);
            } else {
                this.renderDeptProgressBarChart(deptStats);
            }

            // 1.5. Render bảng chi tiết từng khoa/phòng hoặc từng cán bộ
            const tbody = document.getElementById('dashboardDeptTable');
            if (tbody) {
                if (dept_id && staffStats.length > 0) {
                    tbody.innerHTML = staffStats.map(s => `
                        <tr class="hover:bg-blue-50/40 border-b border-slate-100 transition">
                            <td class="px-4 py-3 text-center font-mono font-bold text-blue-900">
                                <span class="px-2 py-0.5 bg-blue-50 border border-blue-200 rounded">CB</span>
                            </td>
                            <td class="px-4 py-3 font-semibold text-slate-800">
                                <button onclick="App.filterAndGoToTasksByUser(${s.user_id})" class="text-left font-bold text-slate-900 hover:text-blue-800 transition">
                                    ${s.full_name}
                                </button>
                                <span class="text-xs text-slate-400 font-normal ml-1">(${s.position})</span>
                            </td>
                            <td class="px-4 py-3 text-center font-bold text-slate-800">${s.total_tasks}</td>
                            <td class="px-4 py-3 text-center font-bold text-cyan-700">${s.total_tasks - s.completed_tasks}</td>
                            <td class="px-4 py-3 text-center font-bold text-green-600">${s.completed_tasks}</td>
                            <td class="px-4 py-3">
                                <div class="flex items-center space-x-2">
                                    <div class="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                                        <div class="h-2.5 rounded-full ${s.avg_progress >= 80 ? 'bg-green-600' : s.avg_progress >= 50 ? 'bg-blue-600' : 'bg-amber-500'}" style="width: ${s.avg_progress}%"></div>
                                    </div>
                                    <span class="text-xs font-bold text-slate-700 w-10 text-right font-mono">${s.avg_progress}%</span>
                                </div>
                            </td>
                            <td class="px-4 py-3 text-right whitespace-nowrap">
                                <button onclick="App.filterAndGoToTasksByUser(${s.user_id})" class="px-2.5 py-1 bg-blue-50 hover:bg-blue-800 hover:text-white text-blue-700 rounded-lg text-xs font-semibold transition flex items-center space-x-1 ml-auto" title="Xem danh sách nhiệm vụ của cán bộ này">
                                    <i class="fa-solid fa-arrow-up-right-from-square text-[10px]"></i>
                                    <span>Xem việc</span>
                                </button>
                            </td>
                        </tr>
                    `).join('');
                } else if (deptStats.length === 0) {
                    tbody.innerHTML = `<tr><td colspan="7" class="text-center py-6 text-slate-400 text-xs">Chưa có dữ liệu phòng ban.</td></tr>`;
                } else {
                    tbody.innerHTML = deptStats.map(d => `
                        <tr class="hover:bg-blue-50/40 border-b border-slate-100 transition">
                            <td class="px-4 py-3 text-center font-mono font-bold text-blue-900">
                                <span class="px-2 py-0.5 bg-blue-50 border border-blue-200 rounded">${d.dept_code}</span>
                            </td>
                            <td class="px-4 py-3 font-semibold text-slate-800">
                                <button onclick="App.filterAndGoToTasksByDept(${d.dept_id})" class="text-left font-bold text-slate-900 hover:text-blue-800 transition">
                                    ${d.dept_name}
                                </button>
                            </td>
                            <td class="px-4 py-3 text-center font-bold text-slate-800">${d.total_tasks}</td>
                            <td class="px-4 py-3 text-center font-bold text-cyan-700">${d.in_progress_tasks || 0}</td>
                            <td class="px-4 py-3 text-center font-bold text-green-600">${d.completed_tasks}</td>
                            <td class="px-4 py-3">
                                <div class="flex items-center space-x-2">
                                    <div class="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                                        <div class="h-2.5 rounded-full ${d.avg_progress >= 80 ? 'bg-green-600' : d.avg_progress >= 50 ? 'bg-blue-600' : 'bg-amber-500'}" style="width: ${d.avg_progress}%"></div>
                                    </div>
                                    <span class="text-xs font-bold text-slate-700 w-10 text-right font-mono">${d.avg_progress}%</span>
                                </div>
                            </td>
                            <td class="px-4 py-3 text-right whitespace-nowrap">
                                <button onclick="App.filterAndGoToTasksByDept(${d.dept_id})" class="px-2.5 py-1 bg-blue-50 hover:bg-blue-800 hover:text-white text-blue-700 rounded-lg text-xs font-semibold transition flex items-center space-x-1 ml-auto" title="Xem danh sách nhiệm vụ của đơn vị này">
                                    <i class="fa-solid fa-arrow-up-right-from-square text-[10px]"></i>
                                    <span>Xem việc</span>
                                </button>
                            </td>
                        </tr>
                    `).join('');
                }
            }
        } catch (e) {
            console.error('Lỗi tải Dashboard:', e);
        }
    },

    renderStatusDoughnutChart(ov) {
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

        // If all 0, show placeholder
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
                cutout: '72%',
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
                            this.filterAndGoToTasks(selectedStatus);
                        }
                    }
                }
            }
        });
    },

    renderDeptProgressBarChart(deptStats) {
        const ctx = document.getElementById('chartDeptProgress');
        if (!ctx || typeof Chart === 'undefined') return;

        if (this.deptChartInstance) {
            this.deptChartInstance.destroy();
        }

        const labels = deptStats.map(d => `${d.dept_code} - ${d.dept_name}`);
        const progressValues = deptStats.map(d => d.avg_progress || 0);
        const totalTasksValues = deptStats.map(d => d.total_tasks || 0);

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
                        barPercentage: 0.7
                    },
                    {
                        label: 'Tổng số nhiệm vụ',
                        data: totalTasksValues,
                        backgroundColor: '#94a3b8',
                        borderRadius: 6,
                        barPercentage: 0.7
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
                        ticks: { font: { size: 10 } },
                        grid: { color: '#f1f5f9' }
                    },
                    y: {
                        ticks: {
                            font: { size: 10, weight: '600' },
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
                            font: { size: 11, weight: '600' }
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
                            this.filterAndGoToTasksByDept(dept.dept_id);
                        }
                    }
                }
            }
        });
    },

    renderStaffProgressBarChart(staffStats) {
        const ctx = document.getElementById('chartDeptProgress');
        if (!ctx || typeof Chart === 'undefined') return;

        if (this.deptChartInstance) {
            this.deptChartInstance.destroy();
        }

        const labels = staffStats.map(s => `${s.full_name} (${s.position})`);
        const progressValues = staffStats.map(s => s.avg_progress || 0);
        const totalTasksValues = staffStats.map(s => s.total_tasks || 0);

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
                        barPercentage: 0.7
                    },
                    {
                        label: 'Tổng số nhiệm vụ',
                        data: totalTasksValues,
                        backgroundColor: '#94a3b8',
                        borderRadius: 6,
                        barPercentage: 0.7
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
                        ticks: { font: { size: 10 } },
                        grid: { color: '#f1f5f9' }
                    },
                    y: {
                        ticks: {
                            font: { size: 10, weight: '600' },
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
                            font: { size: 11, weight: '600' }
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
                            this.filterAndGoToTasksByUser(staff.user_id);
                        }
                    }
                }
            }
        });
    },

    // Các hàm tương tác chuyển Tab và Lọc trực tiếp từ Dashboard
    filterAndGoToTasks(status = '') {
        const filterStatus = document.getElementById('filterStatus');
        const filterDept = document.getElementById('filterDept');
        const filterPriority = document.getElementById('filterPriority');
        const searchInput = document.getElementById('taskSearchInput');

        if (filterStatus) filterStatus.value = status;
        if (filterDept) filterDept.value = '';
        if (filterPriority) filterPriority.value = '';
        if (searchInput) searchInput.value = '';

        this.switchTab('tasks');
        this.showToast(`Đang lọc nhiệm vụ theo trạng thái: ${status || 'Tất cả'}`, 'info');
    },

    filterAndGoToTasksByPriority(priority = '') {
        const filterStatus = document.getElementById('filterStatus');
        const filterDept = document.getElementById('filterDept');
        const filterPriority = document.getElementById('filterPriority');
        const searchInput = document.getElementById('taskSearchInput');

        if (filterPriority) filterPriority.value = priority;
        if (filterStatus) filterStatus.value = '';
        if (filterDept) filterDept.value = '';
        if (searchInput) searchInput.value = '';

        this.switchTab('tasks');
        this.showToast(`Đang lọc nhiệm vụ theo độ ưu tiên: ${priority}`, 'info');
    },

    filterAndGoToTasksByDept(deptId) {
        const filterStatus = document.getElementById('filterStatus');
        const filterDept = document.getElementById('filterDept');
        const filterPriority = document.getElementById('filterPriority');
        const searchInput = document.getElementById('taskSearchInput');

        if (filterDept) filterDept.value = deptId;
        if (filterStatus) filterStatus.value = '';
        if (filterPriority) filterPriority.value = '';
        if (searchInput) searchInput.value = '';

        this.switchTab('tasks');
        const dept = this.departments.find(d => d.id === deptId);
        this.showToast(`Đang hiển thị công việc của đơn vị: ${dept ? dept.name : deptId}`, 'info');
    },

    filterAndGoToTasksByUser(userId) {
        const filterStatus = document.getElementById('filterStatus');
        const filterDept = document.getElementById('filterDept');
        const filterPriority = document.getElementById('filterPriority');
        const searchInput = document.getElementById('taskSearchInput');

        if (filterDept) filterDept.value = '';
        if (filterStatus) filterStatus.value = '';
        if (filterPriority) filterPriority.value = '';
        if (searchInput) searchInput.value = '';

        this.switchTab('tasks');
        const user = this.users.find(u => u.id === userId);
        this.showToast(`Đang hiển thị công việc của cán bộ: ${user ? user.full_name : userId}`, 'info');
    },

    // 2. Task Management Logic
    async loadTasks() {
        const status = document.getElementById('filterStatus')?.value || '';
        const priority = document.getElementById('filterPriority')?.value || '';
        const dept_id = document.getElementById('filterDept')?.value || '';
        const search = document.getElementById('taskSearchInput')?.value || '';

        try {
            this.tasks = await API.getTasks({ status, priority, dept_id, search });
            this.renderTasksTable();
        } catch (e) {
            this.showToast('Lỗi nạp danh sách công việc', 'error');
        }
    },

    renderTasksTable() {
        const tbody = document.getElementById('tasksTableBody');
        if (!tbody) return;

        if (this.tasks.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center py-8 text-slate-400">Không tìm thấy công việc nào phù hợp</td></tr>`;
            return;
        }

        tbody.innerHTML = this.tasks.map(t => {
            const priorityBadge = this.getPriorityBadge(t.priority);
            const statusBadge = this.getStatusBadge(t.status);
            const leading = t.leading_department ? t.leading_department.name : 'Chưa gán';
            const assigneeName = t.assignee ? t.assignee.full_name : '<span class="text-slate-400 italic">Chưa phân công</span>';
            const dueDate = t.due_date ? new Date(t.due_date).toLocaleDateString('vi-VN') : 'Không hạn';

            return `
                <tr class="hover:bg-slate-50 border-b border-slate-100 transition">
                    <td class="px-4 py-3 font-medium text-slate-800">
                        <div class="font-bold text-blue-900">${t.title}</div>
                        <div class="text-xs text-slate-500 line-clamp-1">${t.description || ''}</div>
                    </td>
                    <td class="px-4 py-3 text-xs text-slate-700">
                        <div class="font-semibold">${leading}</div>
                        ${t.assisting_department ? `<div class="text-[11px] text-slate-400">Phối hợp: ${t.assisting_department.name}</div>` : ''}
                    </td>
                    <td class="px-4 py-3 text-xs font-medium text-slate-700">${assigneeName}</td>
                    <td class="px-4 py-3 text-center">${priorityBadge}</td>
                    <td class="px-4 py-3 text-center">${statusBadge}</td>
                    <td class="px-4 py-3">
                        <div class="flex items-center space-x-2">
                            <div class="w-24 bg-slate-200 rounded-full h-2">
                                <div class="bg-blue-600 h-2 rounded-full" style="width: ${t.progress_percent}%"></div>
                            </div>
                            <span class="text-xs font-bold text-slate-600">${t.progress_percent}%</span>
                        </div>
                        <div class="text-[10px] text-slate-400 mt-1">Hạn: ${dueDate}</div>
                    </td>
                    <td class="px-4 py-3 text-right space-x-1">
                        <button onclick="App.openUpdateTaskModal(${t.id})" class="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded text-xs font-semibold title='Cập nhật tiến độ'">
                            <i class="fa-solid fa-pen-to-square"></i> Cập nhật
                        </button>
                        <button onclick="App.openTaskDetailModal(${t.id})" class="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs title='Chi tiết & Trao đổi'">
                            <i class="fa-solid fa-comments"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    },

    getPriorityBadge(p) {
        const map = {
            'THAP': '<span class="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-300">Thấp</span>',
            'TRUNG_BINH': '<span class="px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">Trung bình</span>',
            'CAO': '<span class="px-2 py-0.5 rounded text-[11px] font-semibold bg-orange-50 text-orange-700 border border-orange-200">Cao</span>',
            'KHAN_CAP': '<span class="px-2 py-0.5 rounded text-[11px] font-semibold bg-red-100 text-red-700 border border-red-300 animate-pulse">⚡ Khẩn cấp</span>'
        };
        return map[p] || p;
    },

    getStatusBadge(s) {
        const map = {
            'CHUA_BAT_DAU': '<span class="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600">Chưa bắt đầu</span>',
            'DANG_THUC_HIEN': '<span class="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-100 text-blue-800">Đang thực hiện</span>',
            'CHO_DUYET': '<span class="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800">Chờ duyệt</span>',
            'HOAN_THANH': '<span class="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-green-100 text-green-800">✓ Hoàn thành</span>',
            'TRE_HAN': '<span class="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-100 text-red-800">Trễ hạn</span>',
            'TAM_DUNG': '<span class="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-200 text-slate-600">Tạm dừng</span>'
        };
        return map[s] || s;
    },

    // Modal Create Task
    openCreateTaskModal() {
        document.getElementById('formCreateTask').reset();
        document.getElementById('modalCreateTask').classList.remove('hidden');
    },

    closeCreateTaskModal() {
        document.getElementById('modalCreateTask').classList.add('hidden');
    },

    async handleCreateTask(e) {
        e.preventDefault();
        const title = document.getElementById('taskTitle').value.trim();
        const description = document.getElementById('taskDescription').value.trim();
        const leading_dept_id = document.getElementById('taskLeadingDept').value || null;
        const assisting_dept_id = document.getElementById('taskAssistingDept').value || null;
        const assignee_id = document.getElementById('taskAssignee').value || null;
        const priority = document.getElementById('taskPriority').value;
        const due_date_val = document.getElementById('taskDueDate').value;

        const payload = {
            title,
            description,
            leading_dept_id: leading_dept_id ? parseInt(leading_dept_id) : null,
            assisting_dept_id: assisting_dept_id ? parseInt(assisting_dept_id) : null,
            assignee_id: assignee_id ? parseInt(assignee_id) : null,
            priority,
            status: 'CHUA_BAT_DAU',
            progress_percent: 0,
            due_date: due_date_val ? new Date(due_date_val).toISOString() : null
        };

        try {
            await API.createTask(payload);
            this.showToast('Giao nhiệm vụ thành công!', 'success');
            this.closeCreateTaskModal();
            this.loadTasks();
        } catch (err) {
            this.showToast(err.message || 'Lỗi khi tạo công việc', 'error');
        }
    },

    // Modal Update Task Progress
    async openUpdateTaskModal(taskId) {
        try {
            const task = await API.getTaskDetail(taskId);
            document.getElementById('updateTaskId').value = task.id;
            document.getElementById('updateTaskTitle').innerText = task.title;
            document.getElementById('updateStatus').value = task.status;
            document.getElementById('updateProgress').value = task.progress_percent;
            document.getElementById('progressValueDisplay').innerText = `${task.progress_percent}%`;
            document.getElementById('updateComment').value = '';
            document.getElementById('modalUpdateTask').classList.remove('hidden');
        } catch (err) {
            this.showToast('Không thể tải chi tiết công việc', 'error');
        }
    },

    closeUpdateTaskModal() {
        document.getElementById('modalUpdateTask').classList.add('hidden');
    },

    async handleUpdateTask(e) {
        e.preventDefault();
        const id = document.getElementById('updateTaskId').value;
        const status = document.getElementById('updateStatus').value;
        const progress_percent = parseInt(document.getElementById('updateProgress').value);
        const comment = document.getElementById('updateComment').value.trim();

        try {
            await API.updateTask(id, { status, progress_percent });
            if (comment) {
                await API.addComment(id, comment);
            }
            this.showToast('Cập nhật tiến độ thành công!', 'success');
            this.closeUpdateTaskModal();
            this.loadTasks();
        } catch (err) {
            this.showToast(err.message || 'Lỗi cập nhật', 'error');
        }
    },

    // Modal View Detail & Comments
    async openTaskDetailModal(taskId) {
        try {
            const t = await API.getTaskDetail(taskId);
            document.getElementById('detailTaskTitle').innerText = t.title;
            document.getElementById('detailTaskDesc').innerText = t.description || 'Không có mô tả chi tiết.';
            document.getElementById('detailLeadingDept').innerText = t.leading_department ? t.leading_department.name : 'Chưa gán';
            document.getElementById('detailAssistingDept').innerText = t.assisting_department ? t.assisting_department.name : 'Không có';
            document.getElementById('detailAssignee').innerText = t.assignee ? t.assignee.full_name : 'Chưa phân công';
            document.getElementById('detailStatus').innerHTML = this.getStatusBadge(t.status);
            document.getElementById('detailPriority').innerHTML = this.getPriorityBadge(t.priority);
            document.getElementById('detailProgress').innerText = `${t.progress_percent}%`;
            document.getElementById('detailTaskIdInput').value = t.id;

            // Render comments
            const commentList = document.getElementById('detailCommentsList');
            if (t.comments && t.comments.length > 0) {
                commentList.innerHTML = t.comments.map(c => `
                    <div class="bg-slate-50 p-3 rounded-lg border border-slate-200">
                        <div class="flex justify-between items-center mb-1">
                            <span class="font-bold text-xs text-blue-900">${c.author ? c.author.full_name : 'Người dùng'}</span>
                            <span class="text-[10px] text-slate-400">${new Date(c.created_at).toLocaleString('vi-VN')}</span>
                        </div>
                        <p class="text-xs text-slate-700 whitespace-pre-wrap">${c.content}</p>
                    </div>
                `).join('');
            } else {
                commentList.innerHTML = `<p class="text-xs text-slate-400 italic">Chưa có ý kiến trao đổi nào.</p>`;
            }

            document.getElementById('modalTaskDetail').classList.remove('hidden');
        } catch (e) {
            this.showToast('Lỗi tải chi tiết', 'error');
        }
    },

    closeTaskDetailModal() {
        document.getElementById('modalTaskDetail').classList.add('hidden');
    },

    async handleAddComment(e) {
        e.preventDefault();
        const taskId = document.getElementById('detailTaskIdInput').value;
        const input = document.getElementById('newCommentInput');
        const content = input.value.trim();
        if (!content) return;

        try {
            await API.addComment(taskId, content);
            input.value = '';
            this.openTaskDetailModal(taskId); // Refresh
        } catch (e) {
            this.showToast('Lỗi khi gửi phản hồi', 'error');
        }
    },

    // 3. Departments Logic
    deptViewMode: 'grid',

    setDeptViewMode(mode) {
        this.deptViewMode = mode;
        const btnGrid = document.getElementById('btnDeptViewGrid');
        const btnTable = document.getElementById('btnDeptViewTable');
        const gridContainer = document.getElementById('departmentsGrid');
        const tableContainer = document.getElementById('departmentsTableContainer');

        if (mode === 'grid') {
            btnGrid.className = 'px-2.5 py-1 rounded font-bold transition flex items-center space-x-1 bg-white text-blue-900 shadow-xs';
            btnTable.className = 'px-2.5 py-1 rounded font-medium transition flex items-center space-x-1 text-slate-600 hover:text-slate-900';
            gridContainer?.classList.remove('hidden');
            tableContainer?.classList.add('hidden');
        } else {
            btnTable.className = 'px-2.5 py-1 rounded font-bold transition flex items-center space-x-1 bg-white text-blue-900 shadow-xs';
            btnGrid.className = 'px-2.5 py-1 rounded font-medium transition flex items-center space-x-1 text-slate-600 hover:text-slate-900';
            tableContainer?.classList.remove('hidden');
            gridContainer?.classList.add('hidden');
        }
    },

    async loadDepartments() {
        try {
            this.departments = await API.getDepartments();
            this.filterDepartments();
        } catch (e) {
            this.showToast('Lỗi tải danh sách phòng ban', 'error');
        }
    },

    filterDepartments() {
        const query = document.getElementById('searchDeptInput')?.value.toLowerCase().trim() || '';
        let filtered = this.departments;
        if (query) {
            filtered = this.departments.filter(d => 
                d.name.toLowerCase().includes(query) || 
                d.code.toLowerCase().includes(query) ||
                (d.description && d.description.toLowerCase().includes(query))
            );
        }

        const countLabel = document.getElementById('deptCountLabel');
        if (countLabel) {
            countLabel.innerText = `Hiển thị ${filtered.length} / ${this.departments.length} Đơn vị`;
        }

        this.renderDepartmentsList(filtered);
    },

    renderDepartmentsList(list) {
        // 1. Render Grid Cards
        const grid = document.getElementById('departmentsGrid');
        if (grid) {
            if (list.length === 0) {
                grid.innerHTML = `<div class="col-span-3 text-center py-8 text-slate-400 text-xs">Không tìm thấy đơn vị phù hợp.</div>`;
            } else {
                grid.innerHTML = list.map(d => `
                    <div class="bg-white p-5 rounded-xl border border-slate-200 shadow-xs hover:shadow-md transition flex flex-col justify-between group">
                        <div>
                            <div class="flex items-center justify-between mb-2">
                                <span class="px-2.5 py-0.5 bg-blue-100 text-blue-800 text-xs font-black rounded-md tracking-wide font-mono">${d.code}</span>
                                <span class="flex items-center space-x-1 text-[11px] ${d.is_active ? 'text-green-600 font-semibold' : 'text-red-500'}">
                                    <span class="w-2 h-2 rounded-full ${d.is_active ? 'bg-green-500' : 'bg-red-500'}"></span>
                                    <span>${d.is_active ? 'Hoạt động' : 'Tạm ngưng'}</span>
                                </span>
                            </div>
                            <h3 class="font-bold text-slate-900 text-sm mb-1">${d.name}</h3>
                            <p class="text-xs text-slate-500 mb-3 line-clamp-2">${d.description || 'Không có ghi chú'}</p>
                        </div>
                        <div class="pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-600">
                            <div>
                                <div><i class="fa-solid fa-phone text-slate-400 mr-1.5"></i> ${d.phone || 'Chưa có'}</div>
                                <div><i class="fa-solid fa-envelope text-slate-400 mr-1.5"></i> ${d.email || 'Chưa có'}</div>
                            </div>
                            <div class="space-x-1">
                                <button onclick="App.openEditDeptModal(${d.id})" class="px-2.5 py-1 bg-slate-100 hover:bg-blue-800 hover:text-white rounded-lg text-slate-700 font-semibold transition" title="Chỉnh sửa">
                                    <i class="fa-solid fa-pen-to-square mr-1"></i> Sửa
                                </button>
                                <button onclick="App.deleteDepartment(${d.id}, '${d.name.replace(/'/g, "\\'")}')" class="px-2 py-1 bg-slate-100 hover:bg-red-50 text-slate-500 hover:text-red-700 rounded-lg font-semibold transition" title="Xóa đơn vị">
                                    <i class="fa-solid fa-trash-can"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                `).join('');
            }
        }

        // 2. Render Table View (Danh Sách Ngang Chi Tiết)
        const tbody = document.getElementById('departmentsTableBody');
        if (tbody) {
            if (list.length === 0) {
                tbody.innerHTML = `<tr><td colspan="8" class="text-center py-6 text-slate-400 text-xs">Không có dữ liệu phù hợp.</td></tr>`;
            } else {
                tbody.innerHTML = list.map((d, index) => `
                    <tr class="hover:bg-slate-50 border-b border-slate-100 text-xs">
                        <td class="px-4 py-3 text-center text-slate-400 font-mono">${index + 1}</td>
                        <td class="px-4 py-3 font-mono font-bold text-blue-800">
                            <span class="px-2 py-0.5 bg-blue-50 border border-blue-200 rounded">${d.code}</span>
                        </td>
                        <td class="px-4 py-3 font-bold text-slate-900">${d.name}</td>
                        <td class="px-4 py-3 text-slate-600 font-mono">${d.phone || '-'}</td>
                        <td class="px-4 py-3 text-slate-600">${d.email || '-'}</td>
                        <td class="px-4 py-3 text-slate-600 max-w-xs truncate" title="${d.description || ''}">${d.description || '-'}</td>
                        <td class="px-4 py-3 text-center whitespace-nowrap">
                            <span class="inline-block px-2.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap ${d.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}">
                                ${d.is_active ? 'Hoạt động' : 'Tạm ngưng'}
                            </span>
                        </td>
                        <td class="px-4 py-3 text-right whitespace-nowrap">
                            <div class="inline-flex items-center space-x-1.5">
                                <button onclick="App.openEditDeptModal(${d.id})" class="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-800 hover:text-white text-blue-700 rounded-lg text-xs font-bold transition flex items-center space-x-1" title="Sửa">
                                    <i class="fa-solid fa-pen-to-square"></i>
                                    <span>Sửa</span>
                                </button>
                                <button onclick="App.deleteDepartment(${d.id}, '${d.name.replace(/'/g, "\\'")}')" class="px-2 py-1.5 bg-red-50 hover:bg-red-600 hover:text-white text-red-600 rounded-lg text-xs font-bold transition flex items-center space-x-1" title="Xóa">
                                    <i class="fa-solid fa-trash-can"></i>
                                    <span>Xóa</span>
                                </button>
                            </div>
                        </td>
                    </tr>
                `).join('');
            }
        }
    },

    async deleteDepartment(deptId, deptName) {
        if (!confirm(`Bạn có chắc chắn muốn xóa đơn vị "${deptName}"?\nLưu ý: Không thể xóa nếu đang có cán bộ trực thuộc.`)) return;

        try {
            const res = await API.deleteDepartment(deptId);
            this.showToast(res.message || `Đã xóa đơn vị thành công!`, 'success');
            await this.loadInitialData();
            this.loadDepartments();
        } catch (err) {
            this.showToast(err.message || 'Lỗi khi xóa đơn vị', 'error');
        }
    },

    openCreateDeptModal() {
        document.getElementById('formDept').reset();
        document.getElementById('formDeptId').value = '';
        document.getElementById('modalDeptTitle').innerText = 'Thêm Mới Đơn Vị / Phòng / Khoa';
        document.getElementById('formDeptCode').readOnly = false;
        document.getElementById('modalDeptForm').classList.remove('hidden');
    },

    openEditDeptModal(deptId) {
        const dept = this.departments.find(d => d.id === deptId);
        if (!dept) return;

        document.getElementById('formDeptId').value = dept.id;
        document.getElementById('formDeptCode').value = dept.code;
        document.getElementById('formDeptCode').readOnly = true;
        document.getElementById('formDeptName').value = dept.name;
        document.getElementById('formDeptPhone').value = dept.phone || '';
        document.getElementById('formDeptEmail').value = dept.email || '';
        document.getElementById('formDeptDesc').value = dept.description || '';
        document.getElementById('modalDeptTitle').innerText = `Chỉnh Sửa: ${dept.name} (${dept.code})`;
        document.getElementById('modalDeptForm').classList.remove('hidden');
    },

    closeDeptModal() {
        document.getElementById('modalDeptForm').classList.add('hidden');
    },

    async handleSaveDept(e) {
        e.preventDefault();
        const id = document.getElementById('formDeptId').value;
        const code = document.getElementById('formDeptCode').value.trim().toUpperCase();
        const name = document.getElementById('formDeptName').value.trim();
        const phone = document.getElementById('formDeptPhone').value.trim();
        const email = document.getElementById('formDeptEmail').value.trim();
        const description = document.getElementById('formDeptDesc').value.trim();

        const btn = document.getElementById('btnSubmitDept');
        btn.disabled = true;
        btn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin mr-1"></i> Đang lưu...`;

        try {
            if (id) {
                await API.updateDepartment(id, { name, phone, email, description });
                this.showToast('Cập nhật thông tin phòng ban thành công!', 'success');
            } else {
                await API.createDepartment({ code, name, phone, email, description });
                this.showToast('Thêm mới phòng ban thành công!', 'success');
            }
            this.closeDeptModal();
            await this.loadInitialData();
            this.loadDepartments();
        } catch (err) {
            this.showToast(err.message || 'Lỗi lưu thông tin đơn vị', 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = `Lưu Đơn Vị`;
        }
    },

    // 4. Users Logic
    async loadUsersTable() {
        try {
            this.users = await API.getUsers();
            const tbody = document.getElementById('usersTableBody');
            if (!tbody) return;

            tbody.innerHTML = this.users.map(u => `
                <tr class="hover:bg-slate-50 border-b border-slate-100 text-xs">
                    <td class="px-4 py-3 font-semibold text-slate-800 whitespace-nowrap">
                        <div>${u.full_name}</div>
                        ${!u.is_active ? '<span class="text-[10px] text-red-500 font-bold">(Đã khóa)</span>' : ''}
                    </td>
                    <td class="px-4 py-3 font-mono text-slate-600 whitespace-nowrap">@${u.username}</td>
                    <td class="px-4 py-3 text-slate-600 whitespace-nowrap">${u.email}</td>
                    <td class="px-4 py-3 whitespace-nowrap">${u.department ? `<span class="font-semibold text-blue-900">${u.department.name}</span> <span class="text-xs text-slate-400">(${u.department.code})</span>` : '<span class="text-slate-400 italic">Chưa gán</span>'}</td>
                    <td class="px-4 py-3 whitespace-nowrap"><span class="px-2 py-0.5 rounded font-bold ${u.role === 'SUPERADMIN' ? 'bg-purple-100 text-purple-800' : u.role === 'DEPT_HEAD' ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-700'}">${u.role}</span></td>
                    <td class="px-4 py-3 text-slate-600 whitespace-nowrap">${u.position || '-'}</td>
                    <td class="px-4 py-3 text-right whitespace-nowrap">
                        <div class="inline-flex items-center space-x-1.5">
                            <button onclick="App.openEditUserModal(${u.id})" class="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-800 hover:text-white text-blue-700 rounded-lg text-xs font-bold transition flex items-center space-x-1" title="Chỉnh sửa thông tin">
                                <i class="fa-solid fa-pen-to-square"></i>
                                <span>Sửa</span>
                            </button>
                            <button onclick="App.toggleUserStatus(${u.id}, ${u.is_active})" class="p-1.5 px-2 ${u.is_active ? 'bg-slate-100 hover:bg-amber-50 text-slate-600 hover:text-amber-700' : 'bg-green-50 text-green-700 hover:bg-green-100'} rounded-lg text-xs font-bold transition" title="${u.is_active ? 'Khóa tài khoản' : 'Kích hoạt lại'}">
                                <i class="fa-solid ${u.is_active ? 'fa-user-lock' : 'fa-user-check'}"></i>
                            </button>
                            <button onclick="App.deleteUser(${u.id}, '${u.full_name.replace(/'/g, "\\'")}')" class="p-1.5 px-2 bg-red-50 hover:bg-red-600 hover:text-white text-red-600 rounded-lg text-xs font-bold transition" title="Xóa tài khoản">
                                <i class="fa-solid fa-trash-can"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `).join('');
        } catch (e) {
            this.showToast('Lỗi tải danh sách nhân sự', 'error');
        }
    },

    async deleteUser(userId, userFullName) {
        if (!confirm(`Bạn có chắc chắn muốn xóa vĩnh viễn tài khoản cán bộ "${userFullName}"?\nThao tác này không thể hoàn tác.`)) return;

        try {
            const res = await API.deleteUser(userId);
            this.showToast(res.message || `Đã xóa tài khoản thành công!`, 'success');
            await this.loadInitialData();
            this.loadUsersTable();
        } catch (err) {
            this.showToast(err.message || 'Lỗi khi xóa tài khoản', 'error');
        }
    },

    openCreateUserModal() {
        document.getElementById('formUser').reset();
        document.getElementById('formUserId').value = '';
        document.getElementById('formUserUsername').readOnly = false;
        document.getElementById('formUserPassword').required = true;
        document.getElementById('formUserPasswordLabel').innerText = 'Mật khẩu khởi tạo *';
        document.getElementById('modalUserTitle').innerText = 'Thêm Mới Cán Bộ / Giảng Viên';
        document.getElementById('modalUserForm').classList.remove('hidden');
    },

    openEditUserModal(userId) {
        const user = this.users.find(u => u.id === userId);
        if (!user) return;

        document.getElementById('formUserId').value = user.id;
        document.getElementById('formUserFullName').value = user.full_name;
        document.getElementById('formUserUsername').value = user.username;
        document.getElementById('formUserUsername').readOnly = true;
        document.getElementById('formUserEmail').value = user.email;
        document.getElementById('formUserPhone').value = user.phone || '';
        document.getElementById('formUserDept').value = user.department_id || '';
        document.getElementById('formUserRole').value = user.role;
        document.getElementById('formUserPosition').value = user.position || '';
        document.getElementById('formUserPassword').value = '';
        document.getElementById('formUserPassword').required = false;
        document.getElementById('formUserPasswordLabel').innerText = 'Đổi mật khẩu mới (để trống nếu không đổi)';
        document.getElementById('modalUserTitle').innerText = `Chỉnh Sửa Thông Tin: ${user.full_name}`;
        document.getElementById('modalUserForm').classList.remove('hidden');
    },

    closeUserModal() {
        document.getElementById('modalUserForm').classList.add('hidden');
    },

    async handleSaveUser(e) {
        e.preventDefault();
        const id = document.getElementById('formUserId').value;
        const full_name = document.getElementById('formUserFullName').value.trim();
        const username = document.getElementById('formUserUsername').value.trim();
        const email = document.getElementById('formUserEmail').value.trim();
        const phone = document.getElementById('formUserPhone').value.trim();
        const deptVal = document.getElementById('formUserDept').value;
        const department_id = deptVal ? parseInt(deptVal) : null;
        const role = document.getElementById('formUserRole').value;
        const position = document.getElementById('formUserPosition').value.trim();
        const password = document.getElementById('formUserPassword').value;

        const btn = document.getElementById('btnSubmitUser');
        btn.disabled = true;
        btn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin mr-1"></i> Đang lưu...`;

        try {
            if (id) {
                const updatePayload = { full_name, email, phone, department_id, role, position };
                if (password) updatePayload.password = password;
                await API.updateUser(id, updatePayload);
                this.showToast('Cập nhật thông tin cán bộ thành công!', 'success');
            } else {
                await API.createUser({ full_name, username, email, phone, department_id, role, position, password });
                this.showToast('Thêm mới cán bộ thành công!', 'success');
            }
            this.closeUserModal();
            await this.loadInitialData();
            this.loadUsersTable();
        } catch (err) {
            this.showToast(err.message || 'Lỗi lưu thông tin cán bộ', 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = `Lưu Thông Tin`;
        }
    },

    async toggleUserStatus(userId, currentStatus) {
        const actionText = currentStatus ? 'khóa' : 'mở khóa';
        if (!confirm(`Bạn có chắc chắn muốn ${actionText} tài khoản này?`)) return;

        try {
            await API.updateUser(userId, { is_active: !currentStatus });
            this.showToast(`Đã ${actionText} tài khoản thành công!`, 'success');
            await this.loadInitialData();
            this.loadUsersTable();
        } catch (err) {
            this.showToast(err.message || 'Lỗi cập nhật trạng thái tài khoản', 'error');
        }
    },

    // 5. Granular Permissions Logic
    permCatalog: [],
    selectedPermUserId: null,
    selectedUserPermissions: [],

    async loadPermissionsView() {
        try {
            if (this.permCatalog.length === 0) {
                this.permCatalog = await API.getPermissionsCatalog();
            }
            if (this.users.length === 0) {
                this.users = await API.getUsers();
            }

            this.renderPermUsersList();
            this.renderPermissionCheckboxes();

            // Mặc định chọn người đầu tiên (hoặc tài khoản qtdt)
            if (!this.selectedPermUserId && this.users.length > 0) {
                const defaultUser = this.users.find(u => u.username === 'qtdt') || this.users[0];
                this.selectPermUser(defaultUser.id);
            } else if (this.selectedPermUserId) {
                this.selectPermUser(this.selectedPermUserId);
            }
        } catch (e) {
            this.showToast('Lỗi tải danh mục phân quyền', 'error');
        }
    },

    openUserPermissionConfig(userId) {
        this.selectedPermUserId = userId;
        this.currentSettingsSubTab = 'permissions';
        this.switchTab('settings');
        this.switchSettingsSubTab('permissions');
        this.selectPermUser(userId);
    },

    filterPermUsers() {
        const query = document.getElementById('searchPermUser')?.value.toLowerCase() || '';
        this.renderPermUsersList(query);
    },

    renderPermUsersList(searchQuery = '') {
        const container = document.getElementById('permUsersList');
        const countLabel = document.getElementById('permUserCount');
        if (!container) return;

        let filtered = this.users;
        if (searchQuery) {
            filtered = this.users.filter(u =>
                u.full_name.toLowerCase().includes(searchQuery) ||
                u.username.toLowerCase().includes(searchQuery)
            );
        }

        if (countLabel) countLabel.innerText = `${filtered.length} người`;

        container.innerHTML = filtered.map(u => {
            const isSelected = u.id === this.selectedPermUserId;
            const roleBadge = u.role === 'SUPERADMIN' ? 'bg-purple-100 text-purple-800' :
                              u.role === 'DEPT_HEAD' ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-700';

            return `
                <div onclick="App.selectPermUser(${u.id})"
                    class="p-2.5 rounded-lg border cursor-pointer transition flex items-center justify-between text-xs ${isSelected ? 'bg-blue-50 border-blue-500 shadow-xs' : 'bg-white border-slate-200 hover:bg-slate-50'}">
                    <div>
                        <div class="font-bold text-slate-800">${u.full_name}</div>
                        <div class="text-[11px] text-slate-500 font-mono">@${u.username} • ${u.department ? u.department.name : 'HueIC'}</div>
                    </div>
                    <span class="px-2 py-0.5 rounded text-[10px] font-bold ${roleBadge}">${u.role}</span>
                </div>
            `;
        }).join('');
    },

    async selectPermUser(userId) {
        this.selectedPermUserId = userId;
        this.renderPermUsersList(document.getElementById('searchPermUser')?.value.toLowerCase() || '');

        const user = this.users.find(u => u.id === userId);
        if (!user) return;

        try {
            const data = await API.getUserPermissions(userId);
            this.selectedUserPermissions = data.permissions || [];

            // Cập nhật thẻ thông tin user đang chọn
            document.getElementById('selectedUserFullName').innerText = user.full_name;
            document.getElementById('selectedUserMeta').innerText = `@${user.username} • ${user.position || user.role} • ${user.department ? user.department.name : 'HueIC'}`;
            this.updateSelectedPermCount();

            // Cập nhật trạng thái checked cho các checkbox
            document.querySelectorAll('.perm-checkbox').forEach(cb => {
                const code = cb.getAttribute('data-perm-code');
                cb.checked = this.selectedUserPermissions.includes(code) || this.selectedUserPermissions.includes('*');
            });

            // Cập nhật checkbox toggle của từng nhóm
            this.permCatalog.forEach(g => {
                this.updateGroupSelectAllCheckbox(g.group_id);
            });

        } catch (e) {
            this.showToast('Lỗi nạp quyền của người dùng', 'error');
        }
    },

    renderPermissionCheckboxes() {
        const container = document.getElementById('permissionGroupsContainer');
        if (!container) return;

        container.innerHTML = this.permCatalog.map(group => `
            <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
                <div class="flex justify-between items-center pb-2 border-b border-slate-100">
                    <div>
                        <h4 class="font-bold text-sm text-slate-900">${group.group_name}</h4>
                        <p class="text-[11px] text-slate-400">${group.description}</p>
                    </div>
                    <label class="flex items-center space-x-1.5 text-xs text-blue-700 font-semibold cursor-pointer select-none">
                        <input type="checkbox" id="group-toggle-${group.group_id}"
                            onchange="App.toggleGroupPermissions('${group.group_id}', this.checked)"
                            class="rounded text-blue-600 focus:ring-blue-500">
                        <span>Chọn nhóm này</span>
                    </label>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                    ${group.permissions.map(p => `
                        <label class="flex items-start p-2.5 rounded-lg border border-slate-100 hover:bg-slate-50 cursor-pointer space-x-2.5 transition">
                            <input type="checkbox" data-perm-code="${p.code}" data-group-id="${group.group_id}"
                                onchange="App.togglePermission('${p.code}', this.checked)"
                                class="perm-checkbox mt-0.5 rounded text-blue-600 focus:ring-blue-500">
                            <div class="text-xs">
                                <div class="font-bold text-slate-800">${p.name}</div>
                                <div class="text-[11px] text-slate-400 font-mono">${p.code}</div>
                                <div class="text-[11px] text-slate-500 mt-0.5">${p.description}</div>
                            </div>
                        </label>
                    `).join('')}
                </div>
            </div>
        `).join('');
    },

    togglePermission(code, isChecked) {
        if (isChecked) {
            if (!this.selectedUserPermissions.includes(code)) {
                this.selectedUserPermissions.push(code);
            }
        } else {
            this.selectedUserPermissions = this.selectedUserPermissions.filter(c => c !== code && c !== '*');
        }
        this.updateSelectedPermCount();

        // Cập nhật lại toggle của group chứa permission này
        const cb = document.querySelector(`.perm-checkbox[data-perm-code="${code}"]`);
        if (cb) {
            const groupId = cb.getAttribute('data-group-id');
            this.updateGroupSelectAllCheckbox(groupId);
        }
    },

    toggleGroupPermissions(groupId, isChecked) {
        const group = this.permCatalog.find(g => g.group_id === groupId);
        if (!group) return;

        group.permissions.forEach(p => {
            const cb = document.querySelector(`.perm-checkbox[data-perm-code="${p.code}"]`);
            if (cb) cb.checked = isChecked;

            if (isChecked) {
                if (!this.selectedUserPermissions.includes(p.code)) {
                    this.selectedUserPermissions.push(p.code);
                }
            } else {
                this.selectedUserPermissions = this.selectedUserPermissions.filter(c => c !== p.code && c !== '*');
            }
        });

        this.updateSelectedPermCount();
    },

    updateGroupSelectAllCheckbox(groupId) {
        const group = this.permCatalog.find(g => g.group_id === groupId);
        if (!group) return;

        const groupCheckboxes = document.querySelectorAll(`.perm-checkbox[data-group-id="${groupId}"]`);
        const allChecked = Array.from(groupCheckboxes).every(cb => cb.checked);
        const toggle = document.getElementById(`group-toggle-${groupId}`);
        if (toggle) toggle.checked = allChecked;
    },

    updateSelectedPermCount() {
        const total = 13;
        const count = this.selectedUserPermissions.includes('*') ? total : this.selectedUserPermissions.length;
        const display = document.getElementById('selectedUserPermCount');
        if (display) display.innerText = `${count} quyền`;
    },

    async saveUserPermissions() {
        if (!this.selectedPermUserId) {
            this.showToast('Vui lòng chọn cán bộ để lưu quyền', 'error');
            return;
        }

        const btn = document.getElementById('btnSavePerms');
        btn.disabled = true;
        btn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin mr-1"></i> Đang lưu...`;

        try {
            await API.updateUserPermissions(this.selectedPermUserId, this.selectedUserPermissions);
            this.showToast('Lưu cấu hình phân quyền thành công!', 'success');
        } catch (err) {
            this.showToast(err.message || 'Lỗi khi cập nhật quyền', 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = `<i class="fa-solid fa-floppy-disk mr-1"></i> Lưu Cấu Hình Phân Quyền`;
        }
    },

    async resetCurrentPermissionsToDefault() {
        if (!this.selectedPermUserId) return;
        try {
            const res = await API.resetUserPermissions(this.selectedPermUserId);
            this.selectedUserPermissions = res.permissions || [];
            this.selectPermUser(this.selectedPermUserId);
            this.showToast('Đã khôi phục quyền mặc định theo vai trò!', 'success');
        } catch (err) {
            this.showToast('Lỗi khôi phục quyền mặc định', 'error');
        }
    },

    showToast(msg, type = 'info') {
        const toast = document.getElementById('toast');
        if (!toast) return;
        toast.innerText = msg;
        toast.className = `fixed bottom-5 right-5 px-4 py-3 rounded-lg shadow-lg text-sm font-semibold transition-all duration-300 z-50 ${type === 'success' ? 'bg-green-600 text-white' : type === 'error' ? 'bg-red-600 text-white' : 'bg-slate-800 text-white'}`;
        toast.classList.remove('hidden');
        setTimeout(() => toast.classList.add('hidden'), 3500);
    }
};

window.addEventListener('DOMContentLoaded', () => App.init());
