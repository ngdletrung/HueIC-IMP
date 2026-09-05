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
    currentView: 'report', // 'report' (Default Tab 1) | 'list' | 'kanban'
    currentQuickFilter: 'all', // 'all' | 'overdue' | 'duesoon' | 'my_tasks' | 'urgent'
    calendarCurrentDate: new Date(),
    suggestedWorkflow: null,
    draggedTaskId: null,

    async init() {
        const isTasksListPage = window.location.pathname.includes('tasks-list.html');
        Common.init('tasks');

        const hash = window.location.hash.replace('#', '');
        if (isTasksListPage) {
            this.currentView = (hash === 'kanban') ? 'kanban' : 'list';
        } else {
            this.currentView = 'report';
        }

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
            this.switchView(this.currentView);

            // Tự động mở chi tiết nếu URL có task_id
            const taskIdParam = new URLSearchParams(window.location.search).get('task_id');
            if (taskIdParam) {
                this.openTaskDetail(parseInt(taskIdParam));
            }

            // Đóng custom dropdown khi click bên ngoài
            document.addEventListener('click', (e) => {
                const requesterWrapper = document.getElementById('requesterWrapper');
                const requesterMenu = document.getElementById('requesterDropdownMenu');
                if (requesterWrapper && requesterMenu && !requesterWrapper.contains(e.target)) {
                    requesterMenu.classList.add('hidden');
                }

                const colWrapper = document.getElementById('collaboratorsSection');
                const colMenu = document.getElementById('collaboratorDropdownMenu');
                if (colWrapper && colMenu && !colWrapper.contains(e.target)) {
                    colMenu.classList.add('hidden');
                }

                // Đóng dropdown menu phê duyệt đề xuất trên bảng
                document.querySelectorAll('.proposal-dropdown-menu').forEach(menu => {
                    if (!menu.parentElement.contains(e.target)) {
                        menu.classList.add('hidden');
                    }
                });
            });

            // Phím tắt thông minh: Ctrl + Enter để lưu/giao việc nhanh, Esc để đóng Modal
            document.addEventListener('keydown', (e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                    const createModal = document.getElementById('modalCreateTask');
                    if (createModal && !createModal.classList.contains('hidden')) {
                        e.preventDefault();
                        const form = document.getElementById('formCreateTask');
                        if (form) form.requestSubmit();
                    }
                }
                if (e.key === 'Escape') {
                    const createModal = document.getElementById('modalCreateTask');
                    if (createModal && !createModal.classList.contains('hidden')) {
                        TasksPage.closeCreateTaskModal();
                    }
                }
            });
        } catch (e) {
            console.error('Lỗi khởi tạo Trang Công Việc:', e);
            Common.showToast('Không thể nạp dữ liệu công việc', 'error');
        }
    },

    filterByDept(deptId) {
        window.location.href = `tasks-list.html?dept_id=${deptId}`;
    },

    // ----------------------------------------------------
    // HELPER TỰ ĐỘNG XÁC ĐỊNH CHỨC DANH LÃNH ĐẠO ĐƠN VỊ ĐỘNG (ZERO HARDCODE)
    // Hoàn toàn đồng bộ tự động với Thiết Lập & Quản Trị Hệ Thống (settings.html)
    // ----------------------------------------------------
    getDeptLeaderTitle(deptOrCode) {
        if (!deptOrCode) return 'Lãnh đạo đơn vị';
        let dept = typeof deptOrCode === 'object' ? deptOrCode : null;
        const code = typeof deptOrCode === 'string' ? deptOrCode : (dept ? dept.code : '');

        if (!dept && this.departments && this.departments.length > 0) {
            dept = this.departments.find(d => d.code === code || d.id === deptOrCode || d.name === deptOrCode);
        }
        if (!dept && Common.departments && Common.departments.length > 0) {
            dept = Common.departments.find(d => d.code === code || d.id === deptOrCode || d.name === deptOrCode);
        }

        if (code === 'BGH' || (dept && (dept.type === 'BGH' || dept.code === 'BGH' || (dept.name && dept.name.toLowerCase().includes('ban giám hiệu'))))) {
            return 'Ban Giám Hiệu';
        }

        const name = (dept && dept.name) ? dept.name.trim() : '';
        const type = (dept && dept.type) ? dept.type.toUpperCase() : '';

        // Tự động suy luận danh xưng theo chuẩn ngữ nghĩa tiếng Việt của CSDL Thiết Lập
        if (type === 'FACULTY' || /^khoa\b/i.test(name)) {
            return `Trưởng Khoa ${code || name}`;
        }
        if (type === 'CENTER' || /^trung tâm\b/i.test(name)) {
            return `Giám Đốc ${code || name}`;
        }
        if (type === 'UNION' || /^công đoàn\b/i.test(name)) {
            return `Chủ Tịch Công Đoàn`;
        }
        if (type === 'INSTITUTE' || /^viện\b/i.test(name)) {
            return `Viện Trưởng ${code || name}`;
        }
        if (type === 'BOARD' || /^ban\b/i.test(name)) {
            return `Trưởng Ban ${code || name}`;
        }
        if (type === 'DEPARTMENT' || /^phòng\b/i.test(name)) {
            return `Trưởng Phòng ${code || name}`;
        }
        return `Trưởng ${name || (code ? '[' + code + ']' : 'Đơn Vị')}`;
    },

    getProposalApproverInfo(task) {
        if (task.visibility === 'ORGANIZATIONAL') {
            return {
                title: 'Ban Giám Hiệu (BGH)',
                icon: '🏛️',
                shortText: 'Ban Giám Hiệu'
            };
        }
        const targetDept = task.creator?.department || task.leading_department;
        const code = targetDept ? targetDept.code : '';
        const leaderTitle = this.getDeptLeaderTitle(targetDept || code);
        return {
            title: leaderTitle,
            icon: '🏢',
            shortText: leaderTitle
        };
    },

    canUserApproveProposal(task, user) {
        if (!user || !task || task.type !== 'PROPOSAL') return false;

        const userId = Number(user.id || 0);
        const creatorId = Number(task.created_by_id || (task.creator ? task.creator.id : 0));

        // 1. NGUYÊN TẮC NO SELF-APPROVAL: Người tạo tuyệt đối KHÔNG được tự duyệt đề xuất của chính mình
        if (userId > 0 && userId === creatorId) {
            return false;
        }
        
        // 2. ĐỀ XUẤT CẤP TRƯỜNG / ĐỀ XUẤT VƯỢT CẤP (ORGANIZATIONAL):
        // Chỉ Ban Giám Hiệu (BGH) và SUPERADMIN mới có thẩm quyền phê duyệt / yêu cầu bổ sung / bác bỏ
        if (task.visibility === 'ORGANIZATIONAL') {
            return user.role === 'SUPERADMIN' || user.role === 'BGH';
        }

        // 3. ĐỀ XUẤT CẤP ĐƠN VỊ / NỘI BỘ PHÒNG (DEPARTMENT / PRIVATE):
        // Ban Giám Hiệu & SuperAdmin chỉ quan sát (Read-only) để tôn trọng quyền tự chủ của đơn vị.
        // Thẩm quyền phê duyệt thuộc Trưởng / Phó Đơn vị của chính phòng ban đó.
        const isLeaderRole = ['DEPT_HEAD', 'DEPT_VICE'].includes(user.role);
        if (!isLeaderRole) return false;

        const userDeptId = Number(user.department_id || user.department?.id || 0);
        const taskDeptId = Number(task.leading_dept_id || task.leading_department?.id || 0);
        const creatorDeptId = Number(task.creator?.department_id || task.creator?.department?.id || 0);

        if (userDeptId > 0 && (userDeptId === taskDeptId || userDeptId === creatorDeptId)) {
            return true;
        }

        return false;
    },

    toggleProposalMenu(taskId) {
        const menu = document.getElementById(`proposalMenu_${taskId}`);
        if (!menu) return;
        const isHidden = menu.classList.contains('hidden');
        document.querySelectorAll('.proposal-dropdown-menu').forEach(m => m.classList.add('hidden'));
        if (isHidden) {
            menu.classList.remove('hidden');
        }
    },

    async openApproveProposalModalById(taskId) {
        document.querySelectorAll('.proposal-dropdown-menu').forEach(m => m.classList.add('hidden'));
        try {
            const task = (this.tasks && this.tasks.find(t => t.id === taskId)) || await API.getTaskDetail(taskId);
            if (task) {
                this.openApproveProposalModal(task);
            }
        } catch (err) {
            console.error('Lỗi mở modal duyệt đề xuất:', err);
            Common.showToast('Không thể mở bảng duyệt đề xuất', 'error');
        }
    },

    switchView(viewName) {
        const isTasksListPage = window.location.pathname.includes('tasks-list.html');

        // If on tasks.html and clicked list or kanban -> Navigate to tasks-list.html
        if (!isTasksListPage && (viewName === 'list' || viewName === 'kanban')) {
            window.location.href = (viewName === 'kanban') ? 'tasks-list.html#kanban' : 'tasks-list.html';
            return;
        }

        // If on tasks-list.html and clicked report -> Navigate to tasks.html
        if (isTasksListPage && viewName === 'report') {
            window.location.href = 'tasks.html';
            return;
        }

        this.currentView = viewName;
        window.location.hash = viewName;

        const btnReport = document.getElementById('btnViewReport');
        const btnList = document.getElementById('btnViewList');
        const btnKanban = document.getElementById('btnViewKanban');

        const viewReport = document.getElementById('viewReportContainer');
        const viewList = document.getElementById('viewListContainer');
        const viewKanban = document.getElementById('viewKanbanContainer');

        // Reset tất cả nút về trạng thái inactive với hover tương ứng theo 10 màu chuẩn (Soft 500)
        if (btnReport) {
            btnReport.className = 'px-3 py-1.5 rounded-md font-bold text-xs flex items-center space-x-1.5 transition text-slate-600 hover:bg-violet-500 hover:text-white';
        }
        if (btnList) {
            btnList.className = 'px-3 py-1.5 rounded-md font-bold text-xs flex items-center space-x-1.5 transition text-slate-600 hover:bg-indigo-500 hover:text-white';
        }
        if (btnKanban) {
            btnKanban.className = 'px-3 py-1.5 rounded-md font-bold text-xs flex items-center space-x-1.5 transition text-slate-600 hover:bg-blue-500 hover:text-white';
        }

        if (viewReport) {
            viewReport.classList.toggle('hidden', viewName !== 'report');
            viewReport.style.display = (viewName === 'report') ? 'block' : 'none';
        }
        if (viewList) {
            viewList.classList.toggle('hidden', viewName !== 'list');
            viewList.style.display = (viewName === 'list') ? 'block' : 'none';
        }
        if (viewKanban) {
            viewKanban.classList.toggle('hidden', viewName !== 'kanban');
            viewKanban.style.display = (viewName === 'kanban') ? 'block' : 'none';
        }

        if (viewName === 'report') {
            if (btnReport) btnReport.className = 'px-3 py-1.5 rounded-md font-bold text-xs flex items-center space-x-1.5 transition bg-violet-500 text-white shadow-xs';
            if (typeof mountTaskExecutiveDashboard === 'function') {
                mountTaskExecutiveDashboard();
            }
        } else if (viewName === 'list') {
            if (btnList) btnList.className = 'px-3 py-1.5 rounded-md font-bold text-xs flex items-center space-x-1.5 transition bg-indigo-500 text-white shadow-xs';
            this.renderTasksTable();
        } else if (viewName === 'kanban') {
            if (btnKanban) btnKanban.className = 'px-3 py-1.5 rounded-md font-bold text-xs flex items-center space-x-1.5 transition bg-blue-500 text-white shadow-xs';
            this.renderKanbanView();
        }

        window.dispatchEvent(new CustomEvent('taskFiltersChanged'));
    },

    currentArchetype: 'workflow',

    WORKFLOW_TEMPLATES: {
        'pdca': {
            name: 'Quy trình Quản trị chất lượng PDCA (4 bước)',
            steps: [
                'Lập kế hoạch mục tiêu & Khảo sát hiện trạng (Plan)',
                'Triển khai thực hiện nhiệm vụ (Do)',
                'Kiểm tra, giám sát & Đánh giá kết quả (Check)',
                'Nghiệm thu, chuẩn hóa & Đề xuất cải tiến (Act)'
            ]
        },
        'mua_sam': {
            name: 'Mua sắm trang thiết bị & Nghiệm thu CSVC (4 bước)',
            steps: [
                'Khảo sát nhu cầu, lập dự toán & lấy báo giá (Bước 1)',
                'Trình BGH thẩm định & phê duyệt phương án mua sắm (Bước 2)',
                'Ký hợp đồng, giao nhận & lắp đặt thiết bị tại đơn vị (Bước 3)',
                'Hội đồng kiểm tra, nghiệm thu kỹ thuật & quyết toán (Bước 4)'
            ]
        },
        'su_kien': {
            name: 'Tổ chức sự kiện, hội thao & lễ khai giảng (4 bước)',
            steps: [
                'Lập kế hoạch tổng thể, kịch bản & phân công nhân sự (Bước 1)',
                'Chuẩn bị cơ sở vật chất, âm thanh, ánh sáng & ma-két (Bước 2)',
                'Tổng duyệt chương trình & đón tiếp đại biểu (Bước 3)',
                'Điều hành tổ chức sự kiện & họp rút kinh nghiệm (Bước 4)'
            ]
        },
        'de_cuong': {
            name: 'Biên soạn & Cập nhật đề cương CTĐT môn học (4 bước)',
            steps: [
                'Họp bộ môn rà soát ma trận chuẩn đầu ra và đề cương (Bước 1)',
                'Biên soạn, cập nhật nội dung chi tiết và tài liệu học tập (Bước 2)',
                'Hội đồng khoa thẩm định và phản biện chuyên môn (Bước 3)',
                'Trình Hội đồng trường/BGH ban hành và áp dụng (Bước 4)'
            ]
        },
        'bao_duong': {
            name: 'Bảo dưỡng định kỳ & Kiểm kê thiết bị phòng máy (3 bước)',
            steps: [
                'Kiểm tra tình trạng kỹ thuật và lập biên bản hiện trạng (Bước 1)',
                'Vệ sinh, bảo trì phần cứng và cập nhật phần mềm (Bước 2)',
                'Bàn giao phòng máy hoạt động tốt cho cán bộ quản lý (Bước 3)'
            ]
        }
    },


    // ================================================================
    // LOAD TASKS (CENTRAL ORCHESTRATOR)
    // ================================================================
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
            if (this.currentView === 'report' && !window.location.pathname.includes('tasks-list.html')) {
                this.renderKpiWidget();
            }
            window.dispatchEvent(new CustomEvent('taskFiltersChanged'));
        } catch (e) {
            console.error('[TasksPage] Lỗi render giao diện:', e);
            // Không show toast - hiển thị lỗi trong console để debug
        }
    },

};

// Tích hợp kiến trúc 5 tầng Module hóa (Facade Pattern)
if (typeof TasksStore !== 'undefined') {
    TasksStore.subscribe((key, val) => {
        if (key in TasksPage) TasksPage[key] = val;
    });
}
if (typeof TasksKpiRenderer !== 'undefined') Object.assign(TasksPage, TasksKpiRenderer);
if (typeof TasksViewRenderer !== 'undefined') Object.assign(TasksPage, TasksViewRenderer);
if (typeof TasksModalManager !== 'undefined') Object.assign(TasksPage, TasksModalManager);

window.TasksPage = TasksPage;

document.addEventListener('DOMContentLoaded', () => {
    TasksPage.init();
});
