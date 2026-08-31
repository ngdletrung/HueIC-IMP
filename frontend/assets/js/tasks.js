// Tasks Page Logic (tasks.html) - MISA AMIS Multi-View & Workflow Engine v2.1.0
const TasksPage = {
    tasks: [],
    departments: [],
    users: [],
    workflows: [],
    createWorkflowSteps: [],
    updateWorkflowSteps: [],
    currentUpdatingTaskId: null,
    currentSelectedWorkflowName: null,
    
    // Multi-View & Filtering State
    currentView: 'list', // 'list' | 'kanban' | 'calendar'
    currentQuickFilter: 'all', // 'all' | 'overdue' | 'duesoon' | 'my_tasks' | 'urgent'
    calendarCurrentDate: new Date(),
    suggestedWorkflow: null,
    draggedTaskId: null,

    async init() {
        Common.init('tasks');

        try {
            const [depts, users, workflows] = await Promise.all([
                API.getDepartments(),
                API.getUsers(),
                API.getWorkflows({ include_global: true })
            ]);
            this.departments = depts;
            this.users = users;
            this.workflows = workflows;

            this.populateSelectOptions();
            this.applyUrlFilters();
            await this.loadTasks();

            // Tự động mở chi tiết nếu URL có task_id
            const taskIdParam = new URLSearchParams(window.location.search).get('task_id');
            if (taskIdParam) {
                this.openTaskDetail(parseInt(taskIdParam));
            }
        } catch (e) {
            console.error('Lỗi khởi tạo Trang Công Việc:', e);
            Common.showToast('Không thể nạp dữ liệu công việc', 'error');
        }
    },

    populateSelectOptions() {
        const leadingDeptSelect = document.getElementById('taskLeadingDept');
        const assistingDeptSelect = document.getElementById('taskAssistingDept');
        const assigneeSelect = document.getElementById('taskAssignee');
        const filterDeptSelect = document.getElementById('filterDept');

        if (leadingDeptSelect) {
            leadingDeptSelect.innerHTML = '<option value="">-- Chọn đơn vị chủ trì * --</option>' +
                this.departments.map(d => `<option value="${d.id}">${d.name} (${d.code})</option>`).join('');
            
            leadingDeptSelect.onchange = () => {
                const deptId = leadingDeptSelect.value ? parseInt(leadingDeptSelect.value) : null;
                this.populateWorkflowSelect(deptId);
            };
        }

        if (assistingDeptSelect) {
            assistingDeptSelect.innerHTML = '<option value="">-- Chọn đơn vị phối hợp (nếu có) --</option>' +
                this.departments.map(d => `<option value="${d.id}">${d.name} (${d.code})</option>`).join('');
        }

        if (filterDeptSelect) {
            filterDeptSelect.innerHTML = '<option value="">Tất cả đơn vị</option>' +
                this.departments.map(d => `<option value="${d.id}">${d.name} (${d.code})</option>`).join('');
        }

        if (assigneeSelect) {
            assigneeSelect.innerHTML = '<option value="">-- Chọn cán bộ phụ trách --</option>' +
                this.users.map(u => `<option value="${u.id}">${u.full_name} (${u.position || u.role})</option>`).join('');
        }

        this.populateWorkflowSelect();
    },

    populateWorkflowSelect(deptId = null) {
        const select = document.getElementById('taskWorkflowSelect');
        if (!select) return;

        let available = this.workflows;
        if (deptId) {
            available = this.workflows.filter(w => w.department_id === deptId || w.department_id === null);
        }

        select.innerHTML = '<option value="">-- Chọn quy trình mẫu chuẩn (2 đến 8 bước) --</option>' +
            available.map(w => {
                const deptTag = w.department ? `[${w.department.code}]` : '[Toàn trường]';
                const stepCount = (w.steps || []).length;
                return `<option value="${w.id}">${deptTag} ${w.name} (${stepCount} bước)</option>`;
            }).join('');
    },

    handleSelectWorkflowTemplate(wfId) {
        if (!wfId) return;
        const wf = this.workflows.find(w => w.id === parseInt(wfId));
        if (!wf) return;

        this.currentSelectedWorkflowName = wf.name;
        const steps = wf.steps || [];
        this.createWorkflowSteps = steps.map((s, idx) => ({
            id: idx + 1,
            title: s.title,
            is_completed: false,
            note: ''
        }));

        this.renderCreateTaskSteps();
        Common.showToast(`Đã nạp ${wf.name} (${steps.length} bước)!`, 'info');
    },

    applyUrlFilters() {
        const params = new URLSearchParams(window.location.search);
        const status = params.get('status');
        const priority = params.get('priority');
        const dept_id = params.get('dept_id');
        const user_id = params.get('user_id');
        const search = params.get('search');

        if (status && document.getElementById('filterStatus')) {
            document.getElementById('filterStatus').value = status;
        }
        if (priority && document.getElementById('filterPriority')) {
            document.getElementById('filterPriority').value = priority;
        }
        if (dept_id && document.getElementById('filterDept')) {
            document.getElementById('filterDept').value = dept_id;
        }
        if (search && document.getElementById('taskSearchInput')) {
            document.getElementById('taskSearchInput').value = search;
        }

        if (status || priority || dept_id || user_id || search) {
            Common.showToast('Đã áp dụng bộ lọc từ Dashboard', 'info');
        }
    },

    async loadTasks() {
        const status = document.getElementById('filterStatus')?.value || '';
        const priority = document.getElementById('filterPriority')?.value || '';
        const dept_id = document.getElementById('filterDept')?.value || '';
        const search = document.getElementById('taskSearchInput')?.value || '';
        const user_id = new URLSearchParams(window.location.search).get('user_id') || '';

        try {
            this.tasks = await API.getTasks({ status, priority, dept_id, search, user_id });
        } catch (e) {
            console.error('[TasksPage] API.getTasks thất bại:', e);
            Common.showToast('Lỗi nạp danh sách công việc', 'error');
            return;
        }

        try {
            this.updateQuickFilterBadges();
            this.renderCurrentView();
        } catch (e) {
            console.error('[TasksPage] Lỗi render giao diện:', e);
            // Không show toast - hiển thị lỗi trong console để debug
        }
    },

    // ----------------------------------------------------
    // MULTI-VIEW & QUICK FILTER CONTROLLERS
    // ----------------------------------------------------
    switchView(viewName) {
        this.currentView = viewName;

        const btnList = document.getElementById('btnViewList');
        const btnKanban = document.getElementById('btnViewKanban');
        const btnCalendar = document.getElementById('btnViewCalendar');

        const viewList = document.getElementById('viewListContainer');
        const viewKanban = document.getElementById('viewKanbanContainer');
        const viewCalendar = document.getElementById('viewCalendarContainer');

        const activeClass = ['bg-white', 'text-blue-900', 'shadow-xs'];
        const inactiveClass = ['text-slate-600', 'hover:text-blue-900', 'hover:bg-white/50'];

        [btnList, btnKanban, btnCalendar].forEach(btn => {
            if (btn) {
                btn.classList.remove(...activeClass);
                btn.classList.add(...inactiveClass);
            }
        });

        if (viewList) viewList.classList.add('hidden');
        if (viewKanban) viewKanban.classList.add('hidden');
        if (viewCalendar) viewCalendar.classList.add('hidden');

        if (viewName === 'list') {
            btnList?.classList.add(...activeClass);
            btnList?.classList.remove(...inactiveClass);
            viewList?.classList.remove('hidden');
        } else if (viewName === 'kanban') {
            btnKanban?.classList.add(...activeClass);
            btnKanban?.classList.remove(...inactiveClass);
            viewKanban?.classList.remove('hidden');
        } else if (viewName === 'calendar') {
            btnCalendar?.classList.add(...activeClass);
            btnCalendar?.classList.remove(...inactiveClass);
            viewCalendar?.classList.remove('hidden');
        }

        this.renderCurrentView();
    },

    setQuickFilter(filterType) {
        this.currentQuickFilter = filterType;

        const pills = ['all', 'overdue', 'duesoon', 'my_tasks', 'urgent'];
        pills.forEach(p => {
            const btn = document.getElementById(`qf-${p}`);
            if (!btn) return;
            if (p === filterType) {
                btn.className = 'px-2.5 py-1 rounded-full border border-blue-700 bg-blue-50 text-blue-900 font-bold transition shadow-xs';
            } else {
                btn.className = 'px-2.5 py-1 rounded-full border border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 font-bold transition';
            }
        });

        this.renderCurrentView();
    },

    updateQuickFilterBadges() {
        let overdueCount = 0;
        let dueSoonCount = 0;

        this.tasks.forEach(t => {
            const isCompleted = (t.status === 'HOAN_THANH');
            const dStatus = Common.getDeadlineStatus(t.due_date, isCompleted);
            if (dStatus.isOverdue) overdueCount++;
            if (dStatus.isDueSoon) dueSoonCount++;
        });

        const badgeOverdue = document.getElementById('badgeOverdueCount');
        if (badgeOverdue) {
            badgeOverdue.innerText = overdueCount;
            badgeOverdue.classList.toggle('hidden', overdueCount === 0);
        }

        const badgeDueSoon = document.getElementById('badgeDueSoonCount');
        if (badgeDueSoon) {
            badgeDueSoon.innerText = dueSoonCount;
            badgeDueSoon.classList.toggle('hidden', dueSoonCount === 0);
        }
    },

    getFilteredTasks() {
        let list = [...this.tasks];
        const user = API.getCurrentUser();
        const currentUserId = user?.id || user?.user_id;

        if (this.currentQuickFilter === 'overdue') {
            list = list.filter(t => t.status !== 'HOAN_THANH' && Common.getDeadlineStatus(t.due_date, false).isOverdue);
        } else if (this.currentQuickFilter === 'duesoon') {
            list = list.filter(t => t.status !== 'HOAN_THANH' && Common.getDeadlineStatus(t.due_date, false).isDueSoon);
        } else if (this.currentQuickFilter === 'my_tasks') {
            list = list.filter(t => t.assignee_id === currentUserId);
        } else if (this.currentQuickFilter === 'urgent') {
            list = list.filter(t => t.priority === 'KHAN_CAP');
        }

        return list;
    },

    renderCurrentView() {
        if (this.currentView === 'list') {
            this.renderTasksTable();
        } else if (this.currentView === 'kanban') {
            this.renderKanbanView();
        } else if (this.currentView === 'calendar') {
            this.renderCalendarView();
        }
    },

    // ----------------------------------------------------
    // VIEW 1: BẢNG DANH SÁCH & THẺ TOUCH DI ĐỘNG
    // ----------------------------------------------------
    renderTasksTable() {
        const tbody = document.getElementById('tasksTableBody');
        const mobileContainer = document.getElementById('tasksMobileCards');
        const displayTasks = this.getFilteredTasks();

        const statusBadges = {
            'CHUA_BAT_DAU': '<span class="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-full text-[10px] font-bold whitespace-nowrap">Chưa bắt đầu</span>',
            'DANG_THUC_HIEN': '<span class="px-2.5 py-1 bg-cyan-100 text-cyan-800 rounded-full text-[10px] font-bold whitespace-nowrap">Đang thực hiện</span>',
            'CHO_DUYET': '<span class="px-2.5 py-1 bg-amber-100 text-amber-800 rounded-full text-[10px] font-bold whitespace-nowrap">Chờ nghiệm thu</span>',
            'HOAN_THANH': '<span class="px-2.5 py-1 bg-green-100 text-green-800 rounded-full text-[10px] font-bold whitespace-nowrap">Đã hoàn thành</span>',
            'TAM_DUNG': '<span class="px-2.5 py-1 bg-purple-100 text-purple-800 rounded-full text-[10px] font-bold whitespace-nowrap">Tạm dừng</span>',
            'HUY_BO': '<span class="px-2.5 py-1 bg-slate-200 text-slate-600 rounded-full text-[10px] font-bold whitespace-nowrap">Hủy bỏ</span>'
        };

        const priorityBadges = {
            'THAP': '<span class="text-slate-500 font-semibold text-xs">Thấp</span>',
            'TRUNG_BINH': '<span class="text-blue-700 font-bold text-xs">Trung bình</span>',
            'CAO': '<span class="text-orange-600 font-bold text-xs">Cao</span>',
            'KHAN_CAP': '<span class="text-red-600 font-black text-xs animate-pulse">🔥 Khẩn cấp</span>'
        };

        if (displayTasks.length === 0) {
            const emptyHtml = `
                <div class="text-center py-10 text-slate-400 bg-white rounded-xl border border-slate-200 p-6">
                    <i class="fa-solid fa-clipboard-list text-3xl mb-2 text-slate-300"></i>
                    <p class="text-xs">Không có nhiệm vụ nào phù hợp với bộ lọc hiện tại.</p>
                </div>
            `;
            if (tbody) tbody.innerHTML = `<tr><td colspan="8">${emptyHtml}</td></tr>`;
            if (mobileContainer) mobileContainer.innerHTML = emptyHtml;
            return;
        }

        const getStepInfo = (t) => {
            const steps = t.workflow_steps;
            if (!steps || steps.length === 0) return '';
            const total = steps.length;
            const activeStep = steps.find(s => !s.is_completed);
            const wfPrefix = t.workflow_name ? `<div class="text-[10px] text-slate-400 font-semibold truncate max-w-[170px]" title="${t.workflow_name}"><i class="fa-solid fa-route mr-1 text-slate-400"></i>${t.workflow_name}</div>` : '';
            if (activeStep) {
                return `${wfPrefix}<div class="text-[10px] text-blue-900 font-bold mt-0.5 truncate max-w-[170px]" title="Bước ${activeStep.id}/${total}: ${activeStep.title}">
                    <i class="fa-solid fa-list-check mr-1 text-blue-700"></i>Bước ${activeStep.id}/${total}: ${activeStep.title}
                </div>`;
            }
            return `${wfPrefix}<div class="text-[10px] text-green-700 font-bold mt-0.5"><i class="fa-solid fa-circle-check mr-1"></i>Xong ${total}/${total} bước</div>`;
        };

        // 1. Render Table PC
        if (tbody) {
            tbody.innerHTML = displayTasks.map((t, index) => {
                const deadlineInfo = Common.getDeadlineStatus(t.due_date, t.status === 'HOAN_THANH');
                return `
                    <tr class="hover:bg-slate-50 border-b border-slate-100 text-xs transition">
                        <td class="px-4 py-3 font-mono text-slate-400 text-center">${index + 1}</td>
                        <td class="px-4 py-3">
                            <button onclick="TasksPage.openTaskDetail(${t.id})" class="text-left font-bold text-slate-900 hover:text-blue-800 transition">
                                ${t.title}
                            </button>
                            ${t.description ? `<p class="text-[11px] text-slate-400 truncate max-w-md mt-0.5">${t.description}</p>` : ''}
                        </td>
                        <td class="px-4 py-3 whitespace-nowrap">
                            <div class="font-bold text-blue-900">${t.leading_department ? t.leading_department.code : '-'}</div>
                            <div class="text-[10px] text-slate-500">${t.assignee ? t.assignee.full_name : '<span class="italic text-slate-400">Chưa gán</span>'}</div>
                        </td>
                        <td class="px-4 py-3 whitespace-nowrap">
                            <span class="px-2 py-0.5 rounded-full text-[10px] ${deadlineInfo.badgeClass}">
                                ${deadlineInfo.icon} ${deadlineInfo.shortLabel}
                            </span>
                        </td>
                        <td class="px-4 py-3 whitespace-nowrap">${priorityBadges[t.priority] || t.priority}</td>
                        <td class="px-4 py-3 whitespace-nowrap text-center">${statusBadges[t.status] || t.status}</td>
                        <td class="px-4 py-3 min-w-[190px]">
                            <div class="flex items-center space-x-2">
                                <div class="w-24 bg-slate-200 rounded-full h-2 overflow-hidden">
                                    <div class="h-2 rounded-full ${t.progress_percent >= 100 ? 'bg-green-600' : 'bg-blue-600'}" style="width: ${t.progress_percent}%"></div>
                                </div>
                                <span class="font-mono font-bold text-slate-700">${t.progress_percent}%</span>
                            </div>
                            ${getStepInfo(t)}
                        </td>
                        <td class="px-4 py-3 text-right whitespace-nowrap">
                            <div class="inline-flex items-center space-x-1.5">
                                <button onclick="TasksPage.openUpdateModal(${t.id})" class="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-800 hover:text-white text-blue-700 rounded-lg text-xs font-bold transition flex items-center space-x-1" title="Cập nhật tiến độ">
                                    <i class="fa-solid fa-pen-to-square"></i>
                                    <span>Tiến độ</span>
                                </button>
                                <button onclick="TasksPage.openTaskDetail(${t.id})" class="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-700 hover:text-white text-slate-700 rounded-lg text-xs font-bold transition flex items-center space-x-1" title="Xem chi tiết & thảo luận">
                                    <i class="fa-solid fa-comments"></i>
                                    <span>Chi tiết</span>
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');
        }

        // 2. Render Mobile Cards
        if (mobileContainer) {
            mobileContainer.innerHTML = displayTasks.map(t => {
                const deadlineInfo = Common.getDeadlineStatus(t.due_date, t.status === 'HOAN_THANH');
                return `
                    <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
                        <div class="flex items-start justify-between gap-2">
                            <div class="flex items-center space-x-1.5">
                                <span class="px-2 py-0.5 bg-blue-50 text-blue-900 font-mono font-bold text-[10px] rounded border border-blue-200">
                                    ${t.leading_department ? t.leading_department.code : 'HueIC'}
                                </span>
                                <span class="px-2 py-0.5 rounded-full text-[10px] ${deadlineInfo.badgeClass}">
                                    ${deadlineInfo.icon} ${deadlineInfo.shortLabel}
                                </span>
                            </div>
                            <div>${statusBadges[t.status] || t.status}</div>
                        </div>

                        <div>
                            <button onclick="TasksPage.openTaskDetail(${t.id})" class="text-left font-bold text-slate-900 text-sm hover:text-blue-800 leading-snug">
                                ${t.title}
                            </button>
                            ${t.description ? `<p class="text-xs text-slate-500 line-clamp-2 mt-1">${t.description}</p>` : ''}
                        </div>

                        ${getStepInfo(t) ? `<div class="bg-slate-50 p-2 rounded-lg border border-slate-100">${getStepInfo(t)}</div>` : ''}

                        <div class="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                            <div>
                                <span class="text-slate-400 text-[11px]">Ưu tiên:</span>
                                <span class="ml-1">${priorityBadges[t.priority] || t.priority}</span>
                            </div>
                            <div class="flex items-center space-x-1.5">
                                <div class="w-16 bg-slate-200 rounded-full h-2 overflow-hidden">
                                    <div class="h-2 rounded-full ${t.progress_percent >= 100 ? 'bg-green-600' : 'bg-blue-600'}" style="width: ${t.progress_percent}%"></div>
                                </div>
                                <span class="font-mono font-bold text-slate-700 text-xs">${t.progress_percent}%</span>
                            </div>
                        </div>

                        <div class="grid grid-cols-2 gap-2 pt-1">
                            <button onclick="TasksPage.openUpdateModal(${t.id})" class="w-full py-2 bg-blue-50 hover:bg-blue-800 hover:text-white text-blue-800 rounded-lg text-xs font-bold transition flex items-center justify-center space-x-1.5 border border-blue-200">
                                <i class="fa-solid fa-pen-to-square text-[11px]"></i>
                                <span>Tiến độ</span>
                            </button>
                            <button onclick="TasksPage.openTaskDetail(${t.id})" class="w-full py-2 bg-slate-100 hover:bg-slate-700 hover:text-white text-slate-700 rounded-lg text-xs font-bold transition flex items-center justify-center space-x-1.5 border border-slate-200">
                                <i class="fa-solid fa-comments text-[11px]"></i>
                                <span>Chi tiết</span>
                            </button>
                        </div>
                    </div>
                `;
            }).join('');
        }
    },

    // ----------------------------------------------------
    // VIEW 2: BẢNG THẺ KANBAN KÉO THẢ (DRAG & DROP)
    // ----------------------------------------------------
    renderKanbanView() {
        const columns = ['CHUA_BAT_DAU', 'DANG_THUC_HIEN', 'CHO_DUYET', 'HOAN_THANH'];
        const displayTasks = this.getFilteredTasks();

        columns.forEach(col => {
            const colContainer = document.getElementById(`kanbanCol-${col}`);
            const colCount = document.getElementById(`kanbanCount-${col}`);
            if (!colContainer) return;

            const colTasks = displayTasks.filter(t => t.status === col);
            if (colCount) colCount.innerText = colTasks.length;

            if (colTasks.length === 0) {
                colContainer.innerHTML = `
                    <div class="h-28 border border-dashed border-slate-300 rounded-xl flex items-center justify-center text-slate-400 text-xs italic bg-white/40">
                        Kéo thả thẻ vào đây
                    </div>
                `;
                return;
            }

            colContainer.innerHTML = colTasks.map(t => {
                const deadlineInfo = Common.getDeadlineStatus(t.due_date, t.status === 'HOAN_THANH');
                const steps = t.workflow_steps || [];
                const doneSteps = steps.filter(s => s.is_completed).length;
                const stepBadge = steps.length > 0
                    ? `<span class="px-2 py-0.5 bg-blue-50 text-blue-900 rounded font-mono text-[10px] font-bold"><i class="fa-solid fa-bars-progress mr-1"></i>${doneSteps}/${steps.length} bước</span>`
                    : '';

                return `
                    <div draggable="true" 
                        ondragstart="TasksPage.handleKanbanDragStart(event, ${t.id})"
                        ondragend="TasksPage.handleKanbanDragEnd(event)"
                        class="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs hover:shadow-md transition cursor-grab active:cursor-grabbing space-y-2.5">
                        
                        <div class="flex items-center justify-between gap-1">
                            <span class="px-2 py-0.5 bg-slate-100 text-slate-800 font-mono font-bold text-[10px] rounded">
                                ${t.leading_department ? t.leading_department.code : 'HueIC'}
                            </span>
                            <span class="px-2 py-0.5 rounded-full text-[10px] ${deadlineInfo.badgeClass}">
                                ${deadlineInfo.icon} ${deadlineInfo.shortLabel}
                            </span>
                        </div>

                        <h4 onclick="TasksPage.openTaskDetail(${t.id})" class="font-bold text-slate-900 text-xs hover:text-blue-800 transition line-clamp-2 cursor-pointer">
                            ${t.title}
                        </h4>

                        ${t.workflow_name ? `<p class="text-[10px] text-slate-400 truncate italic"><i class="fa-solid fa-route mr-1"></i>${t.workflow_name}</p>` : ''}

                        <!-- Progress Bar & Step Badge -->
                        <div class="space-y-1">
                            <div class="flex justify-between items-center text-[10px]">
                                ${stepBadge}
                                <span class="font-mono font-bold text-blue-900">${t.progress_percent}%</span>
                            </div>
                            <div class="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                <div class="h-1.5 rounded-full ${t.progress_percent >= 100 ? 'bg-green-600' : 'bg-blue-600'}" style="width: ${t.progress_percent}%"></div>
                            </div>
                        </div>

                        <!-- Footer: Assignee & Action Buttons -->
                        <div class="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px]">
                            <div class="flex items-center space-x-1.5 text-slate-600 truncate max-w-[120px]" title="${t.assignee ? t.assignee.full_name : 'Chưa gán'}">
                                <div class="w-5 h-5 rounded-full bg-blue-800 text-white font-bold text-[9px] flex items-center justify-center shrink-0">
                                    ${t.assignee ? t.assignee.full_name.charAt(0) : '?'}
                                </div>
                                <span class="truncate text-[10px]">${t.assignee ? t.assignee.full_name : 'Chưa gán'}</span>
                            </div>
                            <div class="flex items-center space-x-1">
                                <button onclick="TasksPage.openUpdateModal(${t.id})" class="p-1 text-blue-700 hover:bg-blue-50 rounded" title="Cập nhật tiến độ">
                                    <i class="fa-solid fa-pen-to-square"></i>
                                </button>
                                <button onclick="TasksPage.openTaskDetail(${t.id})" class="p-1 text-slate-500 hover:bg-slate-100 rounded" title="Chi tiết">
                                    <i class="fa-solid fa-comments"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        });
    },

    handleKanbanDragStart(e, taskId) {
        this.draggedTaskId = taskId;
        e.dataTransfer.setData('text/plain', taskId);
        e.dataTransfer.effectAllowed = 'move';
        e.target.classList.add('opacity-50', 'scale-95');
    },

    handleKanbanDragEnd(e) {
        e.target.classList.remove('opacity-50', 'scale-95');
        document.querySelectorAll('[id^="kanbanCol-"]').forEach(col => {
            col.classList.remove('bg-blue-100/50', 'border-blue-400');
        });
    },

    handleKanbanDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const dropZone = e.currentTarget;
        dropZone.classList.add('bg-blue-100/50');
    },

    handleKanbanDragLeave(e) {
        e.currentTarget.classList.remove('bg-blue-100/50');
    },

    async handleKanbanDrop(e, targetStatus) {
        e.preventDefault();
        e.currentTarget.classList.remove('bg-blue-100/50');

        const taskId = this.draggedTaskId || parseInt(e.dataTransfer.getData('text/plain'));
        if (!taskId) return;

        const task = this.tasks.find(t => t.id === taskId);
        if (!task || task.status === targetStatus) return;

        try {
            await API.updateTaskProgress(taskId, { status: targetStatus });
            Common.showToast(`Đã chuyển '${task.title}' sang trạng thái mới!`, 'success');
            await this.loadTasks();
        } catch (err) {
            Common.showToast(err.message || 'Lỗi khi chuyển trạng thái Kanban', 'error');
        }
    },

    // ----------------------------------------------------
    // VIEW 3: LỊCH CÔNG TÁC & DEADLINE (CALENDAR VIEW)
    // ----------------------------------------------------
    renderCalendarView() {
        const grid = document.getElementById('calendarGridDays');
        const monthTitle = document.getElementById('calendarMonthTitle');
        if (!grid) return;

        const year = this.calendarCurrentDate.getFullYear();
        const month = this.calendarCurrentDate.getMonth();

        if (monthTitle) {
            monthTitle.innerText = `Tháng ${(month + 1).toString().padStart(2, '0')} / ${year}`;
        }

        const firstDayOfMonth = new Date(year, month, 1);
        const lastDayOfMonth = new Date(year, month + 1, 0);

        let firstDayIndex = firstDayOfMonth.getDay() - 1;
        if (firstDayIndex === -1) firstDayIndex = 6;

        const totalDays = lastDayOfMonth.getDate();
        const prevMonthLastDay = new Date(year, month, 0).getDate();

        const displayTasks = this.getFilteredTasks();
        const today = new Date();
        const isCurrentMonth = (today.getFullYear() === year && today.getMonth() === month);

        let html = '';

        // 1. Previous Month Padding Days
        for (let x = firstDayIndex; x > 0; x--) {
            const dayNum = prevMonthLastDay - x + 1;
            html += `
                <div class="min-h-[90px] sm:min-h-[110px] p-1.5 bg-slate-50/50 rounded-xl border border-slate-100 opacity-40">
                    <span class="text-xs font-bold text-slate-400">${dayNum}</span>
                </div>
            `;
        }

        // 2. Current Month Days
        for (let day = 1; day <= totalDays; day++) {
            const isToday = isCurrentMonth && (today.getDate() === day);
            const dateStr = `${year}-${(month + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
            
            const dayTasks = displayTasks.filter(t => {
                if (!t.due_date) return false;
                return t.due_date.startsWith(dateStr);
            });

            html += `
                <div class="min-h-[90px] sm:min-h-[110px] p-1.5 sm:p-2 rounded-xl border transition flex flex-col justify-between ${isToday ? 'bg-blue-50/80 border-blue-400 ring-2 ring-blue-300' : 'bg-white border-slate-200 hover:border-slate-300'}">
                    <div class="flex items-center justify-between mb-1">
                        <span class="w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${isToday ? 'bg-blue-800 text-white font-black' : 'text-slate-700'}">
                            ${day}
                        </span>
                        ${dayTasks.length > 0 ? `<span class="px-1.5 py-0.2 bg-blue-100 text-blue-900 font-mono font-bold text-[9px] rounded-full">${dayTasks.length}</span>` : ''}
                    </div>

                    <div class="space-y-1 overflow-y-auto max-h-16 flex-1">
                        ${dayTasks.slice(0, 3).map(t => {
                            let pillColor = 'bg-blue-100 text-blue-900 border-blue-200';
                            if (t.priority === 'KHAN_CAP') pillColor = 'bg-red-100 text-red-900 border-red-300';
                            else if (t.priority === 'CAO') pillColor = 'bg-orange-100 text-orange-900 border-orange-200';
                            else if (t.status === 'HOAN_THANH') pillColor = 'bg-green-100 text-green-900 border-green-200';

                            return `
                                <div onclick="TasksPage.openTaskDetail(${t.id})" 
                                    class="p-1 rounded text-[10px] font-bold truncate cursor-pointer hover:opacity-80 border ${pillColor}" 
                                    title="${t.title} (${t.leading_department ? t.leading_department.code : ''})">
                                    ${t.title}
                                </div>
                            `;
                        }).join('')}
                        ${dayTasks.length > 3 ? `<div class="text-[9px] text-slate-400 italic text-center">+${dayTasks.length - 3} việc nữa</div>` : ''}
                    </div>
                </div>
            `;
        }

        // 3. Next Month Padding Days
        const totalRendered = firstDayIndex + totalDays;
        const remaining = (totalRendered > 35 ? 42 : 35) - totalRendered;
        for (let y = 1; y <= remaining; y++) {
            html += `
                <div class="min-h-[90px] sm:min-h-[110px] p-1.5 bg-slate-50/50 rounded-xl border border-slate-100 opacity-40">
                    <span class="text-xs font-bold text-slate-400">${y}</span>
                </div>
            `;
        }

        grid.innerHTML = html;
    },

    prevCalendarMonth() {
        this.calendarCurrentDate.setMonth(this.calendarCurrentDate.getMonth() - 1);
        this.renderCalendarView();
    },

    nextCalendarMonth() {
        this.calendarCurrentDate.setMonth(this.calendarCurrentDate.getMonth() + 1);
        this.renderCalendarView();
    },

    todayCalendarMonth() {
        this.calendarCurrentDate = new Date();
        this.renderCalendarView();
    },

    // ----------------------------------------------------
    // SMART WORKFLOW SUGGESTER (MISA AMIS PATTERN)
    // ----------------------------------------------------
    handleTitleInputForSuggester(title) {
        const lower = title.toLowerCase().trim();
        const box = document.getElementById('taskWorkflowSuggestionBox');
        const nameEl = document.getElementById('suggestedWorkflowName');

        if (!lower || lower.length < 3 || this.workflows.length === 0) {
            box?.classList.add('hidden');
            this.suggestedWorkflow = null;
            return;
        }

        let match = null;

        if (lower.includes('mua sắm') || lower.includes('đầu tư') || lower.includes('thiết bị') || lower.includes('cơ sở vật chất') || lower.includes('sửa chữa')) {
            match = this.workflows.find(w => w.code === 'QT_QTDT_01');
        } else if (lower.includes('đề cương') || lower.includes('đào tạo') || lower.includes('ctđt') || lower.includes('giáo trình') || lower.includes('thẩm định')) {
            match = this.workflows.find(w => w.code === 'QT_DT_01');
        } else if (lower.includes('học bổng') || lower.includes('sinh viên') || lower.includes('miễn giảm') || lower.includes('chế độ chính sách')) {
            match = this.workflows.find(w => w.code === 'QT_TSDV_01');
        } else if (lower.includes('sự kiện') || lower.includes('hội thảo') || lower.includes('lễ khai giảng') || lower.includes('bế giảng') || lower.includes('kỷ niệm')) {
            match = this.workflows.find(w => w.code === 'QT_HCTH_01');
        } else if (lower.includes('máy chủ') || lower.includes('server') || lower.includes('bảo trì') || lower.includes('hạ tầng') || lower.includes('website')) {
            match = this.workflows.find(w => w.code === 'QT_CNTT_01');
        } else if (lower.includes('trình ký') || lower.includes('soạn thảo') || lower.includes('văn bản') || lower.includes('công văn')) {
            match = this.workflows.find(w => w.code === 'QT_CHUNG_01');
        } else if (lower.includes('pdca') || lower.includes('cải tiến') || lower.includes('kế hoạch') || lower.includes('chất lượng')) {
            match = this.workflows.find(w => w.code === 'QT_CHUNG_02');
        }

        if (match) {
            this.suggestedWorkflow = match;
            if (nameEl) nameEl.innerText = `${match.name} (${(match.steps || []).length} bước)`;
            box?.classList.remove('hidden');
        } else {
            box?.classList.add('hidden');
            this.suggestedWorkflow = null;
        }
    },

    applySuggestedWorkflow() {
        if (!this.suggestedWorkflow) return;

        const wf = this.suggestedWorkflow;
        const leadingDeptSelect = document.getElementById('taskLeadingDept');
        if (leadingDeptSelect && wf.department_id) {
            leadingDeptSelect.value = wf.department_id;
            this.populateWorkflowSelect(wf.department_id);
        }

        const wfSelect = document.getElementById('taskWorkflowSelect');
        if (wfSelect) {
            wfSelect.value = wf.id;
        }

        this.handleSelectWorkflowTemplate(wf.id);

        const box = document.getElementById('taskWorkflowSuggestionBox');
        if (box) box.classList.add('hidden');
        Common.showToast(`✨ Đã áp dụng ${wf.name}!`, 'success');
    },

    // ----------------------------------------------------
    // PHÂN HỆ QUY TRÌNH BƯỚC MỐC TRONG FORM TẠO NHIỆM VỤ
    // ----------------------------------------------------
    openCreateTaskModal() {
        document.getElementById('formCreateTask').reset();
        this.createWorkflowSteps = [];
        this.currentSelectedWorkflowName = null;
        this.suggestedWorkflow = null;
        document.getElementById('taskWorkflowSuggestionBox')?.classList.add('hidden');
        this.populateWorkflowSelect();

        // Tự động nạp mẫu đầu tiên nếu có
        if (this.workflows.length > 0) {
            const defaultWf = this.workflows.find(w => w.code === 'QT_CHUNG_02') || this.workflows[0];
            const select = document.getElementById('taskWorkflowSelect');
            if (select) select.value = defaultWf.id;
            this.handleSelectWorkflowTemplate(defaultWf.id);
        } else {
            this.addNewWorkflowStep();
        }

        document.getElementById('modalCreateTask').classList.remove('hidden');
    },

    closeCreateTaskModal() {
        document.getElementById('modalCreateTask').classList.add('hidden');
    },

    addNewWorkflowStep(title = '') {
        const nextId = this.createWorkflowSteps.length + 1;
        this.createWorkflowSteps.push({
            id: nextId,
            title: title || `Bước ${nextId}: Nội dung công việc`,
            is_completed: false,
            note: ''
        });
        this.renderCreateTaskSteps();
    },

    removeWorkflowStep(stepIndex) {
        this.createWorkflowSteps.splice(stepIndex, 1);
        this.createWorkflowSteps.forEach((s, idx) => s.id = idx + 1);
        this.renderCreateTaskSteps();
    },

    clearWorkflowSteps() {
        this.createWorkflowSteps = [];
        this.currentSelectedWorkflowName = null;
        const select = document.getElementById('taskWorkflowSelect');
        if (select) select.value = '';
        this.renderCreateTaskSteps();
    },

    updateCreateStepTitle(stepIndex, newTitle) {
        if (this.createWorkflowSteps[stepIndex]) {
            this.createWorkflowSteps[stepIndex].title = newTitle;
        }
    },

    renderCreateTaskSteps() {
        const container = document.getElementById('createTaskStepsContainer');
        if (!container) return;

        if (this.createWorkflowSteps.length === 0) {
            container.innerHTML = `
                <div class="text-center py-4 text-slate-400 italic text-[11px] bg-white rounded-lg border border-dashed border-slate-200">
                    Chưa có bước quy trình nào. Hãy chọn quy trình mẫu ở trên hoặc bấm <b>+ Thêm bước</b> để thiết lập.
                </div>
            `;
            return;
        }

        container.innerHTML = this.createWorkflowSteps.map((step, idx) => `
            <div class="flex items-center space-x-2 bg-white p-2 rounded-lg border border-slate-200 shadow-2xs">
                <span class="w-6 h-6 rounded-full bg-blue-100 text-blue-900 font-mono font-black text-xs flex items-center justify-center shrink-0">
                    ${step.id}
                </span>
                <input type="text" value="${step.title}" 
                    oninput="TasksPage.updateCreateStepTitle(${idx}, this.value)"
                    placeholder="Nhập tên bước thực hiện..."
                    class="flex-1 px-2.5 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:border-blue-800">
                <button type="button" onclick="TasksPage.removeWorkflowStep(${idx})" class="text-slate-400 hover:text-red-600 p-1 transition" title="Xóa bước này">
                    <i class="fa-solid fa-trash-can text-xs"></i>
                </button>
            </div>
        `).join('');
    },

    async handleCreateTask(e) {
        e.preventDefault();
        const title = document.getElementById('taskTitle').value.trim();
        const description = document.getElementById('taskDescription').value.trim();
        const leading_dept_id = parseInt(document.getElementById('taskLeadingDept').value);
        const assisting_dept_id = document.getElementById('taskAssistingDept').value ? parseInt(document.getElementById('taskAssistingDept').value) : null;
        const assignee_id = document.getElementById('taskAssignee').value ? parseInt(document.getElementById('taskAssignee').value) : null;
        const priority = document.getElementById('taskPriority').value;
        const due_date = document.getElementById('taskDueDate').value || null;

        const payload = {
            title,
            description,
            leading_dept_id,
            assisting_dept_id,
            assignee_id,
            priority,
            workflow_name: this.currentSelectedWorkflowName || undefined,
            due_date: due_date ? new Date(due_date).toISOString() : null,
            workflow_steps: this.createWorkflowSteps
        };

        try {
            await API.createTask(payload);
            Common.showToast('Giao nhiệm vụ với quy trình các bước thành công!', 'success');
            this.closeCreateTaskModal();
            this.loadTasks();
        } catch (err) {
            Common.showToast(err.message || 'Lỗi khi giao nhiệm vụ', 'error');
        }
    },

    // ----------------------------------------------------
    // PHÂN HỆ CẬP NHẬT TIẾN ĐỘ & CHECKLIST BƯỚC MỐC
    // ----------------------------------------------------
    openUpdateModal(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) return;

        this.currentUpdatingTaskId = task.id;
        document.getElementById('updateTaskId').value = task.id;
        document.getElementById('updateTaskTitle').innerText = task.title;
        document.getElementById('updateStatus').value = task.status;
        document.getElementById('updateComment').value = '';

        this.updateWorkflowSteps = (task.workflow_steps && task.workflow_steps.length > 0)
            ? JSON.parse(JSON.stringify(task.workflow_steps))
            : [];

        this.renderUpdateTaskSteps();
        document.getElementById('modalUpdateTask').classList.remove('hidden');
    },

    renderUpdateTaskSteps() {
        const container = document.getElementById('updateStepsListContainer');
        const badge = document.getElementById('updateCurrentStepBadge');
        const progressInput = document.getElementById('updateProgress');
        const progressDisplay = document.getElementById('progressValueDisplay');
        const progressBar = document.getElementById('updateProgressBar');
        const doneStepsText = document.getElementById('updateDoneStepsText');
        const statusSelect = document.getElementById('updateStatus');

        if (!container) return;

        if (this.updateWorkflowSteps.length === 0) {
            container.innerHTML = `
                <div class="text-center py-3 bg-white rounded-lg border border-dashed border-slate-200 space-y-2">
                    <p class="text-slate-400 italic text-[11px]">Nhiệm vụ này chưa gắn quy trình các bước.</p>
                    <button type="button" onclick="TasksPage.attachDefaultWorkflowToUpdate()" class="px-2.5 py-1 bg-blue-50 text-blue-800 hover:bg-blue-800 hover:text-white rounded text-xs font-bold transition">
                        <i class="fa-solid fa-wand-magic-sparkles mr-1"></i>Gắn Mẫu 4 Bước Chuẩn (PDCA)
                    </button>
                </div>
            `;
            if (badge) badge.innerText = `Chưa có bước`;
            if (doneStepsText) doneStepsText.innerText = `Chưa gắn bước`;
            return;
        }

        const total = this.updateWorkflowSteps.length;
        const done = this.updateWorkflowSteps.filter(s => s.is_completed).length;
        const calculatedPercent = total > 0 ? Math.round((done / total) * 100) : 0;

        if (progressInput) progressInput.value = calculatedPercent;
        if (progressDisplay) progressDisplay.innerText = `${calculatedPercent}%`;
        if (progressBar) {
            progressBar.style.width = `${calculatedPercent}%`;
            progressBar.className = `h-full rounded-full transition-all duration-300 ${calculatedPercent >= 100 ? 'bg-green-600' : 'bg-blue-600'}`;
        }
        if (doneStepsText) {
            doneStepsText.innerText = `Đã xong: ${done}/${total} bước (${calculatedPercent}%)`;
        }

        // Tự động gán trạng thái tương thích chuẩn xác theo tỷ lệ bước
        if (statusSelect) {
            if (calculatedPercent === 100) {
                if (statusSelect.value !== 'CHO_DUYET') {
                    statusSelect.value = 'HOAN_THANH';
                }
            } else if (calculatedPercent === 0) {
                if (statusSelect.value !== 'TAM_DUNG' && statusSelect.value !== 'HUY_BO') {
                    statusSelect.value = 'CHUA_BAT_DAU';
                }
            } else {
                if (statusSelect.value !== 'TAM_DUNG' && statusSelect.value !== 'HUY_BO') {
                    statusSelect.value = 'DANG_THUC_HIEN';
                }
            }
        }

        // Cập nhật badge bước hiện tại
        const activeStep = this.updateWorkflowSteps.find(s => !s.is_completed);
        if (badge) {
            if (activeStep) {
                badge.innerText = `Đang ở Bước ${activeStep.id}/${total}: ${activeStep.title}`;
                badge.className = "px-2 py-0.5 bg-blue-100 text-blue-900 rounded-full font-bold text-[10px] truncate max-w-[240px]";
            } else {
                badge.innerText = `Đã hoàn tất ${total}/${total} bước (100%)`;
                badge.className = "px-2 py-0.5 bg-green-100 text-green-800 rounded-full font-bold text-[10px]";
            }
        }

        container.innerHTML = this.updateWorkflowSteps.map((step, idx) => {
            const stepPct = Math.round(100 / total);
            return `
                <div class="p-2.5 rounded-lg border transition ${step.is_completed ? 'bg-green-50/60 border-green-200' : 'bg-white border-slate-200'}">
                    <div class="flex items-start justify-between gap-2">
                        <label class="flex items-start space-x-2.5 cursor-pointer flex-1">
                            <input type="checkbox" ${step.is_completed ? 'checked' : ''} 
                                onchange="TasksPage.toggleUpdateStep(${idx}, this.checked)"
                                class="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-800 focus:ring-blue-800 accent-blue-800 shrink-0">
                            <div>
                                <span class="font-bold text-xs ${step.is_completed ? 'line-through text-slate-500' : 'text-slate-900'}">
                                    Bước ${step.id}: ${step.title}
                                </span>
                                ${step.completed_at ? `<div class="text-[10px] text-green-700 font-medium mt-0.5"><i class="fa-solid fa-check mr-1"></i>Xong lúc: ${Common.formatDateTime(step.completed_at)}</div>` : ''}
                            </div>
                        </label>
                        <span class="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${step.is_completed ? 'bg-green-200/60 text-green-800' : 'bg-slate-100 text-slate-500'}">
                            ${stepPct}% / bước
                        </span>
                    </div>
                    
                    <div class="mt-2 pl-6">
                        <input type="text" value="${step.note || ''}" 
                            onchange="TasksPage.updateStepNote(${idx}, this.value)"
                            placeholder="Ghi chú kết quả bước này (nếu có)..."
                            class="w-full px-2 py-1 text-[11px] bg-slate-50 border border-slate-200 rounded focus:bg-white focus:outline-none focus:border-blue-800">
                    </div>
                </div>
            `;
        }).join('');
    },

    toggleUpdateStep(stepIdx, isChecked) {
        if (this.updateWorkflowSteps[stepIdx]) {
            this.updateWorkflowSteps[stepIdx].is_completed = isChecked;
            this.updateWorkflowSteps[stepIdx].completed_at = isChecked ? new Date().toISOString() : null;
            this.renderUpdateTaskSteps();
        }
    },

    updateStepNote(stepIdx, note) {
        if (this.updateWorkflowSteps[stepIdx]) {
            this.updateWorkflowSteps[stepIdx].note = note;
        }
    },

    attachDefaultWorkflowToUpdate() {
        this.updateWorkflowSteps = [
            { id: 1, title: "Lập kế hoạch & Khảo sát (Plan)", is_completed: false, note: "" },
            { id: 2, title: "Triển khai thực hiện (Do)", is_completed: false, note: "" },
            { id: 3, title: "Kiểm tra & Thẩm định (Check)", is_completed: false, note: "" },
            { id: 4, title: "Nghiệm thu & Bàn giao (Act)", is_completed: false, note: "" }
        ];
        this.renderUpdateTaskSteps();
    },

    handleStatusChange(newStatus) {
        if (this.updateWorkflowSteps.length > 0) {
            if (newStatus === 'HOAN_THANH' || newStatus === 'CHO_DUYET') {
                this.updateWorkflowSteps.forEach(s => {
                    s.is_completed = true;
                    if (!s.completed_at) s.completed_at = new Date().toISOString();
                });
                this.renderUpdateTaskSteps();
            } else if (newStatus === 'CHUA_BAT_DAU') {
                this.updateWorkflowSteps.forEach(s => {
                    s.is_completed = false;
                    s.completed_at = null;
                });
                this.renderUpdateTaskSteps();
            } else if (newStatus === 'DANG_THUC_HIEN') {
                const done = this.updateWorkflowSteps.filter(s => s.is_completed).length;
                if (done === 0 && this.updateWorkflowSteps.length > 0) {
                    this.updateWorkflowSteps[0].is_completed = true;
                    this.updateWorkflowSteps[0].completed_at = new Date().toISOString();
                } else if (done === this.updateWorkflowSteps.length && this.updateWorkflowSteps.length > 0) {
                    this.updateWorkflowSteps[this.updateWorkflowSteps.length - 1].is_completed = false;
                    this.updateWorkflowSteps[this.updateWorkflowSteps.length - 1].completed_at = null;
                }
                this.renderUpdateTaskSteps();
            }
            // TAM_DUNG / HUY_BO: không thay đổi bước quy trình - chỉ ghi nhận trạng thái
            return;
        }

        const progressInput = document.getElementById('updateProgress');
        const progressDisplay = document.getElementById('progressValueDisplay');
        const progressBar = document.getElementById('updateProgressBar');
        if (!progressInput || !progressDisplay) return;

        if (newStatus === 'CHUA_BAT_DAU') {
            progressInput.value = 0;
            progressDisplay.innerText = '0%';
            if (progressBar) progressBar.style.width = '0%';
        } else if (newStatus === 'HOAN_THANH' || newStatus === 'CHO_DUYET') {
            progressInput.value = 100;
            progressDisplay.innerText = '100%';
            if (progressBar) progressBar.style.width = '100%';
        }
        // TAM_DUNG / HUY_BO: giữ nguyên % hiện tại
    },


    closeUpdateTaskModal() {
        document.getElementById('modalUpdateTask').classList.add('hidden');
    },

    async handleUpdateTask(e) {
        e.preventDefault();
        const taskId = document.getElementById('updateTaskId').value;
        const status = document.getElementById('updateStatus').value;
        const progress_percent = parseInt(document.getElementById('updateProgress').value);
        const comment = document.getElementById('updateComment').value.trim();

        try {
            await API.updateTaskProgress(taskId, {
                status,
                progress_percent,
                workflow_steps: this.updateWorkflowSteps.length > 0 ? this.updateWorkflowSteps : undefined,
                comment: comment || undefined
            });
            Common.showToast('Cập nhật tiến độ & quy trình thành công!', 'success');
            this.closeUpdateTaskModal();
            this.loadTasks();
        } catch (err) {
            Common.showToast(err.message || 'Lỗi cập nhật tiến độ', 'error');
        }
    },

    // ----------------------------------------------------
    // PHÂN HỆ XEM CHI TIẾT & STEPPER TIMELINE
    // ----------------------------------------------------
    async openTaskDetail(taskId) {
        try {
            const task = await API.getTaskDetail(taskId);
            document.getElementById('detailTaskIdInput').value = task.id;
            document.getElementById('detailTaskTitle').innerText = task.title;
            document.getElementById('detailTaskDesc').innerText = task.description || 'Không có mô tả chi tiết.';
            document.getElementById('detailStatus').innerText = task.status;
            document.getElementById('detailPriority').innerText = task.priority;
            document.getElementById('detailProgress').innerText = `${task.progress_percent}%`;
            document.getElementById('detailLeadingDept').innerText = task.leading_department ? task.leading_department.name : '-';
            document.getElementById('detailAssistingDept').innerText = task.assisting_department ? task.assisting_department.name : '-';
            document.getElementById('detailAssignee').innerText = task.assignee ? `${task.assignee.full_name} (${task.assignee.position || task.assignee.role})` : 'Chưa phân công';

            this.renderDetailWorkflowTimeline(task.workflow_steps || [], task.workflow_name);
            this.renderComments(task.comments || []);
            document.getElementById('modalTaskDetail').classList.remove('hidden');
        } catch (err) {
            Common.showToast('Lỗi nạp chi tiết công việc', 'error');
        }
    },

    renderDetailWorkflowTimeline(steps, workflowName = null) {
        const container = document.getElementById('detailWorkflowTimeline');
        const badge = document.getElementById('detailWorkflowBadge');
        if (!container) return;

        if (!steps || steps.length === 0) {
            container.innerHTML = '<p class="text-slate-400 italic text-xs py-2">Nhiệm vụ này chưa thiết lập quy trình các bước mốc.</p>';
            if (badge) badge.innerText = '0 bước';
            return;
        }

        const total = steps.length;
        const done = steps.filter(s => s.is_completed).length;
        if (badge) {
            badge.innerText = `${workflowName ? workflowName + ' • ' : ''}${done}/${total} bước (${Math.round((done/total)*100)}%)`;
        }

        container.innerHTML = steps.map((s, idx) => `
            <div class="flex items-start space-x-3 p-2.5 rounded-xl border ${s.is_completed ? 'bg-green-50/50 border-green-200' : (idx === done ? 'bg-blue-50 border-blue-200 ring-2 ring-blue-400/20' : 'bg-white border-slate-200')}">
                <div class="w-7 h-7 rounded-full flex items-center justify-center shrink-0 font-mono font-black text-xs ${s.is_completed ? 'bg-green-600 text-white' : (idx === done ? 'bg-blue-800 text-white animate-pulse' : 'bg-slate-200 text-slate-600')}">
                    ${s.is_completed ? '<i class="fa-solid fa-check"></i>' : s.id}
                </div>
                <div class="flex-1">
                    <div class="flex items-center justify-between">
                        <span class="font-bold text-xs ${s.is_completed ? 'text-green-900' : (idx === done ? 'text-blue-900' : 'text-slate-700')}">
                            Bước ${s.id}: ${s.title}
                        </span>
                        <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${s.is_completed ? 'bg-green-100 text-green-800' : (idx === done ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-500')}">
                            ${s.is_completed ? 'Đã hoàn thành' : (idx === done ? 'Đang thực hiện' : 'Chưa thực hiện')}
                        </span>
                    </div>
                    ${s.note ? `<p class="text-[11px] text-slate-600 mt-1 bg-white p-2 rounded border border-slate-100"><i class="fa-solid fa-comment-dots mr-1 text-slate-400"></i>${s.note}</p>` : ''}
                    ${s.completed_at ? `<div class="text-[10px] text-slate-400 mt-0.5">Thời gian: ${Common.formatDateTime(s.completed_at)}</div>` : ''}
                </div>
            </div>
        `).join('');
    },

    closeTaskDetailModal() {
        document.getElementById('modalTaskDetail').classList.add('hidden');
    },

    renderComments(comments) {
        const list = document.getElementById('detailCommentsList');
        if (!list) return;

        if (comments.length === 0) {
            list.innerHTML = '<p class="text-slate-400 italic text-xs py-2">Chưa có trao đổi nào.</p>';
            return;
        }

        list.innerHTML = comments.map(c => `
            <div class="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
                <div class="flex justify-between items-center text-[10px] text-slate-500 font-bold">
                    <span class="text-blue-900">${c.author ? c.author.full_name : 'Người dùng'}</span>
                    <span>${Common.formatDateTime(c.created_at)}</span>
                </div>
                <div class="text-slate-700">${c.content}</div>
            </div>
        `).join('');
    },

    async handleAddComment(e) {
        e.preventDefault();
        const taskId = document.getElementById('detailTaskIdInput').value;
        const input = document.getElementById('newCommentInput');
        const content = input.value.trim();
        if (!content) return;

        try {
            await API.addTaskComment(taskId, content);
            input.value = '';
            Common.showToast('Đã gửi ý kiến trao đổi!', 'success');
            const updated = await API.getTaskDetail(taskId);
            this.renderComments(updated.comments || []);
        } catch (err) {
            Common.showToast(err.message || 'Lỗi gửi bình luận', 'error');
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    TasksPage.init();
});
