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

        const activeClass = ['bg-white', 'text-blue-900', 'shadow-xs'];
        const inactiveClass = ['text-slate-600', 'hover:text-blue-900', 'hover:bg-white/50'];

        [btnReport, btnList, btnKanban].forEach(btn => {
            if (btn) {
                btn.classList.remove(...activeClass);
                btn.classList.add(...inactiveClass);
                btn.querySelector('i')?.classList.remove('text-blue-700');
            }
        });

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
            btnReport?.classList.add(...activeClass);
            btnReport?.classList.remove(...inactiveClass);
            btnReport?.querySelector('i')?.classList.add('text-blue-700');
            if (typeof mountTaskExecutiveDashboard === 'function') {
                mountTaskExecutiveDashboard();
            }
        } else if (viewName === 'list') {
            btnList?.classList.add(...activeClass);
            btnList?.classList.remove(...inactiveClass);
            btnList?.querySelector('i')?.classList.add('text-blue-700');
            this.renderTasksTable();
        } else if (viewName === 'kanban') {
            btnKanban?.classList.add(...activeClass);
            btnKanban?.classList.remove(...inactiveClass);
            btnKanban?.querySelector('i')?.classList.add('text-blue-700');
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

    calculateUserWorkload(userId) {
        if (!this.tasks) return { active: 0, overdue: 0 };
        let active = 0, overdue = 0;
        const now = new Date();
        this.tasks.forEach(t => {
            if (t.assignee_id === userId && t.status !== 'HOAN_THANH' && t.status !== 'HUY_BO') {
                active++;
                if (t.due_date && new Date(t.due_date) < now) overdue++;
            }
        });
        return { active, overdue };
    },

    // ----------------------------------------------------
    // PHÂN HỆ ĐIỀU PHỐI ĐỘNG THÍCH ỨNG THEO VAI TRÒ (ROLE-ADAPTIVE DISPATCH ENGINE)
    // ----------------------------------------------------
    currentDispatchRole: 'BGH', // 'BGH' | 'DEPT_HEAD' | 'STAFF'
    staffTaskMode: 'todo',      // 'todo' | 'verbal' | 'proposal'

    setDispatchRole(role) {
        this.currentDispatchRole = role;

        // 1. Cập nhật Pills trên Header Modal
        ['BGH', 'DEPT_HEAD', 'STAFF'].forEach(r => {
            const pill = document.getElementById(`role-pill-${r}`);
            if (pill) {
                if (r === role) {
                    pill.className = 'px-2.5 py-1 rounded-md bg-white text-blue-950 font-bold shadow-xs transition';
                } else {
                    pill.className = 'px-2.5 py-1 rounded-md text-slate-500 hover:text-slate-900 font-semibold transition';
                }
            }
        });

        // 2. DOM Elements
        const titleEl = document.getElementById('modalCreateTaskTitle');
        const subTitleEl = document.getElementById('modalCreateTaskSubTitle');
        const iconWrapper = document.getElementById('modalCreateTaskIcon');
        const staffToggle = document.getElementById('staffModeToggleWrapper');
        const deptRow = document.getElementById('deptRowWrapper');
        const leadingDeptSelect = document.getElementById('taskLeadingDept');
        const assistingWrapper = document.getElementById('assistingDeptWrapper');
        const assigneeWrapper = document.getElementById('assigneeWrapper');
        const archetypeBar = document.getElementById('archetypeBarSection');
        const descColWrapper = document.getElementById('descColWrapper');
        const requesterWrapper = document.getElementById('requesterWrapper');

        // Lấy đơn vị của người dùng hiện tại (nếu có)
        const currentUser = Common.currentUser || API.getUser() || {};
        const userDeptId = currentUser.department_id || (this.departments.length > 0 ? this.departments[0].id : null);

        if (role === 'BGH') {
            // VAI TRÒ 1: BAN GIÁM HIỆU (Giao việc & Chỉ đạo cấp trường)
            if (titleEl) titleEl.innerText = 'Giao Nhiệm Vụ & Chỉ Đạo Cấp Trường';
            if (subTitleEl) subTitleEl.innerText = 'Phân công đơn vị chủ trì, chỉ định đầu mối và gắn quy trình thực thi toàn trường';
            if (iconWrapper) {
                iconWrapper.className = 'w-7 h-7 rounded-lg bg-blue-800 text-white flex items-center justify-center text-xs';
                iconWrapper.innerHTML = '<i class="fa-solid fa-plus"></i>';
            }
            if (staffToggle) staffToggle.classList.add('hidden');
            if (deptRow) deptRow.classList.remove('hidden');
            if (leadingDeptSelect) {
                leadingDeptSelect.disabled = false;
                leadingDeptSelect.className = 'w-full px-3 py-2 border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-blue-800 font-semibold text-slate-900';
            }
            if (assistingWrapper) assistingWrapper.classList.remove('hidden');
            if (assigneeWrapper) assigneeWrapper.classList.remove('hidden');
            if (archetypeBar) archetypeBar.classList.remove('hidden');
            if (submitBtnText) submitBtnText.innerText = 'Giao Nhiệm Vụ (BGH)';

            // Mô tả full dòng (3 cols), Ẩn Người giao việc
            if (descColWrapper) descColWrapper.className = 'sm:col-span-3';
            if (requesterWrapper) requesterWrapper.classList.add('hidden');
            const collabSec = document.getElementById('collaboratorsSection');
            if (collabSec) {
                collabSec.classList.remove('sm:col-span-1');
                collabSec.classList.add('sm:col-span-2');
            }

            this.populateSelectOptions();

        } else if (role === 'DEPT_HEAD') {
            // VAI TRÒ 2: TRƯỞNG PHÒNG / TRƯỞNG KHOA / TỔ TRƯỞNG (Điều phối nội bộ)
            const deptObj = this.departments.find(d => d.id === userDeptId) || this.departments[0];
            const deptTag = deptObj ? `[${deptObj.code}] ${deptObj.name}` : 'Đơn vị';

            if (titleEl) titleEl.innerText = `Phân Công Nhiệm Vụ Nội Bộ (${deptObj ? deptObj.code : ''})`;
            if (subTitleEl) subTitleEl.innerText = `Điều phối công việc cho cán bộ, giảng viên trong ${deptTag}`;
            if (iconWrapper) {
                iconWrapper.className = 'w-7 h-7 rounded-lg bg-teal-700 text-white flex items-center justify-center text-xs';
                iconWrapper.innerHTML = '<i class="fa-solid fa-users-gear"></i>';
            }
            if (staffToggle) staffToggle.classList.add('hidden');
            if (deptRow) deptRow.classList.remove('hidden');
            if (leadingDeptSelect) {
                if (userDeptId) leadingDeptSelect.value = userDeptId;
                leadingDeptSelect.disabled = true; // Khóa cứng đơn vị
                leadingDeptSelect.className = 'w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-100 font-bold text-blue-900 cursor-not-allowed';
            }
            if (assistingWrapper) assistingWrapper.classList.remove('hidden');
            if (assigneeWrapper) assigneeWrapper.classList.remove('hidden');
            if (archetypeBar) archetypeBar.classList.remove('hidden');
            if (submitBtnText) submitBtnText.innerText = 'Phân Công Nội Bộ';

            // Mô tả full dòng (3 cols), Ẩn Người giao việc
            if (descColWrapper) descColWrapper.className = 'sm:col-span-3';
            if (requesterWrapper) requesterWrapper.classList.add('hidden');
            const collabSec = document.getElementById('collaboratorsSection');
            if (collabSec) {
                collabSec.classList.remove('sm:col-span-1');
                collabSec.classList.add('sm:col-span-2');
            }

            this.populateWorkflowSelect(userDeptId);
            this.filterAssigneesByDept(userDeptId);

        } else if (role === 'STAFF') {
            // VAI TRÒ 3: CÁ NHÂN / CÁN BỘ / GIẢNG VIÊN (Thực thi & Đề xuất)
            if (staffToggle) staffToggle.classList.remove('hidden');
            if (deptRow) deptRow.classList.add('hidden'); // Ẩn chọn đơn vị
            if (assigneeWrapper) assigneeWrapper.classList.add('hidden'); // Ẩn chọn cán bộ (mặc định là chính mình)
            if (archetypeBar) archetypeBar.classList.add('hidden');

            // Mô tả 2 cols + Người giao việc 1 col
            if (descColWrapper) descColWrapper.className = 'sm:col-span-2';

            this.setStaffTaskMode('todo');
        }
    },

    showRequesterDropdown() {
        const menu = document.getElementById('requesterDropdownMenu');
        if (!menu) return;
        const currentVal = document.getElementById('taskRequester')?.value || '';
        this.filterRequesterDropdown(currentVal);
    },

    filterRequesterDropdown(query = '') {
        const menu = document.getElementById('requesterDropdownMenu');
        const clearBtn = document.getElementById('taskRequesterClearBtn');
        if (!menu) return;

        if (clearBtn) {
            clearBtn.classList.toggle('hidden', !query.trim());
        }

        const q = (query || '').toLowerCase().trim();
        let list = this.users || [];
        if (q) {
            list = list.filter(u => {
                const name = (u.full_name || '').toLowerCase();
                const dept = (u.department?.name || u.department?.code || '').toLowerCase();
                const role = (u.role || '').toLowerCase();
                return name.includes(q) || dept.includes(q) || role.includes(q);
            });
        }

        if (list.length === 0) {
            menu.innerHTML = `
                <div class="p-3 text-center text-slate-400 italic text-xs">
                    Không tìm thấy cán bộ phù hợp. Bạn có thể giữ nguyên tên vừa gõ.
                </div>
            `;
            menu.classList.remove('hidden');
            return;
        }

        menu.innerHTML = list.slice(0, 15).map(u => {
            const deptCode = u.department ? u.department.code : '';
            const safeFullName = (u.full_name || 'Cán bộ').replace(/'/g, "\\'");
            const safeDeptCode = (deptCode || '').replace(/'/g, "\\'");
            return `
                <div onclick="TasksPage.selectRequester('${safeFullName}${safeDeptCode ? ' (' + safeDeptCode + ')' : ''}')" 
                    class="p-2.5 hover:bg-blue-50 cursor-pointer flex items-center justify-between text-xs group transition">
                    <div class="flex items-center space-x-2">
                        <div class="w-6 h-6 rounded-full bg-blue-100 text-blue-900 font-bold flex items-center justify-center text-[10px] shrink-0">
                            ${(u.full_name || 'U').charAt(0)}
                        </div>
                        <div>
                            <div class="font-semibold text-slate-800 group-hover:text-blue-900">${u.full_name}</div>
                            <div class="text-[10px] text-slate-400">${u.role || 'Cán bộ'} ${u.email ? '• ' + u.email : ''}</div>
                        </div>
                    </div>
                    ${deptCode ? `<span class="px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-slate-100 text-slate-600 group-hover:bg-blue-100 group-hover:text-blue-900">${deptCode}</span>` : ''}
                </div>
            `;
        }).join('');

        menu.classList.remove('hidden');
    },

    selectRequester(nameWithDept) {
        const input = document.getElementById('taskRequester');
        const clearBtn = document.getElementById('taskRequesterClearBtn');
        const menu = document.getElementById('requesterDropdownMenu');
        if (input) input.value = nameWithDept;
        if (clearBtn) clearBtn.classList.remove('hidden');
        if (menu) menu.classList.add('hidden');
    },

    clearTaskRequester() {
        const input = document.getElementById('taskRequester');
        const clearBtn = document.getElementById('taskRequesterClearBtn');
        if (input) {
            input.value = '';
            input.focus();
        }
        if (clearBtn) clearBtn.classList.add('hidden');
        this.showRequesterDropdown();
    },

    // ----------------------------------------------------
    // XỬ LÝ CÁN BỘ / ĐỒNG NGHIỆP PHỐI HỢP CÙNG THỰC HIỆN
    // ----------------------------------------------------
    selectedCollaborators: [],

    showCollaboratorDropdown() {
        const menu = document.getElementById('collaboratorDropdownMenu');
        if (!menu) return;
        const currentVal = document.getElementById('taskCollaboratorInput')?.value || '';
        this.filterCollaboratorDropdown(currentVal);
    },

    filterCollaboratorDropdown(query = '') {
        const menu = document.getElementById('collaboratorDropdownMenu');
        if (!menu) return;

        const q = (query || '').toLowerCase().trim();
        const selectedIds = new Set((this.selectedCollaborators || []).map(c => c.id));
        const currentUser = API.getUser ? API.getUser() : null;
        if (currentUser) selectedIds.add(currentUser.id);

        let list = (this.users || []).filter(u => !selectedIds.has(u.id));
        if (q) {
            list = list.filter(u => {
                const name = (u.full_name || '').toLowerCase();
                const dept = (u.department?.name || u.department?.code || '').toLowerCase();
                const role = (u.role || '').toLowerCase();
                return name.includes(q) || dept.includes(q) || role.includes(q);
            });
        }

        if (list.length === 0) {
            menu.innerHTML = `
                <div class="p-3 text-center text-slate-400 italic text-xs">
                    Không tìm thấy đồng nghiệp khả dụng để thêm vào phối hợp.
                </div>
            `;
            menu.classList.remove('hidden');
            return;
        }

        menu.innerHTML = list.slice(0, 15).map(u => {
            const deptCode = u.department ? u.department.code : '';
            return `
                <div onclick="TasksPage.addCollaborator(${u.id})" 
                    class="p-2.5 hover:bg-blue-50 cursor-pointer flex items-center justify-between text-xs group transition">
                    <div class="flex items-center space-x-2">
                        <div class="w-6 h-6 rounded-full bg-blue-100 text-blue-900 font-bold flex items-center justify-center text-[10px] shrink-0">
                            ${(u.full_name || 'U').charAt(0)}
                        </div>
                        <div>
                            <div class="font-semibold text-slate-800 group-hover:text-blue-900">${u.full_name}</div>
                            <div class="text-[10px] text-slate-400">${u.role || 'Cán bộ'} ${u.email ? '• ' + u.email : ''}</div>
                        </div>
                    </div>
                    ${deptCode ? `<span class="px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-slate-100 text-slate-600 group-hover:bg-blue-100 group-hover:text-blue-900">${deptCode}</span>` : ''}
                </div>
            `;
        }).join('');

        menu.classList.remove('hidden');
    },

    addCollaborator(userId) {
        const u = (this.users || []).find(x => x.id === userId);
        if (!u) return;
        if (!this.selectedCollaborators) this.selectedCollaborators = [];
        if (!this.selectedCollaborators.some(c => c.id === userId)) {
            this.selectedCollaborators.push({
                id: u.id,
                full_name: u.full_name,
                dept_code: u.department ? u.department.code : ''
            });
            this.renderSelectedCollaborators();
        }
        const input = document.getElementById('taskCollaboratorInput');
        if (input) {
            input.value = '';
            input.focus();
        }
        const menu = document.getElementById('collaboratorDropdownMenu');
        if (menu) menu.classList.add('hidden');
    },

    removeCollaborator(userId) {
        this.selectedCollaborators = (this.selectedCollaborators || []).filter(c => c.id !== userId);
        this.renderSelectedCollaborators();
    },

    renderSelectedCollaborators() {
        const listEl = document.getElementById('selectedCollaboratorsList');
        if (!listEl) return;
        if (!this.selectedCollaborators || this.selectedCollaborators.length === 0) {
            listEl.innerHTML = `<span class="text-[11px] text-slate-400 italic" id="emptyCollaboratorsMsg">Chưa có người phối hợp (Làm độc lập)</span>`;
            return;
        }

        listEl.innerHTML = this.selectedCollaborators.map(c => `
            <span class="inline-flex items-center space-x-1.5 px-2.5 py-1 bg-blue-100 text-blue-900 border border-blue-200 rounded-lg text-xs font-semibold animate-scale-in">
                <i class="fa-solid fa-user-check text-blue-600 text-[10px]"></i>
                <span>${c.full_name}${c.dept_code ? ' (' + c.dept_code + ')' : ''}</span>
                <button type="button" onclick="TasksPage.removeCollaborator(${c.id})" class="text-blue-500 hover:text-red-600 ml-1">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </span>
        `).join('');
    },

    setStaffTaskMode(mode) {
        this.staffTaskMode = mode || 'todo';
        const titleEl = document.getElementById('modalCreateTaskTitle');
        const subTitleEl = document.getElementById('modalCreateTaskSubTitle');
        const iconWrapper = document.getElementById('modalCreateTaskIcon');
        const btnTodo = document.getElementById('staffModeBtnTodo');
        const btnProposal = document.getElementById('staffModeBtnProposal');
        const submitBtnText = document.getElementById('btnSubmitTaskText');
        const submitBtn = document.getElementById('btnSubmitTask');
        const requesterWrapper = document.getElementById('requesterWrapper');
        const collabSec = document.getElementById('collaboratorsSection');

        if (this.staffTaskMode === 'todo') {
            if (titleEl) titleEl.innerText = 'Công Việc Cá Nhân';
            if (subTitleEl) subTitleEl.innerText = 'Tự lập danh sách việc cần làm cho chính mình (My To-Do)';
            if (iconWrapper) {
                iconWrapper.className = 'w-7 h-7 rounded-lg bg-white border border-indigo-200 text-indigo-700 flex items-center justify-center text-xs shadow-xs';
                iconWrapper.innerHTML = '<i class="fa-solid fa-user-pen"></i>';
            }
            if (btnTodo) {
                btnTodo.className = 'flex-1 p-2.5 rounded-xl border-2 border-indigo-600 bg-indigo-50/90 text-indigo-950 font-bold text-left transition text-xs shadow-xs ring-2 ring-indigo-200/60';
            }
            if (btnProposal) {
                btnProposal.className = 'flex-1 p-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 font-semibold text-left hover:bg-slate-50 transition text-xs';
            }
            if (submitBtnText) submitBtnText.innerText = 'Lưu Việc Cá Nhân';
            if (submitBtn) {
                submitBtn.className = 'px-5 py-2 bg-blue-800 hover:bg-blue-900 text-white rounded-lg font-bold transition flex items-center space-x-1.5 shadow-xs';
            }
            if (requesterWrapper) requesterWrapper.classList.remove('hidden');
            if (collabSec) {
                collabSec.classList.remove('sm:col-span-2');
                collabSec.classList.add('sm:col-span-1');
            }
        } else {
            if (titleEl) titleEl.innerText = 'Đề Xuất Nhiệm Vụ';
            if (subTitleEl) subTitleEl.innerText = 'Gửi đề xuất nhiệm vụ lên Trưởng đơn vị phê duyệt';
            if (iconWrapper) {
                iconWrapper.className = 'w-7 h-7 rounded-lg bg-white border border-amber-300 text-amber-500 flex items-center justify-center text-xs shadow-xs';
                iconWrapper.innerHTML = '<i class="fa-solid fa-lightbulb text-amber-500 text-sm"></i>';
            }
            if (btnProposal) {
                btnProposal.className = 'flex-1 p-2.5 rounded-xl border-2 border-amber-400 bg-amber-50/90 text-amber-950 font-bold text-left transition text-xs shadow-xs ring-2 ring-amber-200/60';
            }
            if (btnTodo) {
                btnTodo.className = 'flex-1 p-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 font-semibold text-left hover:bg-slate-50 transition text-xs';
            }
            if (submitBtnText) submitBtnText.innerText = 'Gửi Đề Xuất Cho Trưởng Phòng';
            if (submitBtn) {
                submitBtn.className = 'px-5 py-2 bg-blue-800 hover:bg-blue-900 text-white rounded-lg font-bold transition flex items-center space-x-1.5 shadow-xs';
            }
            if (requesterWrapper) requesterWrapper.classList.add('hidden');
            if (collabSec) {
                collabSec.classList.remove('sm:col-span-1');
                collabSec.classList.add('sm:col-span-2');
            }
        }
    },

    switchTaskArchetype(type) {
        this.currentArchetype = type;
        const btnTypes = ['quick', 'workflow', 'multi_dept'];
        btnTypes.forEach(t => {
            const btn = document.getElementById(`archetype-btn-${t}`);
            if (btn) {
                if (t === type) {
                    btn.className = 'px-3 py-1.5 rounded-lg font-bold text-xs bg-blue-800 text-white shadow-xs transition flex items-center space-x-1.5';
                } else {
                    btn.className = 'px-3 py-1.5 rounded-lg font-semibold text-xs text-slate-600 bg-slate-100 hover:bg-slate-200 hover:text-slate-900 transition flex items-center space-x-1.5';
                }
            }
        });

        const workflowSec = document.getElementById('workflowBuilderSection');
        if (workflowSec) {
            workflowSec.classList.toggle('hidden', type === 'quick');
        }

        if (type === 'quick') {
            this.clearWorkflowSteps();
        }
    },

    // ----------------------------------------------------
    // BỘ ĐIỀU KHIỂN MỨC ĐỘ ƯU TIÊN & THỜI HẠN THÔNG MINH (EXECUTIVE PRIORITY & DEADLINE CONTROLLER)
    // ----------------------------------------------------
    matchPriorityFromDays(days) {
        if (days <= 1) return 'KHAN_CAP';
        if (days <= 3) return 'CAO';
        if (days <= 7) return 'TRUNG_BINH';
        return 'THAP';
    },

    updatePriorityUIOnly(priority) {
        const input = document.getElementById('taskPriority');
        if (input) input.value = priority;

        const priorities = [
            { key: 'THAP', activeCls: 'border-slate-600 bg-slate-200/90 text-slate-950' },
            { key: 'TRUNG_BINH', activeCls: 'border-blue-700 bg-blue-50/90 text-blue-950' },
            { key: 'CAO', activeCls: 'border-amber-600 bg-amber-50/90 text-amber-950' },
            { key: 'KHAN_CAP', activeCls: 'border-red-600 bg-red-50/90 text-red-950' }
        ];

        priorities.forEach(p => {
            const btn = document.getElementById(`priority-btn-${p.key}`);
            if (btn) {
                if (p.key === priority) {
                    btn.className = `py-1.5 px-1 rounded-md border-2 ${p.activeCls} font-bold text-xs shadow-xs transition text-center whitespace-nowrap`;
                } else {
                    btn.className = 'py-1.5 px-1 rounded-md bg-white border border-slate-200 text-slate-600 font-semibold text-xs hover:bg-slate-50 transition text-center whitespace-nowrap';
                }
            }
        });
    },

    setTaskPriority(priority) {
        this.updatePriorityUIOnly(priority);

        let days = 7;
        if (priority === 'KHAN_CAP') days = 1;
        else if (priority === 'CAO') days = 3;
        else if (priority === 'TRUNG_BINH') days = 7;
        else if (priority === 'THAP') days = 14;

        this.setTaskDurationAndDueDate(days);
    },

    handlePriorityChange(priority) {
        this.setTaskPriority(priority);
    },

    stepDurationDays(delta) {
        const input = document.getElementById('taskDurationDays');
        if (!input) return;
        const currentDays = parseInt(input.value) || 1;
        const newDays = Math.max(1, currentDays + delta);
        input.value = newDays;
        this.handleDurationDaysInput(newDays);
    },

    handleDurationDaysInput(daysVal) {
        const days = Math.max(1, parseInt(daysVal) || 1);
        // Tự động nhảy Mức độ ưu tiên tương ứng theo số ngày
        const autoPriority = this.matchPriorityFromDays(days);
        this.updatePriorityUIOnly(autoPriority);
        this.setTaskDurationAndDueDate(days, false);
    },

    handleDueDateChange(dateStr) {
        if (dateStr) {
            const targetDate = new Date(dateStr);
            const now = new Date();
            targetDate.setHours(0, 0, 0, 0);
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const diffTime = targetDate.getTime() - today.getTime();
            const diffDays = Math.max(1, Math.round(diffTime / (1000 * 60 * 60 * 24)));
            const durationInput = document.getElementById('taskDurationDays');
            if (durationInput) durationInput.value = diffDays;
            // Tự động nhảy Mức độ ưu tiên tương ứng theo khoảng ngày
            const autoPriority = this.matchPriorityFromDays(diffDays);
            this.updatePriorityUIOnly(autoPriority);
        }
        this.checkDeadlineSafety(dateStr);
    },

    setTaskDurationAndDueDate(days, updateDaysInput = true) {
        const durationInput = document.getElementById('taskDurationDays');
        const deadlineInput = document.getElementById('taskDueDate');

        if (updateDaysInput && durationInput) durationInput.value = days;

        if (deadlineInput) {
            const target = new Date();
            target.setDate(target.getDate() + days);
            
            // Format YYYY-MM-DD cho input date (bỏ giờ phút AM/PM cồng kềnh)
            const year = target.getFullYear();
            const month = String(target.getMonth() + 1).padStart(2, '0');
            const day = String(target.getDate()).padStart(2, '0');
            
            const formatted = `${year}-${month}-${day}`;
            deadlineInput.value = formatted;
            this.checkDeadlineSafety(formatted);
        }
    },

    populateSelectOptions() {
        const leadingDeptSelect = document.getElementById('taskLeadingDept');
        const assistingDeptSelect = document.getElementById('taskAssistingDept');
        const filterDeptSelect = document.getElementById('filterDept');

        if (leadingDeptSelect) {
            leadingDeptSelect.innerHTML = '<option value="">-- Chọn đơn vị chủ trì * --</option>' +
                this.departments.map(d => `<option value="${d.id}">${d.name} (${d.code})</option>`).join('');
            
            leadingDeptSelect.onchange = () => {
                const deptId = leadingDeptSelect.value ? parseInt(leadingDeptSelect.value) : null;
                this.populateWorkflowSelect(deptId);
                this.filterAssigneesByDept(deptId);
            };
        }

        if (assistingDeptSelect) {
            assistingDeptSelect.innerHTML = '<option value="">-- Chọn đơn vị phối hợp (Tùy chọn) --</option>' +
                this.departments.map(d => `<option value="${d.id}">${d.name} (${d.code})</option>`).join('');
        }

        this.populateAssigneeSelect();

        if (filterDeptSelect) {
            filterDeptSelect.innerHTML = '<option value="">Tất cả đơn vị</option>' +
                this.departments.map(d => `<option value="${d.id}">[${d.code}] ${d.name}</option>`).join('');
        }

        this.populateWorkflowSelect();
    },

    async populateAssigneeSelect(deptId = null) {
        const assigneeSelect = document.getElementById('taskAssignee');
        if (!assigneeSelect) return;

        let userList = [...this.users];
        if (deptId) {
            userList = userList.filter(u => u.department_id === deptId || !u.department_id);
        }

        let workloadMap = {};
        try {
            if (API && API.getWorkload) {
                const workloadData = await API.getWorkload(deptId);
                if (Array.isArray(workloadData)) {
                    workloadData.forEach(w => {
                        workloadMap[w.user_id] = w;
                    });
                }
            }
        } catch (err) {
            // fallback
        }

        // Calculate workload and sort idle users first
        const usersWithWorkload = userList.map(u => {
            const liveWl = workloadMap[u.id];
            const activeCount = liveWl ? liveWl.in_progress_count : this.calculateUserWorkload(u.id).active;
            const overdueCount = this.calculateUserWorkload(u.id).overdue;
            return { ...u, activeCount, overdueCount };
        }).sort((a, b) => a.activeCount - b.activeCount);

        assigneeSelect.innerHTML = '<option value="">🏢 [Tập thể đơn vị tự điều phối]</option>' +
            usersWithWorkload.map(u => {
                let tag = `🟢 [Rảnh: 0 việc]`;
                if (u.overdueCount > 0 || u.activeCount >= 5) {
                    tag = `🔴 [⚠️ Quá tải: ${u.activeCount} việc${u.overdueCount > 0 ? `, ${u.overdueCount} trễ` : ''}]`;
                } else if (u.activeCount >= 3) {
                    tag = `🟡 [Vừa phải: ${u.activeCount} việc]`;
                } else if (u.activeCount > 0) {
                    tag = `🟢 [Tải nhẹ: ${u.activeCount} việc]`;
                }
                const deptCode = u.department ? u.department.code : 'HueIC';
                return `<option value="${u.id}">${u.full_name} (${deptCode}) — ${tag}</option>`;
            }).join('');
    },

    filterAssigneesByDept(deptId) {
        this.populateAssigneeSelect(deptId);
    },

    checkDeadlineSafety(val) {
        const warningEl = document.getElementById('deadlineSafetyWarning');
        if (!val || !warningEl) return;

        const date = new Date(val);
        const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday
        if (dayOfWeek === 0 || dayOfWeek === 6) {
            const dayName = dayOfWeek === 0 ? 'Chủ Nhật' : 'Thứ 7';
            // Calculate next Monday
            const mondayDate = new Date(date);
            const daysToAdd = dayOfWeek === 6 ? 2 : 1;
            mondayDate.setDate(mondayDate.getDate() + daysToAdd);
            
            const monYear = mondayDate.getFullYear();
            const monMonth = String(mondayDate.getMonth() + 1).padStart(2, '0');
            const monDay = String(mondayDate.getDate()).padStart(2, '0');
            const formattedMonday = `${monYear}-${monMonth}-${monDay}`;
            const displayMonday = `${monDay}/${monMonth}/${monYear}`;

            const oldYear = date.getFullYear();
            const oldMonth = String(date.getMonth() + 1).padStart(2, '0');
            const oldDay = String(date.getDate()).padStart(2, '0');
            const displayOld = `${oldDay}/${oldMonth}/${oldYear}`;

            warningEl.innerHTML = `
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-2.5 rounded-lg bg-amber-50 border border-amber-300 text-amber-950 text-xs shadow-xs animate-fade-in">
                    <div class="flex items-center gap-2">
                        <span class="text-base shrink-0">🛡️</span>
                        <div>
                            <b>Weekend Smart Shield:</b> Hạn chót rơi vào <b>${dayName} (${displayOld})</b> là ngày nghỉ cuối tuần.
                        </div>
                    </div>
                    <div class="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                        <button type="button" onclick="TasksPage.shiftDeadlineToMonday('${formattedMonday}')" class="px-2.5 py-1 rounded-md bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition shadow-xs flex items-center gap-1">
                            <i class="fa-regular fa-calendar-check"></i> Dời sang Thứ Hai (${displayMonday})
                        </button>
                        <button type="button" onclick="TasksPage.dismissWeekendShield()" class="px-2 py-1 rounded-md bg-white border border-amber-300 hover:bg-amber-100 text-amber-900 font-semibold text-xs transition">
                            ✕ Giữ nguyên
                        </button>
                    </div>
                </div>
            `;
            warningEl.classList.remove('hidden');
        } else {
            warningEl.classList.add('hidden');
        }
    },

    shiftDeadlineToMonday(mondayDateStr) {
        const deadlineInput = document.getElementById('taskDueDate');
        if (deadlineInput) {
            deadlineInput.value = mondayDateStr;
            this.handleDueDateChange(mondayDateStr);
        }
        const warningEl = document.getElementById('deadlineSafetyWarning');
        if (warningEl) warningEl.classList.add('hidden');
        if (window.Common && Common.showToast) {
            Common.showToast('Đã tự động dời hạn chót sang Thứ Hai đầu tuần thành công!', 'success');
        }
    },

    dismissWeekendShield() {
        const warningEl = document.getElementById('deadlineSafetyWarning');
        if (warningEl) warningEl.classList.add('hidden');
    },

    populateWorkflowSelect(deptId = null) {
        const select = document.getElementById('taskWorkflowSelect');
        if (!select) return;

        let available = this.workflows;
        if (deptId) {
            available = this.workflows.filter(w => w.department_id === deptId || w.department_id === null);
        }

        let optionsHtml = '<option value="">-- Chọn quy trình mẫu từ danh mục chuẩn --</option>';
        
        // System presets
        optionsHtml += '<optgroup label="📋 Mẫu Chuẩn Toàn Trường (HueIC Presets)">';
        Object.entries(this.WORKFLOW_TEMPLATES).forEach(([k, t]) => {
            optionsHtml += `<option value="preset:${k}">${t.name}</option>`;
        });
        optionsHtml += '</optgroup>';

        if (available.length > 0) {
            optionsHtml += '<optgroup label="🏢 Quy Trình Đơn Vị Đã Thiết Lập">';
            optionsHtml += available.map(w => {
                const deptTag = w.department ? `[${w.department.code}]` : '[Toàn trường]';
                const stepCount = (w.steps || []).length;
                return `<option value="${w.id}">${deptTag} ${w.name} (${stepCount} bước)</option>`;
            }).join('');
            optionsHtml += '</optgroup>';
        }

        select.innerHTML = optionsHtml;
    },

    handleSelectWorkflowTemplate(wfVal, silent = false) {
        if (!wfVal) return;
        const strVal = String(wfVal).trim();

        if (strVal.startsWith('preset:')) {
            const presetKey = strVal.replace('preset:', '');
            const preset = this.WORKFLOW_TEMPLATES[presetKey];
            if (preset) {
                this.currentSelectedWorkflowName = preset.name;
                this.createWorkflowSteps = preset.steps.map((title, idx) => ({
                    id: idx + 1,
                    title,
                    is_completed: false,
                    note: ''
                }));
                this.renderCreateTaskSteps();
                if (!silent) Common.showToast(`Đã áp dụng mẫu: ${preset.name}`, 'info');
            }
            return;
        }

        const wf = this.workflows.find(w => w.id === parseInt(strVal));
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
        if (!silent) Common.showToast(`Đã áp dụng quy trình: ${wf.name}`, 'info');
    },

    applyUrlFilters() {
        const params = new URLSearchParams(window.location.search);
        const status = params.get('status');
        const priority = params.get('priority');
        const dept_id = params.get('dept_id');
        const user_id = params.get('user_id');
        const search = params.get('search');
        const quickFilter = params.get('quick_filter') || params.get('filter');

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
        if (quickFilter) {
            this.currentQuickFilter = quickFilter;
        }

        if (params.get('action') === 'create') {
            setTimeout(() => this.openCreateTaskModal(), 250);
        }
        if (params.get('task_id')) {
            const tId = parseInt(params.get('task_id'));
            if (tId) setTimeout(() => this.openTaskDetail(tId), 300);
        }

        if (status || priority || dept_id || user_id || search || quickFilter) {
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
            window.dispatchEvent(new CustomEvent('taskFiltersChanged'));
        } catch (e) {
            console.error('[TasksPage] Lỗi render giao diện:', e);
            // Không show toast - hiển thị lỗi trong console để debug
        }
    },

    // ----------------------------------------------------
    // QUICK FILTER CONTROLLERS
    // ----------------------------------------------------

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
        window.dispatchEvent(new CustomEvent('taskFiltersChanged'));
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
                            <div class="text-[10px] text-slate-500">${t.assignee ? t.assignee.full_name : '<span class="font-semibold text-indigo-700">🏢 Tập thể đơn vị</span>'}</div>
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
                                <span class="text-slate-400 text-[11px]">Người nhận:</span>
                                <span class="ml-1 font-semibold text-slate-700">${t.assignee ? t.assignee.full_name : '<span class="text-indigo-700">🏢 Tập thể đơn vị</span>'}</span>
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
                            <div class="flex items-center space-x-1.5 text-slate-600 truncate max-w-[130px]" title="${t.assignee ? t.assignee.full_name : 'Tập thể đơn vị'}">
                                <div class="w-5 h-5 rounded-full ${t.assignee ? 'bg-blue-800' : 'bg-indigo-700'} text-white font-bold text-[9px] flex items-center justify-center shrink-0">
                                    ${t.assignee ? t.assignee.full_name.charAt(0) : '<i class="fa-solid fa-users text-[8px]"></i>'}
                                </div>
                                <span class="truncate text-[10px] ${t.assignee ? '' : 'font-semibold text-indigo-700'}">${t.assignee ? t.assignee.full_name : 'Tập thể đơn vị'}</span>
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
        try {
            document.getElementById('formCreateTask')?.reset();
            this.createWorkflowSteps = [];
            this.currentSelectedWorkflowName = null;
            this.suggestedWorkflow = null;
            this.selectedCollaborators = [];
            this.renderSelectedCollaborators();
            const colInput = document.getElementById('taskCollaboratorInput');
            if (colInput) colInput.value = '';
            document.getElementById('taskWorkflowSuggestionBox')?.classList.add('hidden');
            document.getElementById('deadlineSafetyWarning')?.classList.add('hidden');
            this.switchTaskArchetype('workflow');
            this.populateSelectOptions();
            
            // Nhận diện vai trò từ user hiện tại hoặc mặc định BGH
            const user = Common.currentUser || API.getUser();
            let initialRole = 'BGH';
            if (user?.role === 'STAFF') initialRole = 'STAFF';
            else if (user?.role === 'DEPT_HEAD') initialRole = 'DEPT_HEAD';
            this.setDispatchRole(initialRole);

            // Khởi tạo mức ưu tiên & thời hạn mặc định (7 ngày)
            const priSelect = document.getElementById('taskPriority');
            if (priSelect) priSelect.value = 'TRUNG_BINH';
            this.handlePriorityChange('TRUNG_BINH');

            // Tự động nạp mẫu đầu tiên nếu có
            if (this.workflows && this.workflows.length > 0) {
                const defaultWf = this.workflows.find(w => w.code === 'QT_CHUNG_02') || this.workflows[0];
                const select = document.getElementById('taskWorkflowSelect');
                if (select) select.value = defaultWf.id;
                this.handleSelectWorkflowTemplate(defaultWf.id, true);
            } else {
                this.addNewWorkflowStep();
            }
        } catch (err) {
            console.error('Lỗi khởi tạo form Giao Nhiệm Vụ:', err);
        } finally {
            document.getElementById('modalCreateTask')?.classList.remove('hidden');
        }
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
            <div class="flex items-center space-x-2 bg-white p-2 rounded-lg border border-slate-200 shadow-2xs hover:border-blue-300 transition">
                <span class="w-6 h-6 rounded-full bg-blue-100 text-blue-900 font-mono font-black text-xs flex items-center justify-center shrink-0">
                    ${step.id}
                </span>
                <input type="text" value="${step.title}" 
                    oninput="TasksPage.updateCreateStepTitle(${idx}, this.value)"
                    placeholder="Nhập tên bước thực hiện..."
                    class="flex-1 px-2.5 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:border-blue-800 font-medium text-slate-800">
                <button type="button" onclick="TasksPage.removeWorkflowStep(${idx})" class="text-slate-400 hover:text-red-600 p-1 transition" title="Xóa bước này">
                    <i class="fa-solid fa-trash-can text-xs"></i>
                </button>
            </div>
        `).join('');
    },

    async handleCreateTask(e) {
        if (e && e.preventDefault) e.preventDefault();
        const user = Common.currentUser || API.getUser() || {};
        const title = document.getElementById('taskTitle')?.value?.trim();
        const rawDescription = document.getElementById('taskDescription')?.value?.trim() || '';
        const requester = document.getElementById('taskRequester')?.value?.trim();
        
        // 1. Validation Shield
        if (!title) {
            Common.showToast('Vui lòng nhập tên / tiêu đề nhiệm vụ!', 'error');
            const titleInput = document.getElementById('taskTitle');
            if (titleInput) {
                titleInput.focus();
                titleInput.classList.add('border-red-500', 'ring-2', 'ring-red-200');
                setTimeout(() => titleInput.classList.remove('border-red-500', 'ring-2', 'ring-red-200'), 3000);
            }
            return;
        }

        let leading_dept_id = document.getElementById('taskLeadingDept')?.value ? parseInt(document.getElementById('taskLeadingDept').value) : null;
        let assisting_dept_id = document.getElementById('taskAssistingDept')?.value ? parseInt(document.getElementById('taskAssistingDept').value) : null;
        let assignee_id = document.getElementById('taskAssignee')?.value ? parseInt(document.getElementById('taskAssignee').value) : null;
        
        const priority = document.getElementById('taskPriority')?.value || 'TRUNG_BINH';
        const due_date = document.getElementById('taskDueDate')?.value || null;

        if (this.currentDispatchRole === 'BGH' && (!leading_dept_id || isNaN(leading_dept_id))) {
            Common.showToast('Vui lòng chọn Đơn vị chủ trì thực hiện nhiệm vụ!', 'error');
            const deptSelect = document.getElementById('taskLeadingDept');
            if (deptSelect) {
                deptSelect.focus();
                deptSelect.classList.add('border-red-500', 'ring-2', 'ring-red-200');
                setTimeout(() => deptSelect.classList.remove('border-red-500', 'ring-2', 'ring-red-200'), 3000);
            }
            return;
        }

        let description = rawDescription;
        let successMessage = 'Đã giao nhiệm vụ thành công!';
        let visibility = 'ORGANIZATIONAL';
        let taskType = 'STRATEGIC';

        if (this.currentDispatchRole === 'STAFF') {
            leading_dept_id = user.department_id || (this.departments.length > 0 ? this.departments[0].id : 1);
            assisting_dept_id = null;

            if (this.staffTaskMode === 'todo') {
                assignee_id = user.id || null;
                if (requester) {
                    description = `[NGƯỜI YÊU CẦU: ${requester}]\n` + description;
                } else {
                    description = `[VIỆC CÁ NHÂN TỰ TẠO - TO DO]\n` + description;
                }
                successMessage = 'Đã lưu việc cá nhân thành công!';
                visibility = 'PRIVATE';
                taskType = 'SELF';
            } else {
                assignee_id = null; // Đề xuất cho trưởng phòng duyệt
                description = `[ĐỀ XUẤT NHIỆM VỤ TỪ CÁN BỘ: ${user.full_name || 'Cá nhân'}]\n` + description;
                successMessage = 'Đã gửi đề xuất công việc lên Trưởng phòng phê duyệt!';
                visibility = 'DEPARTMENT';
                taskType = 'PROPOSAL';
            }
        } else if (this.currentDispatchRole === 'DEPT_HEAD') {
            leading_dept_id = user.department_id || leading_dept_id;
            successMessage = assignee_id ? 'Đã phân công nhiệm vụ cho cán bộ trong đơn vị!' : 'Đã phân công nhiệm vụ nội bộ!';
            visibility = 'DEPARTMENT';
            taskType = 'ROUTINE';
        } else {
            successMessage = assignee_id ? 'Đã giao nhiệm vụ cho cán bộ!' : 'Đã giao nhiệm vụ cho tập thể đơn vị!';
            visibility = 'ORGANIZATIONAL';
            taskType = 'STRATEGIC';
        }

        const collaborator_ids = (this.selectedCollaborators || []).map(c => c.id);
        if (this.selectedCollaborators && this.selectedCollaborators.length > 0) {
            const colNames = this.selectedCollaborators.map(c => c.full_name + (c.dept_code ? ` (${c.dept_code})` : '')).join(', ');
            description += `\n[ĐỒNG NGHIỆP PHỐI HỢP: ${colNames}]`;
        }

        const payload = {
            title,
            description,
            type: taskType,
            visibility,
            progress_rule: 'AVERAGE',
            leading_dept_id,
            assisting_dept_id,
            assignee_id,
            collaborator_ids,
            priority,
            workflow_name: this.currentSelectedWorkflowName || undefined,
            due_date: due_date ? new Date(due_date).toISOString() : null,
            workflow_steps: this.createWorkflowSteps
        };

        try {
            await API.createTask(payload);
            Common.showToast(successMessage, 'success');
            this.closeCreateTaskModal();
            this.loadTasks();
        } catch (err) {
            Common.showToast(err.message || 'Lỗi khi tạo nhiệm vụ', 'error');
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
    // PHÂN HỆ XEM CHI TIẾT & STEPPER TIMELINE (BGH TRACEABILITY)
    // ----------------------------------------------------
    async openTaskDetail(taskId) {
        try {
            const task = await API.getTaskDetail(taskId);
            this.currentDetailTask = task;
            document.getElementById('detailTaskIdInput').value = task.id;
            document.getElementById('detailTaskTitle').innerText = task.title;
            document.getElementById('detailTaskDesc').innerText = task.description || 'Không có mô tả chi tiết.';
            document.getElementById('detailStatus').innerText = task.status;
            document.getElementById('detailPriority').innerText = task.priority;
            document.getElementById('detailProgress').innerText = `${task.progress_percent}%`;
            document.getElementById('detailLeadingDept').innerText = task.leading_department ? `${task.leading_department.name} (${task.leading_department.code})` : '-';
            document.getElementById('detailAssistingDept').innerText = task.assisting_department ? `${task.assisting_department.name} (${task.assisting_department.code})` : '-';
            document.getElementById('detailAssignee').innerText = task.assignee ? `${task.assignee.full_name} (${task.assignee.position || task.assignee.role})` : '🏢 [Tập thể đơn vị tự điều phối]';
            document.getElementById('detailDueDate').innerText = task.due_date ? Common.formatDateTime(task.due_date) : 'Không đặt hạn';

            // RACI Hierarchy Tree
            this.renderDetailRaciTree(task);

            this.renderDetailWorkflowTimeline(task.workflow_steps || [], task.workflow_name);
            this.renderComments(task.comments || []);
            document.getElementById('modalTaskDetail').classList.remove('hidden');
        } catch (err) {
            console.error('Lỗi mở chi tiết task:', err);
            Common.showToast('Lỗi nạp chi tiết công việc', 'error');
        }
    },

    renderDetailRaciTree(task) {
        const container = document.getElementById('detailRaciTreeContainer');
        if (!container) return;

        const deptCode = task.leading_department ? task.leading_department.code : 'HueIC';
        const steps = task.workflow_steps || [];
        const assignedStaffs = [...new Set(steps.map(s => s.assignee_name).filter(Boolean))];

        const staffPills = assignedStaffs.length > 0
            ? assignedStaffs.map(name => `<span class="px-2 py-0.5 bg-blue-50 text-blue-900 border border-blue-200 rounded font-semibold text-[10.5px]">👤 ${name}</span>`).join('')
            : (task.assignee ? `<span class="px-2 py-0.5 bg-blue-50 text-blue-900 border border-blue-200 rounded font-semibold text-[10.5px]">👤 ${task.assignee.full_name}</span>` : '<span class="text-slate-400 italic text-[10.5px]">Chưa phân công tiếp cho nhân viên</span>');

        container.innerHTML = `
            <div class="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
                <div class="flex items-center justify-between">
                    <span class="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center space-x-1.5">
                        <i class="fa-solid fa-sitemap text-blue-800"></i>
                        <span>Cây Phân Cấp Trách Nhiệm (RACI Hierarchy & Delegation Chain)</span>
                    </span>
                    <button type="button" onclick="TasksPage.openDelegateTaskModal(${task.id})" 
                        class="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-800 hover:text-white text-indigo-800 rounded-lg text-[11px] font-bold border border-indigo-200 transition flex items-center space-x-1">
                        <i class="fa-solid fa-users text-[10px]"></i>
                        <span>Phân công tiếp</span>
                    </button>
                </div>

                <div class="flex flex-wrap items-center gap-2 text-xs">
                    <!-- Level 1: Người giao việc (BGH / Lãnh đạo) -->
                    <div class="flex items-center space-x-1.5 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 shadow-2xs">
                        <span class="w-5 h-5 rounded-full bg-slate-800 text-white font-bold text-[9px] flex items-center justify-center">🏛️</span>
                        <div>
                            <div class="text-[9.5px] text-slate-400 font-bold uppercase">Người giao việc</div>
                            <div class="font-bold text-slate-900">Ban Giám Hiệu</div>
                        </div>
                    </div>

                    <i class="fa-solid fa-arrow-right text-slate-400 text-xs"></i>

                    <!-- Level 2: Trưởng đơn vị (Accountable) -->
                    <div class="flex items-center space-x-1.5 bg-white px-2.5 py-1.5 rounded-lg border border-amber-300 bg-amber-50/40 shadow-2xs">
                        <span class="w-5 h-5 rounded-full bg-amber-600 text-white font-bold text-[9px] flex items-center justify-center">🏢</span>
                        <div>
                            <div class="text-[9.5px] text-amber-700 font-bold uppercase">Chịu trách nhiệm (Accountable)</div>
                            <div class="font-bold text-slate-900">[${deptCode}] Trưởng đơn vị</div>
                        </div>
                    </div>

                    <i class="fa-solid fa-arrow-right text-slate-400 text-xs"></i>

                    <!-- Level 3: Nhân sự thực hiện từng bước (Responsible) -->
                    <div class="flex-1 min-w-[200px] flex items-center space-x-1.5 bg-white px-2.5 py-1.5 rounded-lg border border-blue-200 shadow-2xs">
                        <div>
                            <div class="text-[9.5px] text-blue-700 font-bold uppercase mb-1">Cán bộ thực thi (Responsible)</div>
                            <div class="flex flex-wrap gap-1.5">
                                ${staffPills}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
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
            <div class="flex items-start space-x-3 p-3 rounded-xl border ${s.is_completed ? 'bg-green-50/50 border-green-200' : (idx === done ? 'bg-blue-50 border-blue-200 ring-2 ring-blue-400/20' : 'bg-white border-slate-200')}">
                <div class="w-7 h-7 rounded-full flex items-center justify-center shrink-0 font-mono font-black text-xs ${s.is_completed ? 'bg-green-600 text-white' : (idx === done ? 'bg-blue-800 text-white animate-pulse' : 'bg-slate-200 text-slate-600')}">
                    ${s.is_completed ? '<i class="fa-solid fa-check"></i>' : s.id}
                </div>
                <div class="flex-1 min-w-0">
                    <div class="flex flex-wrap items-center justify-between gap-1">
                        <span class="font-bold text-xs ${s.is_completed ? 'text-green-900' : (idx === done ? 'text-blue-900' : 'text-slate-700')}">
                            Bước ${s.id}: ${s.title}
                        </span>
                        <div class="flex items-center space-x-2">
                            ${s.deadline ? `<span class="text-[10px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded"><i class="fa-regular fa-clock mr-1"></i>Hạn: ${s.deadline.split('T')[0]}</span>` : ''}
                            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${s.is_completed ? 'bg-green-100 text-green-800' : (idx === done ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-500')}">
                                ${s.is_completed ? 'Đã hoàn thành' : (idx === done ? 'Đang thực hiện' : 'Chưa thực hiện')}
                            </span>
                        </div>
                    </div>

                    <!-- Step Assignee Delegation info -->
                    <div class="mt-1 flex items-center space-x-2 text-[11px] text-slate-600">
                        <span class="font-semibold text-blue-900 flex items-center space-x-1">
                            <i class="fa-solid fa-user-tag text-blue-700"></i>
                            <span>Thực hiện: ${s.assignee_name || (s.assignee ? s.assignee.full_name : 'Trưởng đơn vị tự điều phối')}</span>
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

    // ----------------------------------------------------
    // PHÂN HỆ PHÂN CÔNG TIẾP TRONG ĐƠN VỊ (DELEGATION ENGINE)
    // ----------------------------------------------------
    currentDelegatingTask: null,
    delegationMode: 'delegate', // 'self' | 'delegate'
    delegationSteps: [],

    async openDelegateTaskModal(taskId) {
        let task = this.tasks.find(t => t.id === taskId);
        if (!task) {
            try {
                task = await API.getTaskDetail(taskId);
            } catch (e) {
                Common.showToast('Không tìm thấy nhiệm vụ', 'error');
                return;
            }
        }
        this.currentDelegatingTask = task;
        this.delegationMode = 'delegate';

        // Context header
        document.getElementById('delegateTaskTitle').innerText = task.title;
        document.getElementById('delegateTaskDept').innerText = task.leading_department ? `[${task.leading_department.code}] ${task.leading_department.name}` : 'HueIC';
        document.getElementById('delegateTaskDueDate').innerText = task.due_date ? task.due_date.split('T')[0] : 'Không có';

        // Steps clone or fallback
        if (task.workflow_steps && task.workflow_steps.length > 0) {
            this.delegationSteps = JSON.parse(JSON.stringify(task.workflow_steps));
        } else {
            this.delegationSteps = [
                { id: 1, title: 'Lập kế hoạch mục tiêu & Khảo sát hiện trạng (Plan)', assignee_id: null, assignee_name: '', deadline: task.due_date ? task.due_date.split('T')[0] : '' },
                { id: 2, title: 'Triển khai thực hiện nhiệm vụ (Do)', assignee_id: null, assignee_name: '', deadline: task.due_date ? task.due_date.split('T')[0] : '' },
                { id: 3, title: 'Kiểm tra, giám sát & Đánh giá kết quả (Check)', assignee_id: null, assignee_name: '', deadline: task.due_date ? task.due_date.split('T')[0] : '' },
                { id: 4, title: 'Nghiệm thu, chuẩn hóa & Báo cáo BGH (Act)', assignee_id: null, assignee_name: '', deadline: task.due_date ? task.due_date.split('T')[0] : '' }
            ];
        }

        this.switchDelegationMode('delegate');
        this.renderDelegationSteps();
        document.getElementById('modalDelegateTask').classList.remove('hidden');
    },

    closeDelegateTaskModal() {
        document.getElementById('modalDelegateTask').classList.add('hidden');
    },

    switchDelegationMode(mode) {
        this.delegationMode = mode;
        const btnSelf = document.getElementById('delegateBtnSelf');
        const btnDelegate = document.getElementById('delegateBtnDelegate');
        const stepsContainer = document.getElementById('delegateStepsSection');

        if (mode === 'self') {
            btnSelf.className = 'flex-1 p-3 rounded-xl border-2 border-blue-800 bg-blue-50/70 text-blue-900 font-bold text-left transition';
            btnDelegate.className = 'flex-1 p-3 rounded-xl border border-slate-200 bg-white text-slate-600 font-semibold text-left hover:bg-slate-50 transition';
            if (stepsContainer) stepsContainer.classList.add('hidden');
        } else {
            btnDelegate.className = 'flex-1 p-3 rounded-xl border-2 border-blue-800 bg-blue-50/70 text-blue-900 font-bold text-left transition';
            btnSelf.className = 'flex-1 p-3 rounded-xl border border-slate-200 bg-white text-slate-600 font-semibold text-left hover:bg-slate-50 transition';
            if (stepsContainer) stepsContainer.classList.remove('hidden');
        }
    },

    renderDelegationSteps() {
        const container = document.getElementById('delegationStepsContainer');
        const warningBox = document.getElementById('delegationUnassignedWarning');
        if (!container) return;

        const deptId = this.currentDelegatingTask.leading_department_id;
        const parentDeadline = this.currentDelegatingTask.due_date ? this.currentDelegatingTask.due_date.split('T')[0] : '';

        // Staff list in this department with workload
        let unitUsers = this.users.filter(u => u.department_id === deptId || !u.department_id);
        const usersWithWorkload = unitUsers.map(u => {
            const wl = this.calculateUserWorkload(u.id);
            return { ...u, workload: wl };
        }).sort((a, b) => a.workload.active - b.workload.active);

        let unassignedCount = 0;

        container.innerHTML = this.delegationSteps.map((step, idx) => {
            if (!step.assignee_id && !step.assignee_name) unassignedCount++;

            const isTight = (step.deadline && step.deadline === parentDeadline);

            return `
                <div class="p-3 bg-white rounded-xl border border-slate-200 space-y-2.5 shadow-2xs">
                    <div class="flex items-center space-x-2">
                        <span class="w-6 h-6 rounded-full bg-blue-100 text-blue-900 font-mono font-black text-xs flex items-center justify-center shrink-0">
                            ${idx + 1}
                        </span>
                        <input type="text" value="${step.title}" 
                            oninput="TasksPage.updateDelegationStepTitle(${idx}, this.value)"
                            placeholder="Tên bước thực hiện..."
                            class="flex-1 px-2.5 py-1 text-xs font-bold text-slate-900 border border-slate-200 rounded focus:outline-none focus:border-blue-800">
                        <button type="button" onclick="TasksPage.removeDelegationStep(${idx})" class="text-slate-400 hover:text-red-600 p-1 transition" title="Xóa bước">
                            <i class="fa-solid fa-trash-can text-xs"></i>
                        </button>
                    </div>

                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-8">
                        <div>
                            <select onchange="TasksPage.updateDelegationStepAssignee(${idx}, this.value, this.options[this.selectedIndex].text)"
                                class="w-full px-2.5 py-1.5 text-xs font-semibold border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-blue-800 text-slate-800">
                                <option value="">-- Chọn cán bộ thực hiện --</option>
                                ${usersWithWorkload.map(u => {
                                    const wl = u.workload;
                                    let tag = `🟢 [Rảnh: 0 việc]`;
                                    if (wl.overdue > 0 || wl.active >= 4) {
                                        tag = `🔴 [⚠️ Quá tải: ${wl.active} việc, ${wl.overdue} trễ]`;
                                    } else if (wl.active > 0) {
                                        tag = `🟡 [Đang làm: ${wl.active} việc]`;
                                    }
                                    const isSelected = (step.assignee_id === u.id || step.assignee_name === u.full_name);
                                    return `<option value="${u.id}" ${isSelected ? 'selected' : ''}>${u.full_name} (${u.role || 'Cán bộ'}) — ${tag}</option>`;
                                }).join('')}
                            </select>
                        </div>
                        <div>
                            <input type="date" value="${step.deadline ? step.deadline.split('T')[0] : ''}" 
                                max="${parentDeadline}"
                                onchange="TasksPage.updateDelegationStepDeadline(${idx}, this.value)"
                                class="w-full px-2.5 py-1.5 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:border-blue-800 text-slate-800">
                            ${isTight ? `<div class="text-[10px] text-amber-700 font-semibold mt-0.5 flex items-center"><i class="fa-solid fa-triangle-exclamation mr-1"></i>Trùng hạn gốc BGH — nên lùi 1-2 ngày để Trưởng phòng kiểm tra</div>` : ''}
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        if (warningBox) {
            if (unassignedCount > 0) {
                warningBox.innerHTML = `⚠️ <b>Lưu ý:</b> Còn <b>${unassignedCount}</b> bước chưa gán cán bộ thực hiện cụ thể.`;
                warningBox.classList.remove('hidden');
            } else {
                warningBox.classList.add('hidden');
            }
        }
    },

    updateDelegationStepTitle(idx, title) {
        if (this.delegationSteps[idx]) this.delegationSteps[idx].title = title;
    },

    updateDelegationStepAssignee(idx, userId, userText) {
        if (this.delegationSteps[idx]) {
            this.delegationSteps[idx].assignee_id = userId ? parseInt(userId) : null;
            // Strip workload suffix for clean name
            this.delegationSteps[idx].assignee_name = userText ? userText.split('(')[0].trim() : '';
        }
        this.renderDelegationSteps();
    },

    updateDelegationStepDeadline(idx, deadline) {
        if (this.delegationSteps[idx]) {
            this.delegationSteps[idx].deadline = deadline;
        }
        this.renderDelegationSteps();
    },

    addDelegationStep() {
        const nextId = this.delegationSteps.length + 1;
        const parentDeadline = this.currentDelegatingTask.due_date ? this.currentDelegatingTask.due_date.split('T')[0] : '';
        this.delegationSteps.push({
            id: nextId,
            title: `Bước ${nextId}: Nội dung công việc`,
            assignee_id: null,
            assignee_name: '',
            deadline: parentDeadline,
            is_completed: false,
            note: ''
        });
        this.renderDelegationSteps();
    },

    removeDelegationStep(idx) {
        this.delegationSteps.splice(idx, 1);
        this.delegationSteps.forEach((s, i) => s.id = i + 1);
        this.renderDelegationSteps();
    },

    async handleSaveDelegation(e) {
        e.preventDefault();
        if (!this.currentDelegatingTask) return;

        const taskId = this.currentDelegatingTask.id;

        try {
            if (this.delegationMode === 'self') {
                await API.updateTaskProgress(taskId, {
                    comment: `[Điều phối nội bộ] Trưởng đơn vị xác nhận tự trực tiếp thực hiện toàn bộ nhiệm vụ.`
                });
                Common.showToast('Đã xác nhận tự thực hiện nhiệm vụ!', 'success');
            } else {
                await API.updateTaskProgress(taskId, {
                    workflow_steps: this.delegationSteps,
                    comment: `[Điều phối nội bộ] Trưởng đơn vị đã phân công chi tiết ${this.delegationSteps.length} bước cho cán bộ thực thi.`
                });
                Common.showToast('Đã lưu phân công nhiệm vụ cho nhân viên thành công!', 'success');
            }
            this.closeDelegateTaskModal();
            this.loadTasks();
            if (this.currentDetailTask && this.currentDetailTask.id === taskId) {
                this.openTaskDetail(taskId);
            }
        } catch (err) {
            Common.showToast(err.message || 'Lỗi khi lưu phân công', 'error');
        }
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

