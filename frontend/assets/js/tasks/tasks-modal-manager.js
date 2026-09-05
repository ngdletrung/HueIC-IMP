/**
 * HueIC IMP - Tasks Module: Modal & Workflow Dialog Manager
 */
window.TasksModalManager = {
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
                    pill.className = 'px-2.5 py-1 rounded-md bg-blue-800 text-white font-bold shadow-xs transition';
                } else {
                    pill.className = 'px-2.5 py-1 rounded-md text-slate-600 hover:text-slate-900 font-semibold transition';
                }
            }
        });

        // 2. DOM Elements
        const titleEl = document.getElementById('modalCreateTaskTitle');
        const subTitleEl = document.getElementById('modalCreateTaskSubTitle');
        const iconWrapper = document.getElementById('modalCreateTaskIcon');
        const staffToggle = document.getElementById('staffModeToggleWrapper');
        const deptToggle = document.getElementById('deptModeToggleWrapper');
        const deptRow = document.getElementById('deptRowWrapper');
        const leadingDeptSelect = document.getElementById('taskLeadingDept');
        const assistingWrapper = document.getElementById('assistingDeptWrapper');
        const assigneeWrapper = document.getElementById('assigneeWrapper');
        const descColWrapper = document.getElementById('descColWrapper');
        const requesterWrapper = document.getElementById('requesterWrapper');
        const submitBtn = document.getElementById('btnSubmitTask');
        const submitBtnText = document.getElementById('btnSubmitTaskText');

        // Lấy đơn vị của người dùng hiện tại (nếu có)
        const currentUser = Common.currentUser || API.getUser() || {};
        const userDeptId = currentUser.department_id || (this.departments.length > 0 ? this.departments[0].id : null);

        if (role === 'BGH') {
            // VAI TRÒ 1: BAN GIÁM HIỆU (Giao việc & Chỉ đạo cấp trường)
            if (titleEl) titleEl.innerText = 'Giao Nhiệm Vụ & Chỉ Đạo Cấp Trường';
            if (subTitleEl) subTitleEl.innerText = 'Phân công đơn vị chủ trì, chỉ định đầu mối và gắn quy trình thực thi toàn trường';
            if (iconWrapper) {
                iconWrapper.className = 'w-7 h-7 rounded-lg bg-blue-800 text-white flex items-center justify-center text-xs shadow-xs';
                iconWrapper.innerHTML = '<i class="fa-solid fa-building-columns"></i>';
            }
            if (staffToggle) staffToggle.classList.add('hidden');
            if (deptToggle) deptToggle.classList.add('hidden');
            if (deptRow) deptRow.classList.remove('hidden');
            if (leadingDeptSelect) {
                leadingDeptSelect.disabled = false;
                leadingDeptSelect.className = 'w-full px-3 py-2 border border-slate-300 rounded-xl bg-slate-50/50 hover:bg-white focus:bg-white focus:outline-none focus:border-blue-800 font-semibold text-slate-900 transition';
            }
            if (assistingWrapper) assistingWrapper.classList.remove('hidden');
            if (assigneeWrapper) assigneeWrapper.classList.remove('hidden');
            if (submitBtnText) submitBtnText.innerText = 'Giao Nhiệm Vụ (BGH)';
            if (submitBtn) {
                submitBtn.className = 'px-5 py-2 bg-blue-800 hover:bg-blue-900 text-white rounded-xl font-bold transition flex items-center space-x-1.5 shadow-xs';
            }

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
            if (staffToggle) staffToggle.classList.add('hidden');
            if (deptToggle) deptToggle.classList.remove('hidden');
            if (deptRow) deptRow.classList.remove('hidden');
            if (leadingDeptSelect) {
                if (userDeptId) leadingDeptSelect.value = userDeptId;
                leadingDeptSelect.disabled = true; // Khóa cứng đơn vị
                leadingDeptSelect.className = 'w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-100 font-bold text-blue-900 cursor-not-allowed';
            }
            if (assistingWrapper) assistingWrapper.classList.remove('hidden');
            if (submitBtn) {
                submitBtn.className = 'px-5 py-2 bg-blue-800 hover:bg-blue-900 text-white rounded-xl font-bold transition flex items-center space-x-1.5 shadow-xs';
            }

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
            this.setDeptHeadTaskMode('internal');

        } else if (role === 'STAFF') {
            // VAI TRÒ 3: CÁ NHÂN / CÁN BỘ / GIẢNG VIÊN (Thực thi & Đề xuất)
            if (staffToggle) staffToggle.classList.remove('hidden');
            if (deptToggle) deptToggle.classList.add('hidden');
            if (deptRow) deptRow.classList.add('hidden'); // Ẩn chọn đơn vị
            if (assigneeWrapper) assigneeWrapper.classList.add('hidden'); // Ẩn chọn cán bộ (mặc định là chính mình)

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
                iconWrapper.className = 'w-7 h-7 rounded-lg bg-blue-800 text-white flex items-center justify-center text-xs shadow-xs';
                iconWrapper.innerHTML = '<i class="fa-solid fa-user-pen"></i>';
            }
            if (btnTodo) {
                btnTodo.className = 'flex-1 p-2.5 rounded-xl border-2 border-blue-900 bg-blue-800 text-white font-bold text-left transition text-xs shadow-sm ring-2 ring-blue-300/60';
                btnTodo.innerHTML = `
                    <span class="flex items-center space-x-1.5 font-bold text-white">
                        <i class="fa-solid fa-pen-to-square text-white text-sm"></i>
                        <span>Việc Cá Nhân (My To-Do)</span>
                    </span>
                    <div class="text-[10px] font-medium text-blue-100 mt-0.5">Tự lập danh sách việc cần làm cho chính mình</div>
                `;
            }
            if (btnProposal) {
                btnProposal.className = 'flex-1 p-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-semibold text-left hover:bg-slate-50 transition text-xs';
                btnProposal.innerHTML = `
                    <span class="flex items-center space-x-1.5 font-bold text-slate-800">
                        <i class="fa-solid fa-lightbulb text-amber-500 text-sm"></i>
                        <span>Đề Xuất Cho Trưởng Phòng</span>
                    </span>
                    <div class="text-[10px] font-normal text-slate-500 mt-0.5">Gửi đề xuất nhiệm vụ lên Trưởng đơn vị phê duyệt</div>
                `;
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
                iconWrapper.className = 'w-7 h-7 rounded-lg bg-amber-500 text-white flex items-center justify-center text-xs shadow-xs';
                iconWrapper.innerHTML = '<i class="fa-solid fa-lightbulb text-white text-sm"></i>';
            }
            if (btnProposal) {
                btnProposal.className = 'flex-1 p-2.5 rounded-xl border-2 border-amber-600 bg-amber-500 text-white font-bold text-left transition text-xs shadow-sm ring-2 ring-amber-200/60';
                btnProposal.innerHTML = `
                    <span class="flex items-center space-x-1.5 font-bold text-white">
                        <i class="fa-solid fa-lightbulb text-white text-sm"></i>
                        <span>Đề Xuất Cho Trưởng Phòng</span>
                    </span>
                    <div class="text-[10px] font-medium text-amber-100 mt-0.5">Gửi đề xuất nhiệm vụ lên Trưởng đơn vị phê duyệt</div>
                `;
            }
            if (btnTodo) {
                btnTodo.className = 'flex-1 p-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-semibold text-left hover:bg-slate-50 transition text-xs';
                btnTodo.innerHTML = `
                    <span class="flex items-center space-x-1.5 font-bold text-slate-800">
                        <i class="fa-solid fa-pen-to-square text-blue-800 text-sm"></i>
                        <span>Việc Cá Nhân (My To-Do)</span>
                    </span>
                    <div class="text-[10px] font-normal text-slate-500 mt-0.5">Tự lập danh sách việc cần làm cho chính mình</div>
                `;
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

    deptHeadTaskMode: 'internal', // 'internal' | 'proposal'

    setDeptHeadTaskMode(mode) {
        this.deptHeadTaskMode = mode;
        const btnInternal = document.getElementById('deptModeBtnInternal');
        const btnProposal = document.getElementById('deptModeBtnProposal');
        const submitBtnText = document.getElementById('btnSubmitTaskText');
        const assigneeWrapper = document.getElementById('assigneeWrapper');
        const titleEl = document.getElementById('modalCreateTaskTitle');
        const subTitleEl = document.getElementById('modalCreateTaskSubTitle');
        const iconWrapper = document.getElementById('modalCreateTaskIcon');

        const currentUser = Common.currentUser || API.getUser() || {};
        const userDeptId = currentUser.department_id || (this.departments.length > 0 ? this.departments[0].id : null);
        const deptObj = this.departments.find(d => d.id === userDeptId) || this.departments[0];
        const deptTag = deptObj ? `[${deptObj.code}] ${deptObj.name}` : 'Đơn vị';

        if (mode === 'internal') {
            if (titleEl) titleEl.innerText = `Phân Công Nhiệm Vụ Nội Bộ (${deptObj ? deptObj.code : ''})`;
            if (subTitleEl) subTitleEl.innerText = `Điều phối công việc cho cán bộ, giảng viên trong ${deptTag}`;
            if (iconWrapper) {
                iconWrapper.className = 'w-7 h-7 rounded-lg bg-blue-800 text-white flex items-center justify-center text-xs shadow-xs';
                iconWrapper.innerHTML = '<i class="fa-solid fa-users-gear"></i>';
            }
            if (btnInternal) {
                btnInternal.className = 'flex-1 p-2.5 rounded-xl border-2 border-blue-900 bg-blue-800 text-white font-bold text-left transition text-xs shadow-sm ring-2 ring-blue-300/60';
                btnInternal.innerHTML = `
                    <span class="flex items-center space-x-1.5 font-bold text-white">
                        <i class="fa-solid fa-sitemap text-white text-sm"></i>
                        <span>Việc Nội Bộ Đơn Vị</span>
                    </span>
                    <div class="text-[10px] font-medium text-blue-100 mt-0.5">Phân công cán bộ trong khoa/phòng hoặc tự phụ trách</div>
                `;
            }
            if (btnProposal) {
                btnProposal.className = 'flex-1 p-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-semibold text-left hover:bg-slate-50 transition text-xs';
                btnProposal.innerHTML = `
                    <span class="flex items-center space-x-1.5 font-bold text-slate-800">
                        <i class="fa-solid fa-building-columns text-amber-500 text-sm"></i>
                        <span>Đề Xuất Lên Ban Giám Hiệu</span>
                    </span>
                    <div class="text-[10px] font-normal text-slate-500 mt-0.5">Trình kế hoạch, chủ trương hoặc xin nguồn lực cấp trường</div>
                `;
            }
            if (assigneeWrapper) assigneeWrapper.classList.remove('hidden');
            if (submitBtnText) submitBtnText.innerText = 'Phân Công Nội Bộ';
        } else {
            // PROPOSAL TO BGH
            if (titleEl) titleEl.innerText = `Đề Xuất Lên Ban Giám Hiệu (${deptObj ? deptObj.code : ''})`;
            if (subTitleEl) subTitleEl.innerText = `Trình phê duyệt chủ trương, đề án hoặc phân công phối hợp cấp trường`;
            if (iconWrapper) {
                iconWrapper.className = 'w-7 h-7 rounded-lg bg-amber-500 text-white flex items-center justify-center text-xs shadow-xs';
                iconWrapper.innerHTML = '<i class="fa-solid fa-building-columns text-white"></i>';
            }
            if (btnProposal) {
                btnProposal.className = 'flex-1 p-2.5 rounded-xl border-2 border-amber-600 bg-amber-500 text-white font-bold text-left transition text-xs shadow-sm ring-2 ring-amber-200/60';
                btnProposal.innerHTML = `
                    <span class="flex items-center space-x-1.5 font-bold text-white">
                        <i class="fa-solid fa-building-columns text-white text-sm"></i>
                        <span>Đề Xuất Lên Ban Giám Hiệu</span>
                    </span>
                    <div class="text-[10px] font-medium text-amber-100 mt-0.5">Trình kế hoạch, chủ trương hoặc xin nguồn lực cấp trường</div>
                `;
            }
            if (btnInternal) {
                btnInternal.className = 'flex-1 p-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-semibold text-left hover:bg-slate-50 transition text-xs';
                btnInternal.innerHTML = `
                    <span class="flex items-center space-x-1.5 font-bold text-slate-800">
                        <i class="fa-solid fa-sitemap text-blue-800 text-sm"></i>
                        <span>Việc Nội Bộ Đơn Vị</span>
                    </span>
                    <div class="text-[10px] font-normal text-slate-500 mt-0.5">Phân công cán bộ trong khoa/phòng hoặc tự phụ trách</div>
                `;
            }
            if (assigneeWrapper) assigneeWrapper.classList.add('hidden');
            if (submitBtnText) submitBtnText.innerText = 'Gửi Đề Xuất Cho BGH';
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

    toggleNoDueDate(isChecked) {
        const dueDateInput = document.getElementById('taskDueDate');
        const durationInput = document.getElementById('taskDurationDays');
        const warningBox = document.getElementById('deadlineSafetyWarning');

        if (isChecked) {
            if (dueDateInput) {
                dueDateInput.value = '';
                dueDateInput.disabled = true;
                dueDateInput.classList.add('opacity-40', 'bg-slate-100', 'cursor-not-allowed');
            }
            if (durationInput) {
                durationInput.value = '';
                durationInput.disabled = true;
                durationInput.classList.add('opacity-40', 'bg-slate-100', 'cursor-not-allowed');
            }
            if (warningBox) warningBox.classList.add('hidden');
        } else {
            if (dueDateInput) {
                dueDateInput.disabled = false;
                dueDateInput.classList.remove('opacity-40', 'bg-slate-100', 'cursor-not-allowed');
            }
            if (durationInput) {
                durationInput.disabled = false;
                durationInput.classList.remove('opacity-40', 'bg-slate-100', 'cursor-not-allowed');
            }
            this.setTaskDurationAndDueDate(7, true);
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

        let optionsHtml = '<option value="">-- Không dùng quy trình mẫu (Công việc đơn lẻ) --</option>';
        
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
        if (!wfVal) {
            this.clearWorkflowSteps();
            return;
        }
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

    normalizeStatusSlug(slug) {
        if (!slug) return '';
        const clean = String(slug).toLowerCase().replace(/_/g, '-').trim();
        const map = {
            'dang-thuc-hien': 'DANG_THUC_HIEN',
            'in-progress': 'DANG_THUC_HIEN',
            'doing': 'DANG_THUC_HIEN',
            'chua-bat-dau': 'CHUA_BAT_DAU',
            'pending': 'CHUA_BAT_DAU',
            'todo': 'CHUA_BAT_DAU',
            'cho-duyet': 'CHO_DUYET',
            'review': 'CHO_DUYET',
            'under-review': 'CHO_DUYET',
            'hoan-thanh': 'HOAN_THANH',
            'completed': 'HOAN_THANH',
            'done': 'HOAN_THANH',
            'tam-dung': 'TAM_DUNG',
            'on-hold': 'TAM_DUNG',
            'paused': 'TAM_DUNG',
            'tu-choi': 'TU_CHOI',
            'rejected': 'TU_CHOI',
            'huy-bo': 'HUY_BO',
            'cancelled': 'HUY_BO'
        };
        return map[clean] || slug.toUpperCase();
    },

    normalizePrioritySlug(slug) {
        if (!slug) return '';
        const clean = String(slug).toLowerCase().replace(/_/g, '-').trim();
        const map = {
            'khan-cap': 'KHAN_CAP',
            'urgent': 'KHAN_CAP',
            'cao': 'CAO',
            'high': 'CAO',
            'trung-binh': 'TRUNG_BINH',
            'medium': 'TRUNG_BINH',
            'thap': 'THAP',
            'low': 'THAP'
        };
        return map[clean] || slug.toUpperCase();
    },

    applyUrlFilters() {
        const params = new URLSearchParams(window.location.search);
        const rawStatus = params.get('status');
        const rawPriority = params.get('priority');
        const dept_id = params.get('dept_id');
        const user_id = params.get('user_id');
        const search = params.get('search');
        const quickFilter = params.get('quick_filter') || params.get('filter');

        const status = this.normalizeStatusSlug(rawStatus);
        const priority = this.normalizePrioritySlug(rawPriority);

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

            const noDueCheck = document.getElementById('taskNoDueDate');
            if (noDueCheck) {
                noDueCheck.checked = false;
                this.toggleNoDueDate(false);
            }

            // Mặc định: Không dùng quy trình mẫu cho TẤT CẢ các cấp (Công việc đơn lẻ: Giao việc & Hoàn thành)
            this.createWorkflowSteps = [];
            this.currentSelectedWorkflowName = null;
            const select = document.getElementById('taskWorkflowSelect');
            if (select) select.value = '';
            this.renderCreateTaskSteps();
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

    removeWorkflowStep(idx) {
        this.createWorkflowSteps.splice(idx, 1);
        // Đánh lại ID cho liền mạch
        this.createWorkflowSteps.forEach((s, i) => s.id = i + 1);
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
        const container = document.getElementById('createTaskWorkflowStepsList');
        if (!container) return;

        if (this.createWorkflowSteps.length === 0) {
            container.innerHTML = `
                <div class="text-center py-3 bg-white rounded-lg border border-dashed border-slate-200">
                    <p class="text-slate-400 italic text-[11px]">Nhiệm vụ dạng trực tiếp (không phân bước). Click "+ Thêm bước" nếu muốn chia nhỏ công việc.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.createWorkflowSteps.map((s, idx) => `
            <div class="flex items-center space-x-2 bg-white p-2 rounded-lg border border-slate-200 shadow-2xs">
                <span class="w-5 h-5 rounded-full bg-blue-100 text-blue-800 font-bold text-[10.5px] flex items-center justify-center shrink-0">
                    ${s.id}
                </span>
                <input type="text" value="${Common.escapeHtml(s.title)}" 
                    oninput="TasksPage.createWorkflowSteps[${idx}].title = this.value"
                    placeholder="Tên bước công việc..." 
                    class="flex-1 px-2.5 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:border-blue-800 focus:bg-white bg-slate-50/50">
                <button type="button" onclick="TasksPage.removeWorkflowStep(${idx})" class="text-slate-400 hover:text-red-500 p-1 text-xs transition">
                    <i class="fa-solid fa-trash-can"></i>
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
        const isNoDueDateChecked = document.getElementById('taskNoDueDate')?.checked;
        const due_date = isNoDueDateChecked ? null : (document.getElementById('taskDueDate')?.value || null);

        // Bắt buộc nhập Mô tả chi tiết khi tạo Đề xuất sáng kiến (để có căn cứ xét duyệt)
        const isProposalMode = (this.currentDispatchRole === 'STAFF' && this.staffTaskMode === 'proposal') || 
                               (this.currentDispatchRole === 'DEPT_HEAD' && this.deptHeadTaskMode === 'proposal');
        
        if (isProposalMode) {
            if (!rawDescription || rawDescription.trim().length < 10) {
                Common.showToast('Vui lòng nhập nội dung mô tả chi tiết đề xuất (tối thiểu 10 ký tự) nêu rõ tính cần thiết, mục tiêu hoặc dự toán!', 'error');
                const descInput = document.getElementById('taskDescription');
                if (descInput) {
                    descInput.focus();
                    descInput.classList.add('border-red-500', 'ring-2', 'ring-red-200');
                    setTimeout(() => descInput.classList.remove('border-red-500', 'ring-2', 'ring-red-200'), 3000);
                }
                return;
            }
            if (!due_date) {
                Common.showToast('Vui lòng chọn Hạn hoàn thành / Thời gian mong muốn hoàn tất cho đề xuất!', 'error');
                const dueInput = document.getElementById('taskDueDate');
                if (dueInput) {
                    dueInput.focus();
                    dueInput.classList.add('border-red-500', 'ring-2', 'ring-red-200');
                    setTimeout(() => dueInput.classList.remove('border-red-500', 'ring-2', 'ring-red-200'), 3000);
                }
                return;
            }
        }

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
        let taskStatus = 'CHUA_BAT_DAU';

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
                taskStatus = 'CHUA_BAT_DAU';
            } else {
                assignee_id = null; // Đề xuất cho trưởng phòng duyệt
                description = `[ĐỀ XUẤT NHIỆM VỤ TỪ CÁN BỘ: ${user.full_name || 'Cá nhân'}]\n` + description;
                successMessage = 'Đã gửi đề xuất công việc lên Trưởng phòng phê duyệt!';
                visibility = 'DEPARTMENT';
                taskType = 'PROPOSAL';
                taskStatus = 'CHO_DUYET';
            }
        } else if (this.currentDispatchRole === 'DEPT_HEAD') {
            leading_dept_id = user.department_id || leading_dept_id;
            if (this.deptHeadTaskMode === 'proposal') {
                assignee_id = null;
                description = `[ĐỀ XUẤT TỪ TRƯỞNG ĐƠN VỊ: ${user.full_name || 'Trưởng phòng'}]\n` + description;
                successMessage = 'Đã gửi đề xuất chủ trương lên Ban Giám Hiệu phê duyệt!';
                visibility = 'ORGANIZATIONAL';
                taskType = 'PROPOSAL';
                taskStatus = 'CHO_DUYET';
            } else {
                successMessage = assignee_id ? 'Đã phân công nhiệm vụ cho cán bộ trong đơn vị!' : 'Đã phân công nhiệm vụ nội bộ!';
                visibility = 'DEPARTMENT';
                taskType = 'ROUTINE';
                taskStatus = 'CHUA_BAT_DAU';
            }
        } else {
            successMessage = assignee_id ? 'Đã giao nhiệm vụ cho cán bộ!' : 'Đã giao nhiệm vụ cho tập thể đơn vị!';
            visibility = 'ORGANIZATIONAL';
            taskType = 'STRATEGIC';
            taskStatus = 'CHUA_BAT_DAU';
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
            status: taskStatus,
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

        if (task.status === 'HOAN_THANH' || task.status === 'HUY_BO') {
            const label = task.status === 'HOAN_THANH' ? 'Đã hoàn thành 100%' : 'Đã hủy bỏ';
            Common.showToast(`Nhiệm vụ này ${label}, không thể thay đổi tiến độ nữa.`, 'warning');
            return;
        }

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

            const statusLabels = {
                'CHUA_BAT_DAU': 'Chưa bắt đầu',
                'DANG_THUC_HIEN': 'Đang thực hiện',
                'CHO_DUYET': task.type === 'PROPOSAL' ? '💡 Chờ phê duyệt chủ trương' : '📋 Chờ phê duyệt',
                'HOAN_THANH': 'Đã hoàn thành',
                'TAM_DUNG': 'Tạm dừng',
                'TU_CHOI': task.type === 'PROPOSAL' ? '🔄 Yêu cầu chỉnh sửa / Bổ sung' : 'Trả lại',
                'HUY_BO': task.type === 'PROPOSAL' ? '❌ Đã bác bỏ đề xuất' : 'Hủy bỏ'
            };

            const priorityLabels = {
                'THAP': 'Thấp',
                'TRUNG_BINH': 'Trung bình',
                'CAO': 'Cao',
                'KHAN_CAP': '🔥 Khẩn cấp'
            };

            const deptLabel = task.type === 'PROPOSAL'
                ? (task.creator?.department ? `${task.creator.department.name} (${task.creator.department.code})` : (task.leading_department ? `${task.leading_department.name} (${task.leading_department.code})` : 'HueIC'))
                : (task.leading_department ? `${task.leading_department.name} (${task.leading_department.code})` : '-');

            let assigneeLabel = '🏢 [Tập thể đơn vị tự điều phối]';
            if (task.type === 'PROPOSAL') {
                assigneeLabel = `💡 [Người đề xuất: ${task.creator ? task.creator.full_name : 'Cán bộ'} - Sẽ phân công sau khi duyệt]`;
            } else if (task.assignee) {
                assigneeLabel = `${task.assignee.full_name} (${task.assignee.position || task.assignee.role})`;
            }

            document.getElementById('detailTaskIdInput').value = task.id;
            document.getElementById('detailTaskTitle').innerText = task.title;
            document.getElementById('detailTaskDesc').innerText = task.description || 'Không có mô tả chi tiết.';
            document.getElementById('detailStatus').innerText = statusLabels[task.status] || task.status;
            document.getElementById('detailPriority').innerText = priorityLabels[task.priority] || task.priority;
            document.getElementById('detailProgress').innerText = `${task.progress_percent}%`;
            document.getElementById('detailLeadingDept').innerText = deptLabel;
            document.getElementById('detailAssistingDept').innerText = task.assisting_department ? `${task.assisting_department.name} (${task.assisting_department.code})` : '-';
            document.getElementById('detailAssignee').innerText = assigneeLabel;
            document.getElementById('detailDueDate').innerText = task.due_date ? Common.formatDateTime(task.due_date) : 'Không đặt hạn';

            // Phân Hệ Phối Hợp Liên Đơn Vị 2 Chiều
            this.renderDetailCollaborationBanner(task);

            // Banner Tiếp Nhận / Từ Chối Nhiệm Vụ Cho Cán Bộ
            this.renderDetailAssignmentBanner(task);

            // Banner Phê Duyệt / Xử Lý Đề Xuất Cấp Dưới
            // Banner Phê Duyệt / Xử Lý Đề Xuất Cấp Dưới
            this.renderDetailProposalBanner(task);

            // RACI Hierarchy Tree
            this.renderDetailRaciTree(task);

            this.renderDetailWorkflowTimeline(task.workflow_steps || [], task.workflow_name);
            
            // Lịch sử Cập nhật & Ý kiến trao đổi (Mặc định chỉ hiện Ý kiến trao đổi)
            this.currentDetailTask = task;
            this.feedViewMode = 'COMMENTS';
            this.renderFeed();

            document.getElementById('modalTaskDetail').classList.remove('hidden');
        } catch (err) {
            console.error('Lỗi mở chi tiết task:', err);
            Common.showToast('Lỗi nạp chi tiết công việc', 'error');
        }
    },

    renderDetailCollaborationBanner(task) {
        const container = document.getElementById('detailCollaborationContainer');
        if (!container) return;

        if (!task.assisting_dept_id && !task.assisting_department) {
            container.innerHTML = '';
            return;
        }

        const currentUser = Common.currentUser || API.getUser() || {};
        const assistingDept = task.assisting_department;
        const assistingDeptName = assistingDept ? `[${assistingDept.code}] ${assistingDept.name}` : 'Đơn vị phối hợp';
        const leadingDept = task.leading_department;
        const leadingDeptName = leadingDept ? `[${leadingDept.code}]` : 'Đơn vị chủ trì';

        const isAssistingDeptHead = (
            currentUser.role === 'SUPERADMIN' ||
            currentUser.role === 'BGH' ||
            (currentUser.department_id === task.assisting_dept_id && ['DEPT_HEAD', 'DEPT_VICE'].includes(currentUser.role))
        );

        const isLeadingDeptHead = (
            currentUser.role === 'SUPERADMIN' ||
            currentUser.role === 'BGH' ||
            (currentUser.department_id === task.leading_dept_id && ['DEPT_HEAD', 'DEPT_VICE'].includes(currentUser.role)) ||
            task.created_by_id === currentUser.id
        );

        const status = task.collaboration_status || 'NONE';

        if (status === 'CHO_XAC_NHAN') {
            let actionsHtml = '';
            if (isAssistingDeptHead) {
                actionsHtml = `
                    <div class="flex items-center gap-2 mt-2 pt-2 border-t border-amber-200">
                        <button type="button" onclick="TasksPage.acceptCollaboration(${task.id})" 
                            class="px-3 py-1.5 bg-green-700 hover:bg-green-800 text-white rounded-lg font-bold text-xs shadow-xs transition flex items-center space-x-1 cursor-pointer">
                            <i class="fa-solid fa-check text-[11px]"></i>
                            <span>Tiếp Nhận & Phân Công Đầu Mối</span>
                        </button>
                        <button type="button" onclick="TasksPage.rejectCollaboration(${task.id})" 
                            class="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg font-bold text-xs shadow-xs transition flex items-center space-x-1 cursor-pointer">
                            <i class="fa-solid fa-xmark text-[11px]"></i>
                            <span>Từ Chối Phối Hợp</span>
                        </button>
                    </div>
                `;
            }

            container.innerHTML = `
                <div class="p-3.5 bg-amber-50/90 rounded-2xl border border-amber-300 text-amber-950 space-y-1.5 animate-fade-in shadow-xs">
                    <div class="flex items-center justify-between">
                        <span class="font-bold text-xs flex items-center space-x-1.5">
                            <span class="w-5 h-5 rounded-full bg-amber-500 text-white font-bold text-[10px] flex items-center justify-center">🤝</span>
                            <span>Đề Nghị Phối Hợp 2 Chiều: <strong class="text-amber-900">${assistingDeptName}</strong></span>
                        </span>
                        <span class="px-2 py-0.5 bg-amber-200 text-amber-950 rounded-full font-bold text-[10px]">🟡 Chờ Xác Nhận</span>
                    </div>
                    <p class="text-[11.5px] text-amber-900 leading-relaxed">
                        ${leadingDeptName} đã gửi đề nghị phối hợp. Nhiệm vụ đang chờ Lãnh đạo <strong>${assistingDeptName}</strong> xem xét tiếp nhận và chỉ định cán bộ đầu mối.
                    </p>
                    ${actionsHtml}
                </div>
            `;
        } else if (status === 'DA_TIEP_NHAN') {
            const assigneeInfo = task.assisting_assignee ? ` — Cán bộ đầu mối: <strong>${task.assisting_assignee.full_name}</strong>` : '';
            container.innerHTML = `
                <div class="p-3 bg-emerald-50/90 rounded-2xl border border-emerald-300 text-emerald-950 flex items-center justify-between animate-fade-in shadow-xs">
                    <div class="flex items-center space-x-2 text-xs">
                        <span class="w-5 h-5 rounded-full bg-emerald-600 text-white font-bold text-[10px] flex items-center justify-center">✅</span>
                        <div>
                            <span class="font-bold">Đơn vị phối hợp: ${assistingDeptName}</span>
                            <span class="text-emerald-800 text-[11px] block">${assigneeInfo || 'Đã chấp thuận phối hợp triển khai'}</span>
                        </div>
                    </div>
                    <span class="px-2.5 py-0.5 bg-emerald-200 text-emerald-950 rounded-full font-bold text-[10px]">🟢 Đã Tiếp Nhận</span>
                </div>
            `;
        } else if (status === 'TU_CHOI') {
            let escalateBtn = '';
            if (isLeadingDeptHead) {
                escalateBtn = `
                    <div class="mt-2 pt-2 border-t border-red-200 flex items-center justify-between">
                        <span class="text-[11px] text-red-800">Cần sự can thiệp từ Ban Giám Hiệu để chỉ đạo phối hợp bắt buộc?</span>
                        <button type="button" onclick="TasksPage.escalateCollaborationToBGH(${task.id})" 
                            class="px-3 py-1.5 bg-blue-800 hover:bg-blue-900 text-white rounded-lg font-bold text-xs shadow-xs transition flex items-center space-x-1 cursor-pointer">
                            <i class="fa-solid fa-building-columns text-[10px]"></i>
                            <span>Chuyển BGH Chỉ Đạo</span>
                        </button>
                    </div>
                `;
            }

            container.innerHTML = `
                <div class="p-3.5 bg-red-50/90 rounded-2xl border border-red-300 text-red-950 space-y-1.5 animate-fade-in shadow-xs">
                    <div class="flex items-center justify-between">
                        <span class="font-bold text-xs flex items-center space-x-1.5">
                            <span class="w-5 h-5 rounded-full bg-red-600 text-white font-bold text-[10px] flex items-center justify-center">❌</span>
                            <span>Đề Nghị Phối Hợp: <strong class="text-red-900">${assistingDeptName}</strong></span>
                        </span>
                        <span class="px-2 py-0.5 bg-red-200 text-red-950 rounded-full font-bold text-[10px]">🔴 Bị Từ Chối</span>
                    </div>
                    <p class="text-[11.5px] text-red-900 leading-relaxed">
                        Lý do từ chối: <em>"${task.collaboration_reject_reason || 'Đơn vị không thể tiếp nhận'}"</em>
                    </p>
                    ${escalateBtn}
                </div>
            `;
        } else {
            container.innerHTML = '';
        }
    },

    async acceptCollaboration(taskId) {
        try {
            const currentUser = Common.currentUser || API.getUser() || {};
            await API.post(`/tasks/${taskId}/collaboration/accept`, {
                assisting_assignee_id: currentUser.id,
                note: 'Đã tiếp nhận phối hợp'
            });
            Common.showToast('Đã tiếp nhận đề nghị phối hợp thành công!', 'success');
            await this.loadTasks();
            this.openTaskDetail(taskId);
        } catch (err) {
            console.error('Lỗi tiếp nhận phối hợp:', err);
            Common.showToast(err.message || 'Không thể tiếp nhận phối hợp', 'error');
        }
    },

    async rejectCollaboration(taskId) {
        const reason = prompt('Vui lòng nhập lý do từ chối đề nghị phối hợp:');
        if (!reason || !reason.trim()) {
            Common.showToast('Bạn cần nhập lý do khi từ chối phối hợp', 'warning');
            return;
        }

        try {
            await API.post(`/tasks/${taskId}/collaboration/reject`, { reason: reason.trim() });
            Common.showToast('Đã từ chối đề nghị phối hợp và gửi phản hồi đến đơn vị chủ trì', 'info');
            await this.loadTasks();
            this.openTaskDetail(taskId);
        } catch (err) {
            console.error('Lỗi từ chối phối hợp:', err);
            Common.showToast(err.message || 'Không thể từ chối phối hợp', 'error');
        }
    },

    async escalateCollaborationToBGH(taskId) {
        const note = prompt('Nhập nội dung/lý do chuyển Ban Giám Hiệu chỉ đạo bắt buộc:', 'Kính trình BGH xem xét chỉ đạo phối hợp');
        if (note === null) return;

        try {
            await API.post(`/tasks/${taskId}/collaboration/escalate-bgh`, { note: note.trim() });
            Common.showToast('Đã chuyển đề xuất phối hợp lên Ban Giám Hiệu!', 'success');
            await this.loadTasks();
            this.openTaskDetail(taskId);
        } catch (err) {
            console.error('Lỗi chuyển BGH:', err);
            Common.showToast(err.message || 'Không thể chuyển BGH', 'error');
        }
    },

    renderDetailRaciTree(task) {
        const container = document.getElementById('detailRaciTreeContainer');
        if (!container) return;

        const currentUser = Common.currentUser || API.getUser() || {};
        const isStaffOnly = ['STAFF', 'EMPLOYEE', 'NHAN_VIEN'].includes(currentUser.role);
        const hasLeadershipOrAdminRole = ['SUPERADMIN', 'BGH', 'DEPT_HEAD', 'DEPT_VICE'].includes(currentUser.role);
        const taskLeadingDeptId = task.leading_dept_id || (task.leading_department ? task.leading_department.id : null);
        const deptCode = task.leading_department ? task.leading_department.code : (task.creator?.department?.code || 'HueIC');

        // TRƯỜNG HỢP 1: ĐỀ XUẤT SÁNG KIẾN TỪ CẤP DƯỚI (PROPOSAL)
        if (task.type === 'PROPOSAL') {
            const creatorName = task.creator ? task.creator.full_name : 'Cán bộ';
            const creatorRole = task.creator ? (task.creator.position || task.creator.role || 'Cán bộ') : 'Cán bộ';
            const creatorDept = task.creator?.department ? task.creator.department.code : deptCode;
            const approverInfo = this.getProposalApproverInfo(task);

            let statusPill = '<span class="px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 rounded font-bold text-[10px]">🟡 Đang chờ duyệt</span>';
            if (task.status === 'TU_CHOI') {
                statusPill = '<span class="px-2 py-0.5 bg-rose-100 text-rose-800 border border-rose-200 rounded font-bold text-[10px]">🔄 Yêu cầu chỉnh sửa</span>';
            } else if (task.status === 'HUY_BO') {
                statusPill = '<span class="px-2 py-0.5 bg-slate-200 text-slate-700 border border-slate-300 rounded font-bold text-[10px]">❌ Đã bác bỏ</span>';
            }

            container.innerHTML = `
                <div class="p-3 bg-amber-50/50 rounded-xl border border-amber-200 space-y-2.5">
                    <div class="flex items-center justify-between">
                        <span class="text-[11px] font-bold text-amber-900 uppercase tracking-wider flex items-center space-x-1.5">
                            <i class="fa-solid fa-lightbulb text-amber-600"></i>
                            <span>Lộ Trình Trình Duyệt Đề Xuất (Bottom-Up Proposal Governance)</span>
                        </span>
                        ${statusPill}
                    </div>

                    <div class="flex flex-wrap items-center gap-2 text-xs">
                        <!-- Level 1: Cán bộ khởi tạo / Đề xuất -->
                        <div class="flex items-center space-x-1.5 bg-white px-2.5 py-1.5 rounded-lg border border-amber-200 shadow-2xs">
                            <span class="w-5 h-5 rounded-full bg-amber-500 text-white font-bold text-[9px] flex items-center justify-center">✍️</span>
                            <div>
                                <div class="text-[9.5px] text-amber-800 font-bold uppercase">Người đề xuất</div>
                                <div class="font-bold text-slate-900">${creatorName} <span class="text-amber-800 font-normal">(${creatorDept})</span></div>
                            </div>
                        </div>

                        <i class="fa-solid fa-arrow-right text-amber-400 text-xs"></i>

                        <!-- Level 2: Cấp thẩm quyền xem xét & Phê duyệt -->
                        <div class="flex items-center space-x-1.5 bg-white px-2.5 py-1.5 rounded-lg border border-purple-200 bg-purple-50/30 shadow-2xs">
                            <span class="w-5 h-5 rounded-full bg-purple-700 text-white font-bold text-[9px] flex items-center justify-center">${approverInfo.icon}</span>
                            <div>
                                <div class="text-[9.5px] text-purple-800 font-bold uppercase">Thẩm quyền phê duyệt</div>
                                <div class="font-bold text-slate-900">${approverInfo.title}</div>
                            </div>
                        </div>

                        <i class="fa-solid fa-arrow-right text-amber-400 text-xs"></i>

                        <!-- Level 3: Phân công nhân sự thực thi -->
                        <div class="flex-1 min-w-[200px] flex items-center space-x-1.5 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 shadow-2xs">
                            <div>
                                <div class="text-[9.5px] text-slate-400 font-bold uppercase">Phân công thực thi</div>
                                <div class="text-[10.5px] text-slate-500 italic">🟡 Sẽ chỉ định nhân sự sau khi duyệt chủ trương</div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            return;
        }

        // TRƯỜNG HỢP 2: VIỆC CÁ NHÂN (SELF TO-DO)
        if (task.type === 'SELF') {
            const creatorName = task.creator ? task.creator.full_name : (task.assignee ? task.assignee.full_name : 'Chính mình');
            container.innerHTML = `
                <div class="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <div class="flex items-center space-x-1.5 text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                        <i class="fa-solid fa-user-pen text-blue-800"></i>
                        <span>Việc Cá Nhân Tự Quản Lý (Self To-Do Task)</span>
                    </div>
                    <div class="flex items-center space-x-2 bg-white p-2 rounded-lg border border-slate-200 text-xs">
                        <span class="w-5 h-5 rounded-full bg-blue-800 text-white font-bold text-[9px] flex items-center justify-center">👤</span>
                        <div>
                            <span class="font-bold text-slate-900">${creatorName}</span>
                            <span class="text-slate-500 text-[10.5px] ml-1">(Tự lập danh sách và tự theo dõi tiến độ hoàn thành)</span>
                        </div>
                    </div>
                </div>
            `;
            return;
        }

        // TRƯỜNG HỢP 3: NHIỆM VỤ THÔNG THƯỜNG / CHIẾN LƯỢC (ROUTINE / STRATEGIC TOP-DOWN)
        const canDelegate = (
            !isStaffOnly &&
            hasLeadershipOrAdminRole &&
            !!currentUser.department_id &&
            currentUser.department_id === taskLeadingDeptId &&
            task.created_by_id !== currentUser.id
        );

        const steps = task.workflow_steps || [];
        const assignedStaffs = [...new Set(steps.map(s => s.assignee_name).filter(Boolean))];

        const staffPills = assignedStaffs.length > 0
            ? assignedStaffs.map(name => `<span class="px-2 py-0.5 bg-blue-50 text-blue-900 border border-blue-200 rounded font-semibold text-[10.5px]">👤 ${name}</span>`).join('')
            : (task.assignee ? `<span class="px-2 py-0.5 bg-blue-50 text-blue-900 border border-blue-200 rounded font-semibold text-[10.5px]">👤 ${task.assignee.full_name}</span>` : '<span class="text-slate-400 italic text-[10.5px]">Chưa phân công tiếp cho nhân viên</span>');

        const assignedByName = task.assigned_by ? task.assigned_by.full_name : (task.creator ? task.creator.full_name : 'Ban Giám Hiệu');
        const assignedByLabel = (task.created_by_id && task.creator?.role === 'SUPERADMIN' || task.creator?.role === 'BGH') ? 'Ban Giám Hiệu' : assignedByName;

        const delegateBtnHtml = canDelegate ? `
                    <button type="button" onclick="TasksPage.openDelegateTaskModal(${task.id})" 
                        class="px-2.5 py-1 bg-blue-50 hover:bg-blue-800 hover:text-white text-blue-900 rounded-lg text-[11px] font-bold border border-blue-200 transition flex items-center space-x-1 shadow-xs">
                        <i class="fa-solid fa-list-check text-[10px]"></i>
                        <span>Triển Khai &amp; Phân Công</span>
                    </button>` : '';

        container.innerHTML = `
            <div class="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
                <div class="flex items-center justify-between">
                    <span class="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center space-x-1.5">
                        <i class="fa-solid fa-sitemap text-blue-800"></i>
                        <span>Cây Phân Cấp Trách Nhiệm (RACI Hierarchy &amp; Delegation Chain)</span>
                    </span>
                    ${delegateBtnHtml}
                </div>

                <div class="flex flex-wrap items-center gap-2 text-xs">
                    <!-- Level 1: Người giao việc (BGH / Lãnh đạo) -->
                    <div class="flex items-center space-x-1.5 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 shadow-2xs">
                        <span class="w-5 h-5 rounded-full bg-slate-800 text-white font-bold text-[9px] flex items-center justify-center">🏛️</span>
                        <div>
                            <div class="text-[9.5px] text-slate-400 font-bold uppercase">Người giao việc</div>
                            <div class="font-bold text-slate-900 truncate max-w-[150px]" title="${assignedByLabel}">${assignedByLabel}</div>
                        </div>
                    </div>

                    <i class="fa-solid fa-arrow-right text-slate-400 text-xs"></i>

                    <!-- Level 2: Trưởng đơn vị (Accountable) -->
                    <div class="flex items-center space-x-1.5 bg-white px-2.5 py-1.5 rounded-lg border border-amber-300 bg-amber-50/40 shadow-2xs">
                        <span class="w-5 h-5 rounded-full bg-amber-600 text-white font-bold text-[9px] flex items-center justify-center">🏢</span>
                        <div>
                            <div class="text-[9.5px] text-amber-700 font-bold uppercase">Chịu trách nhiệm (Accountable)</div>
                            <div class="font-bold text-slate-900">${this.getDeptLeaderTitle(task.leading_department || deptCode)}</div>
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

        const currentUser = Common.currentUser || API.getUser() || {};
        const task = this.currentDetailTask || {};
        const isStaffOnly = ['STAFF', 'EMPLOYEE', 'NHAN_VIEN'].includes(currentUser.role);
        const hasLeadershipOrAdminRole = ['SUPERADMIN', 'BGH', 'DEPT_HEAD', 'DEPT_VICE'].includes(currentUser.role);
        const taskLeadingDeptId = task.leading_dept_id || (task.leading_department ? task.leading_department.id : null);

        // Nút [📋 Triển Khai & Phân Công] hiển thị khi có thẩm quyền lãnh đạo của đơn vị chủ trì
        const canDelegate = (
            !isStaffOnly &&
            hasLeadershipOrAdminRole &&
            !!currentUser.department_id &&
            currentUser.department_id === taskLeadingDeptId &&
            task.created_by_id !== currentUser.id
        );

        if (!steps || steps.length === 0) {
            const delegateAction = canDelegate ? `
                    <button type="button" onclick="TasksPage.openDelegateTaskModal(${task.id || 0})" 
                        class="px-3 py-1.5 bg-blue-800 hover:bg-blue-900 text-white rounded-lg text-xs font-bold transition inline-flex items-center space-x-1.5 shadow-xs cursor-pointer">
                        <i class="fa-solid fa-list-check text-xs"></i>
                        <span>Triển Khai &amp; Phân Công Các Bước</span>
                    </button>` : '';
            container.innerHTML = `
                <div class="p-4 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center space-y-2">
                    <p class="text-slate-500 text-xs">Nhiệm vụ này đang ở dạng công việc trực tiếp (Chưa thiết lập lộ trình các bước mốc).</p>
                    ${delegateAction}
                </div>
            `;
            if (badge) badge.innerText = 'Công việc đơn lẻ';
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

        const task = this.currentDelegatingTask || {};
        const deptId = task.leading_dept_id || task.leading_department_id || (task.leading_department ? task.leading_department.id : null);
        const parentDeadline = task.due_date ? task.due_date.split('T')[0] : '';
        const currentUser = Common.currentUser || API.getUser() || {};

        // Danh sách nhân sự trong đơn vị: ưu tiên đưa Trưởng phòng / Chính mình lên đầu
        let unitUsers = this.users.filter(u => u.department_id === deptId || !u.department_id);
        const usersWithWorkload = unitUsers.map(u => {
            const wl = this.calculateUserWorkload(u.id);
            return { ...u, workload: wl, isCurrent: (u.id === currentUser.id) };
        }).sort((a, b) => {
            if (a.isCurrent) return -1;
            if (b.isCurrent) return 1;
            return a.workload.active - b.workload.active;
        });

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
                                    const prefix = u.isCurrent ? '⭐ [Chính tôi] ' : '';
                                    return `<option value="${u.id}" ${isSelected ? 'selected' : ''}>${prefix}${u.full_name} (${u.role || 'Cán bộ'}) — ${tag}</option>`;
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

    // ----------------------------------------------------
    // LỊCH SỬ CẬP NHẬT & Ý KIẾN TRAO ĐỔI (FEED & COMMENTS)
    // ----------------------------------------------------
    switchFeedView(mode) {
        this.feedViewMode = mode;
        const tabComments = document.getElementById('tabCommentOnly');
        const tabAll = document.getElementById('tabAllLogs');

        if (mode === 'COMMENTS') {
            if (tabComments) {
                tabComments.className = 'px-2.5 py-1 rounded-md transition cursor-pointer bg-white text-blue-900 shadow-2xs font-bold';
            }
            if (tabAll) {
                tabAll.className = 'px-2.5 py-1 rounded-md transition cursor-pointer text-slate-600 hover:text-slate-900 font-medium';
            }
        } else {
            if (tabComments) {
                tabComments.className = 'px-2.5 py-1 rounded-md transition cursor-pointer text-slate-600 hover:text-slate-900 font-medium';
            }
            if (tabAll) {
                tabAll.className = 'px-2.5 py-1 rounded-md transition cursor-pointer bg-white text-blue-900 shadow-2xs font-bold';
            }
        }
        this.renderFeed();
    },

    renderFeed() {
        const list = document.getElementById('detailCommentsList');
        if (!list) return;

        const task = this.currentDetailTask || {};
        const comments = task.comments || [];
        const logs = task.action_logs || [];

        // Cập nhật badges số lượng
        const commentsBadge = document.getElementById('feedCommentsCount');
        const allBadge = document.getElementById('feedAllCount');
        if (commentsBadge) commentsBadge.innerText = comments.length;
        if (allBadge) allBadge.innerText = comments.length + logs.length;

        // 1. Chế độ Mặc định: Chỉ hiện Ý kiến trao đổi / Chỉ đạo của những người liên quan
        if (this.feedViewMode === 'COMMENTS') {
            if (comments.length === 0) {
                list.innerHTML = `
                    <div class="p-6 text-center text-slate-400 space-y-1 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                        <i class="fa-regular fa-comment-dots text-2xl text-slate-300"></i>
                        <p class="text-xs">Chưa có ý kiến trao đổi nào cho nhiệm vụ này.</p>
                        <p class="text-[11px] text-slate-400">Các cán bộ và lãnh đạo có thể gửi ý kiến ở khung bên dưới.</p>
                    </div>
                `;
                return;
            }

            list.innerHTML = comments.slice().reverse().map(c => this.renderSingleCommentCard(c, task)).join('');
            return;
        }

        // 2. Chế độ Xem tất cả: Kết hợp cả Lịch sử hệ thống (Action Logs) và Ý kiến trao đổi (Comments)
        const combined = [];
        comments.forEach(c => {
            combined.push({
                type: 'COMMENT',
                time: new Date(c.created_at).getTime(),
                data: c
            });
        });
        logs.forEach(l => {
            combined.push({
                type: 'LOG',
                time: new Date(l.created_at).getTime(),
                data: l
            });
        });

        // Sắp xếp thời gian giảm dần (mới nhất lên trên)
        combined.sort((a, b) => b.time - a.time);

        if (combined.length === 0) {
            list.innerHTML = '<p class="text-slate-400 italic text-xs py-4 text-center">Chưa có nhật ký hoạt động nào.</p>';
            return;
        }

        list.innerHTML = combined.map(item => {
            if (item.type === 'COMMENT') {
                return this.renderSingleCommentCard(item.data, task);
            } else {
                return this.renderSingleLogCard(item.data, task);
            }
        }).join('');
    },

    renderSingleCommentCard(c, task) {
        const authorName = c.author ? c.author.full_name : 'Cán bộ';
        const authorInitial = authorName.charAt(0).toUpperCase();
        const timeStr = Common.formatDateTime(c.created_at);

        // Nhận diện vai trò người phát biểu (Ưu tiên Người khởi tạo & Người thực hiện lên trước Role chung)
        let roleBadge = '<span class="text-[9.5px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-medium">Thành viên</span>';
        if (c.author) {
            const authorId = Number(c.author.id);
            const creatorId = Number(task.created_by_id || (task.creator ? task.creator.id : 0));
            const assigneeId = Number(task.assignee_id || (task.assignee ? task.assignee.id : 0));

            if (authorId === creatorId) {
                roleBadge = '<span class="text-[9.5px] bg-amber-100 text-amber-900 font-bold px-1.5 py-0.2 rounded border border-amber-200">✍️ Người khởi tạo</span>';
            } else if (authorId === assigneeId) {
                roleBadge = '<span class="text-[9.5px] bg-emerald-100 text-emerald-900 font-bold px-1.5 py-0.2 rounded border border-emerald-200">🎯 Người thực hiện</span>';
            } else if (['SUPERADMIN', 'BGH'].includes(c.author.role)) {
                roleBadge = '<span class="text-[9.5px] bg-purple-100 text-purple-900 font-bold px-1.5 py-0.2 rounded border border-purple-200">👑 Ban Giám Hiệu</span>';
            } else if (['DEPT_HEAD', 'DEPT_VICE'].includes(c.author.role)) {
                roleBadge = '<span class="text-[9.5px] bg-blue-100 text-blue-900 font-bold px-1.5 py-0.2 rounded border border-blue-200">🏢 Lãnh đạo đơn vị</span>';
            }
        }

        // Tự động phân loại kiểu ý kiến chỉ đạo / thông báo
        let cardBg = 'bg-white border-slate-200';
        let typeBadge = '<span class="text-[9px] bg-blue-50 text-blue-800 font-semibold px-1.5 py-0.2 rounded border border-blue-100">💬 Ý kiến trao đổi</span>';

        if (c.content.includes('[PHÊ DUYỆT ĐỀ XUẤT]')) {
            cardBg = 'bg-emerald-50/70 border-emerald-300';
            typeBadge = '<span class="text-[9px] bg-emerald-100 text-emerald-900 font-bold px-1.5 py-0.2 rounded border border-emerald-200">✅ Quyết định phê duyệt</span>';
        } else if (c.content.includes('[YÊU CẦU BỔ SUNG ĐỀ XUẤT]') || c.content.includes('TỪ CHỐI TIẾP NHẬN')) {
            cardBg = 'bg-amber-50/70 border-amber-300';
            typeBadge = '<span class="text-[9px] bg-amber-100 text-amber-900 font-bold px-1.5 py-0.2 rounded border border-amber-200">🔄 Yêu cầu bổ sung</span>';
        } else if (c.content.includes('[BÁC BỎ ĐỀ XUẤT]')) {
            cardBg = 'bg-rose-50/70 border-rose-300';
            typeBadge = '<span class="text-[9px] bg-rose-100 text-rose-900 font-bold px-1.5 py-0.2 rounded border border-rose-200">❌ Quyết định bác bỏ</span>';
        } else if (c.content.includes('[TRÌNH DUYỆT LẠI ĐỀ XUẤT]')) {
            cardBg = 'bg-blue-50/70 border-blue-300';
            typeBadge = '<span class="text-[9px] bg-blue-100 text-blue-900 font-bold px-1.5 py-0.2 rounded border border-blue-200">📤 Trình duyệt lại</span>';
        }

        return `
            <div class="p-3 ${cardBg} border rounded-xl text-xs space-y-1.5 shadow-2xs transition hover:shadow-xs">
                <div class="flex items-center justify-between gap-2">
                    <div class="flex items-center space-x-2 min-w-0">
                        <div class="w-6 h-6 rounded-full bg-blue-800 text-white flex items-center justify-center font-bold text-[10.5px] shrink-0 shadow-2xs">
                            ${authorInitial}
                        </div>
                        <span class="font-bold text-slate-900 text-xs truncate">${authorName}</span>
                        ${roleBadge}
                        ${typeBadge}
                    </div>
                    <span class="text-[10px] text-slate-400 font-mono shrink-0">${timeStr}</span>
                </div>
                <div class="text-slate-800 leading-relaxed font-normal pl-8 whitespace-pre-wrap">${c.content}</div>
            </div>
        `;
    },

    renderSingleLogCard(log, task) {
        const timeStr = Common.formatDateTime(log.created_at);
        const actionMap = {
            'CREATE': { label: 'Khởi tạo nhiệm vụ', icon: 'fa-plus', color: 'text-blue-600 bg-blue-50 border-blue-200' },
            'UPDATE': { label: 'Cập nhật tiến độ / % hoàn thành', icon: 'fa-pen-to-square', color: 'text-cyan-600 bg-cyan-50 border-cyan-200' },
            'APPROVE_PROPOSAL': { label: 'Phê duyệt chủ trương đề xuất', icon: 'fa-check', color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
            'REQUEST_PROPOSAL_CHANGES': { label: 'Yêu cầu bổ sung nội dung', icon: 'fa-rotate-left', color: 'text-amber-600 bg-amber-50 border-amber-200' },
            'REJECT_PROPOSAL': { label: 'Bác bỏ đề xuất', icon: 'fa-ban', color: 'text-rose-600 bg-rose-50 border-rose-200' },
            'RESUBMIT_PROPOSAL': { label: 'Gửi lại đề xuất đã sửa', icon: 'fa-paper-plane', color: 'text-indigo-600 bg-indigo-50 border-indigo-200' },
            'REJECT_ASSIGNMENT': { label: 'Từ chối nhận việc', icon: 'fa-user-xmark', color: 'text-rose-600 bg-rose-50 border-rose-200' },
            'ACCEPT_ASSIGNMENT': { label: 'Tiếp nhận phân công', icon: 'fa-user-check', color: 'text-green-600 bg-green-50 border-green-200' },
            'ESCALATE': { label: 'Chuyển BGH chỉ đạo', icon: 'fa-landmark', color: 'text-purple-600 bg-purple-50 border-purple-200' }
        };

        const conf = actionMap[log.action] || { label: log.action, icon: 'fa-clock-rotate-left', color: 'text-slate-600 bg-slate-50 border-slate-200' };
        let detailStr = '';
        if (log.details) {
            try {
                const det = typeof log.details === 'object' ? log.details : JSON.parse(log.details);
                const keys = Object.keys(det);
                if (keys.length > 0) {
                    detailStr = keys.map(k => `${k}: ${det[k]}`).join(' • ');
                }
            } catch (e) {
                detailStr = String(log.details);
            }
        }

        return `
            <div class="p-2 bg-slate-50/90 border border-slate-200 rounded-lg text-[11px] flex items-center justify-between gap-2">
                <div class="flex items-center space-x-2 min-w-0">
                    <span class="w-5 h-5 rounded-md ${conf.color} border flex items-center justify-center text-[10px] shrink-0 font-bold">
                        <i class="fa-solid ${conf.icon}"></i>
                    </span>
                    <span class="text-[9px] bg-slate-200/80 text-slate-700 font-semibold px-1 py-0.2 rounded shrink-0">⚙️ Hệ thống</span>
                    <div class="truncate">
                        <span class="font-bold text-slate-800">${conf.label}</span>
                        ${detailStr ? `<span class="text-slate-500 text-[10px] ml-1 truncate">(${detailStr})</span>` : ''}
                    </div>
                </div>
                <span class="text-[10px] text-slate-400 font-mono shrink-0">${timeStr}</span>
            </div>
        `;
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
            this.currentDetailTask = updated;
            this.renderFeed();
        } catch (err) {
            Common.showToast(err.message || 'Lỗi gửi bình luận', 'error');
        }
    },

    // ----------------------------------------------------
    // BANNER TIẾP NHẬN / TỪ CHỐI NHIỆM VỤ ĐƯỢC PHÂN CÔNG
    // ----------------------------------------------------
    renderDetailAssignmentBanner(task) {
        const container = document.getElementById('detailAssignmentActionContainer');
        if (!container) return;

        const currentUser = Common.currentUser || API.getUser() || {};
        const isAssignee = (task.assignee_id === currentUser.id || (task.assisting_assignee_id === currentUser.id));
        
        // Kiểm tra xem cán bộ đã tiếp nhận nhiệm vụ chưa
        const isPendingAcceptance = isAssignee && !task.received_at && task.status !== 'HOAN_THANH' && task.status !== 'HUY_BO';

        if (!isPendingAcceptance) {
            container.innerHTML = '';
            return;
        }

        container.innerHTML = `
            <div class="p-3.5 bg-blue-50/90 rounded-2xl border border-blue-300 text-blue-950 space-y-2 animate-fade-in shadow-xs">
                <div class="flex items-center justify-between">
                    <span class="font-bold text-xs flex items-center space-x-1.5">
                        <span class="w-5 h-5 rounded-full bg-blue-600 text-white font-bold text-[10px] flex items-center justify-center">⚡</span>
                        <span>Bạn vừa được phân công phụ trách nhiệm vụ này</span>
                    </span>
                    <span class="px-2 py-0.5 bg-blue-200 text-blue-950 rounded-full font-bold text-[10px]">Chờ Tiếp Nhận</span>
                </div>
                <p class="text-[11.5px] text-blue-900 leading-relaxed">
                    Vui lòng xác nhận tiếp nhận để bắt đầu triển khai hoặc báo cáo lý do từ chối nếu bị trùng lịch/quá tải.
                </p>
                <div class="flex items-center gap-2 pt-1 border-t border-blue-200">
                    <button type="button" onclick="TasksPage.acceptAssignment(${task.id})" 
                        class="px-3.5 py-1.5 bg-green-700 hover:bg-green-800 text-white rounded-lg font-bold text-xs shadow-xs transition flex items-center space-x-1.5 cursor-pointer">
                        <i class="fa-solid fa-check text-[11px]"></i>
                        <span>Tiếp Nhận Nhiệm Vụ</span>
                    </button>
                    <button type="button" onclick="TasksPage.openReasonPrompt('REJECT_ASSIGNMENT', ${task.id})" 
                        class="px-3.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg font-bold text-xs shadow-xs transition flex items-center space-x-1.5 cursor-pointer">
                        <i class="fa-solid fa-xmark text-[11px]"></i>
                        <span>Từ Chối Tiếp Nhận (Kèm Lý Do)</span>
                    </button>
                </div>
            </div>
        `;
    },

    async acceptAssignment(taskId) {
        try {
            await API.acceptTaskAssignment(taskId);
            Common.showToast('Đã xác nhận tiếp nhận nhiệm vụ thành công!', 'success');
            await this.openTaskDetailModal(taskId);
            this.loadTasks();
        } catch (err) {
            Common.showToast(err.message || 'Lỗi tiếp nhận nhiệm vụ', 'error');
        }
    },

    // ----------------------------------------------------
    // BANNER PHÊ DUYỆT / BÁC BỎ ĐỀ XUẤT CỦA CẤP DƯỚI
    // ----------------------------------------------------
    renderDetailProposalBanner(task) {
        const container = document.getElementById('detailProposalActionContainer');
        if (!container) return;

        if (task.type !== 'PROPOSAL') {
            container.innerHTML = '';
            return;
        }

        const currentUser = Common.currentUser || API.getUser() || {};
        const isLeader = this.canUserApproveProposal(task, currentUser);
        const isCreator = (task.created_by_id === currentUser.id || currentUser.role === 'SUPERADMIN');

        // 1. Trường hợp Đề xuất bị yêu cầu chỉnh sửa / bổ sung
        if (task.status === 'TU_CHOI') {
            // Tìm ý kiến phản hồi mới nhất
            let feedback = 'Đề xuất cần bổ sung thêm dự toán/phương án chi tiết.';
            if (task.comments && task.comments.length > 0) {
                const changeComment = task.comments.slice().reverse().find(c => c.content && c.content.includes('[YÊU CẦU BỔ SUNG ĐỀ XUẤT]'));
                if (changeComment) {
                    feedback = changeComment.content.replace('🔄 [YÊU CẦU BỔ SUNG ĐỀ XUẤT] Đề xuất cần hoàn thiện thêm. Ý kiến phản hồi: ', '');
                }
            }

            container.innerHTML = `
                <div class="p-3.5 bg-amber-50/95 rounded-2xl border border-amber-300 text-amber-950 space-y-2 animate-fade-in shadow-xs">
                    <div class="flex items-center justify-between">
                        <span class="font-bold text-xs flex items-center space-x-1.5">
                            <span class="w-5 h-5 rounded-full bg-amber-600 text-white font-bold text-[10px] flex items-center justify-center">⚠️</span>
                            <span>Đề Xuất Cần Bổ Sung / Chỉnh Sửa</span>
                        </span>
                        <span class="px-2 py-0.5 bg-amber-200 text-amber-950 rounded-full font-bold text-[10px]">Cần Chỉnh Sửa</span>
                    </div>
                    <div class="p-2.5 bg-white/80 rounded-xl border border-amber-200 text-xs text-amber-900 leading-relaxed font-medium">
                        <span class="font-bold text-amber-950"><i class="fa-solid fa-comment-dots mr-1 text-amber-600"></i>Ý kiến Lãnh đạo:</span>
                        <em>"${feedback}"</em>
                    </div>
                    ${isCreator ? `
                        <div class="pt-1 border-t border-amber-200 flex justify-end">
                            <button type="button" onclick="TasksPage.openResubmitProposalModal(${JSON.stringify(task).replace(/"/g, '&quot;')})" 
                                class="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-xs shadow-xs transition flex items-center space-x-1.5 cursor-pointer">
                                <i class="fa-solid fa-paper-plane text-[11px]"></i>
                                <span>Chỉnh Sửa &amp; Trình Duyệt Lại</span>
                            </button>
                        </div>
                    ` : ''}
                </div>
            `;
            return;
        }

        // 2. Trường hợp Đề xuất đang chờ duyệt (CHO_DUYET)
        if (!isLeader) {
            container.innerHTML = `
                <div class="p-3 bg-amber-50/80 rounded-2xl border border-amber-200 text-amber-950 text-xs flex items-center space-x-2">
                    <i class="fa-solid fa-lightbulb text-amber-600 text-sm"></i>
                    <span>Đây là <b>Đề xuất / Sáng kiến từ cấp dưới</b>. Đang chờ Lãnh đạo đơn vị hoặc Ban Giám Hiệu xem xét phê duyệt.</span>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div class="p-3.5 bg-purple-50/90 rounded-2xl border border-purple-300 text-purple-950 space-y-2 animate-fade-in shadow-xs">
                <div class="flex items-center justify-between">
                    <span class="font-bold text-xs flex items-center space-x-1.5">
                        <span class="w-5 h-5 rounded-full bg-purple-600 text-white font-bold text-[10px] flex items-center justify-center">💡</span>
                        <span>Đề Xuất / Sáng Kiến Cần Phê Duyệt Chủ Trương</span>
                    </span>
                    <span class="px-2 py-0.5 bg-purple-200 text-purple-950 rounded-full font-bold text-[10px]">Chờ Phê Duyệt</span>
                </div>
                <p class="text-[11.5px] text-purple-900 leading-relaxed">
                    Đề xuất do <strong>${task.creator ? task.creator.full_name : 'Cán bộ'}</strong> khởi tạo. Vui lòng xem xét phê duyệt thành nhiệm vụ chính thức hoặc yêu cầu bổ sung/bác bỏ.
                </p>
                <div class="flex flex-wrap items-center gap-2 pt-1 border-t border-purple-200">
                    <button type="button" onclick="TasksPage.openApproveProposalModal(${JSON.stringify(task).replace(/"/g, '&quot;')})" 
                        class="px-3.5 py-1.5 bg-purple-700 hover:bg-purple-800 text-white rounded-lg font-bold text-xs shadow-xs transition flex items-center space-x-1.5 cursor-pointer">
                        <i class="fa-solid fa-stamp text-[11px]"></i>
                        <span>Phê Duyệt &amp; Hoàn Thiện</span>
                    </button>
                    <button type="button" onclick="TasksPage.openReasonPrompt('REQUEST_PROPOSAL_CHANGES', ${task.id})" 
                        class="px-3.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-lg font-bold text-xs shadow-xs transition flex items-center space-x-1.5 cursor-pointer">
                        <i class="fa-solid fa-rotate-left text-[11px]"></i>
                        <span>Yêu Cầu Bổ Sung</span>
                    </button>
                    <button type="button" onclick="TasksPage.openReasonPrompt('REJECT_PROPOSAL', ${task.id})" 
                        class="px-3.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg font-bold text-xs shadow-xs transition flex items-center space-x-1.5 cursor-pointer">
                        <i class="fa-solid fa-ban text-[11px]"></i>
                        <span>Bác Bỏ Đề Xuất</span>
                    </button>
                </div>
            </div>
        `;
    },

    // ----------------------------------------------------
    // MODAL PHÊ DUYỆT ĐỀ XUẤT HANDLERS
    // ----------------------------------------------------
    openApproveProposalModal(task) {
        document.getElementById('approveProposalTaskId').value = task.id;
        
        const creatorName = task.creator ? task.creator.full_name : 'Cán bộ';
        const creatorDept = task.creator?.department ? task.creator.department.code : (task.leading_department ? task.leading_department.code : '');
        document.getElementById('approveProposalTaskCreator').innerText = `${creatorName} (${creatorDept})`;
        
        // Điền sẵn dữ liệu để Lãnh đạo tinh chỉnh trực tiếp
        const titleInput = document.getElementById('approveProposalTitle');
        if (titleInput) titleInput.value = task.title || '';

        const descInput = document.getElementById('approveProposalDescription');
        if (descInput) descInput.value = task.description || '';

        const targetTypeSelect = document.getElementById('approveProposalTargetType');
        if (targetTypeSelect) targetTypeSelect.value = (task.visibility === 'ORGANIZATIONAL') ? 'STRATEGIC' : 'ROUTINE';

        const prioritySelect = document.getElementById('approveProposalPriority');
        if (prioritySelect) prioritySelect.value = task.priority || 'TRUNG_BINH';

        const dueDateInput = document.getElementById('approveProposalDueDate');
        if (dueDateInput) {
            dueDateInput.value = task.due_date ? task.due_date.split('T')[0] : '';
        }

        const noteInput = document.getElementById('approveProposalNote');
        if (noteInput) noteInput.value = '';

        // Nạp danh sách cán bộ trong khoa/phòng để phân công (ưu tiên chính người đề xuất)
        const selAssignee = document.getElementById('approveProposalAssignee');
        if (selAssignee) {
            const defaultAssigneeId = task.assignee_id || (task.creator ? task.creator.id : null);
            selAssignee.innerHTML = '<option value="">🏢 [Tập thể đơn vị tự điều phối]</option>' +
                this.users.map(u => `<option value="${u.id}" ${defaultAssigneeId === u.id ? 'selected' : ''}>${u.full_name} (${u.position || u.role})</option>`).join('');
        }

        // Nạp danh sách đơn vị phối hợp
        const selAssisting = document.getElementById('approveProposalAssistingDept');
        if (selAssisting) {
            selAssisting.innerHTML = '<option value="">-- Không có đơn vị phối hợp --</option>' +
                this.departments.filter(d => d.id !== task.leading_dept_id).map(d => 
                    `<option value="${d.id}" ${task.assisting_dept_id === d.id ? 'selected' : ''}>[${d.code}] ${d.name}</option>`
                ).join('');
        }

        document.getElementById('modalApproveProposal').classList.remove('hidden');
    },

    closeApproveProposalModal() {
        document.getElementById('modalApproveProposal').classList.add('hidden');
    },

    async handleApproveProposalSubmit(e) {
        e.preventDefault();
        const taskId = document.getElementById('approveProposalTaskId').value;
        const title = document.getElementById('approveProposalTitle').value.trim();
        const description = document.getElementById('approveProposalDescription').value.trim();
        const targetType = document.getElementById('approveProposalTargetType').value;
        const priority = document.getElementById('approveProposalPriority').value;
        const assigneeId = document.getElementById('approveProposalAssignee').value || null;
        const assistingDeptId = document.getElementById('approveProposalAssistingDept').value || null;
        const dueDate = document.getElementById('approveProposalDueDate').value || null;
        const note = document.getElementById('approveProposalNote').value.trim();

        if (!title) {
            Common.showToast('Vui lòng nhập tiêu đề nhiệm vụ!', 'error');
            return;
        }

        try {
            await API.approveTaskProposal(taskId, {
                title: title,
                description: description,
                target_type: targetType,
                priority: priority,
                assignee_id: assigneeId ? parseInt(assigneeId) : null,
                assisting_dept_id: assistingDeptId ? parseInt(assistingDeptId) : null,
                due_date: dueDate ? new Date(dueDate).toISOString() : null,
                note: note || undefined
            });
            Common.showToast('Đã hoàn thiện & phê duyệt đề xuất thành nhiệm vụ chính thức!', 'success');
            this.closeApproveProposalModal();
            this.openTaskDetail(taskId);
            this.loadTasks();
        } catch (err) {
            Common.showToast(err.message || 'Lỗi phê duyệt đề xuất', 'error');
        }
    },

    // ----------------------------------------------------
    // MODAL CHỈNH SỬA & TRÌNH DUYỆT LẠI ĐỀ XUẤT HANDLERS
    // ----------------------------------------------------
    openResubmitProposalModal(task) {
        document.getElementById('resubmitProposalTaskId').value = task.id;

        // Trích xuất ý kiến phản hồi mới nhất
        let feedback = 'Lãnh đạo yêu cầu bổ sung thông tin phương án/dự toán chi tiết.';
        if (task.comments && task.comments.length > 0) {
            const changeComment = task.comments.slice().reverse().find(c => c.content && c.content.includes('[YÊU CẦU BỔ SUNG ĐỀ XUẤT]'));
            if (changeComment) {
                feedback = changeComment.content.replace('🔄 [YÊU CẦU BỔ SUNG ĐỀ XUẤT] Đề xuất cần hoàn thiện thêm. Ý kiến phản hồi: ', '');
            }
        }
        // Đếm số thứ tự lần gửi lại
        let resubmitCount = 0;
        if (task.action_logs && task.action_logs.length > 0) {
            resubmitCount = task.action_logs.filter(l => l.action === 'RESUBMIT_PROPOSAL').length;
        } else if (task.comments && task.comments.length > 0) {
            resubmitCount = task.comments.filter(c => c.content && c.content.includes('[TRÌNH DUYỆT LẠI ĐỀ XUẤT')).length;
        }
        const nextCount = resubmitCount + 1;
        const countText = `Trình duyệt lại lần ${nextCount}`;

        const hintEl = document.getElementById('resubmitFeedbackHint');
        if (hintEl) {
            hintEl.innerHTML = `
                <div>"${feedback}"</div>
                <div class="mt-1.5 flex items-center">
                    <span class="text-[10.5px] font-bold text-indigo-900 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 flex items-center space-x-1">
                        <i class="fa-solid fa-clock-rotate-left text-indigo-700"></i>
                        <span>${countText}</span>
                    </span>
                </div>
            `;
        }

        const titleInput = document.getElementById('resubmitProposalTitle');
        if (titleInput) titleInput.value = task.title || '';

        const descInput = document.getElementById('resubmitProposalDescription');
        if (descInput) descInput.value = task.description || '';

        const prioritySelect = document.getElementById('resubmitProposalPriority');
        if (prioritySelect) prioritySelect.value = task.priority || 'TRUNG_BINH';

        const dueDateInput = document.getElementById('resubmitProposalDueDate');
        if (dueDateInput) dueDateInput.value = task.due_date ? task.due_date.split('T')[0] : '';

        const noteInput = document.getElementById('resubmitProposalNote');
        if (noteInput) noteInput.value = '';

        document.getElementById('modalResubmitProposal').classList.remove('hidden');
    },

    async openResubmitProposalModalById(taskId) {
        try {
            const task = (this.tasks && this.tasks.find(t => t.id === taskId)) || await API.getTaskDetail(taskId);
            if (task) {
                this.openResubmitProposalModal(task);
            }
        } catch (err) {
            console.error('Lỗi mở modal gửi lại đề xuất:', err);
            Common.showToast('Không thể mở bảng gửi lại đề xuất', 'error');
        }
    },

    closeResubmitProposalModal() {
        document.getElementById('modalResubmitProposal').classList.add('hidden');
    },

    async handleResubmitProposalSubmit(e) {
        e.preventDefault();
        const taskId = document.getElementById('resubmitProposalTaskId').value;
        const title = document.getElementById('resubmitProposalTitle').value.trim();
        const description = document.getElementById('resubmitProposalDescription').value.trim();
        const priority = document.getElementById('resubmitProposalPriority').value;
        const dueDate = document.getElementById('resubmitProposalDueDate').value || null;
        const note = document.getElementById('resubmitProposalNote').value.trim();

        if (!title) {
            Common.showToast('Vui lòng nhập tiêu đề đề xuất!', 'error');
            return;
        }

        try {
            await API.resubmitTaskProposal(taskId, {
                title: title,
                description: description,
                priority: priority,
                due_date: dueDate ? new Date(dueDate).toISOString() : null,
                resubmit_note: note || undefined
            });
            Common.showToast('Đã gửi lại đề xuất thành công! Đang chờ Lãnh đạo xem xét.', 'success');
            this.closeResubmitProposalModal();
            this.openTaskDetail(taskId);
            this.loadTasks();
        } catch (err) {
            Common.showToast(err.message || 'Lỗi gửi lại đề xuất', 'error');
        }
    },

    // ----------------------------------------------------
    // MODAL NHẬP LÝ DO ĐA NĂNG HANDLERS
    // ----------------------------------------------------
    openReasonPrompt(actionType, taskId) {
        document.getElementById('reasonPromptActionType').value = actionType;
        document.getElementById('reasonPromptTaskId').value = taskId;
        document.getElementById('reasonPromptInput').value = '';

        const titleText = document.getElementById('reasonPromptTitleText');
        const descText = document.getElementById('reasonPromptDescription');
        const icon = document.getElementById('reasonPromptIcon');
        const btn = document.getElementById('reasonPromptSubmitBtn');

        if (actionType === 'REJECT_ASSIGNMENT') {
            titleText.innerText = 'Từ Chối Tiếp Nhận Nhiệm Vụ';
            descText.innerText = 'Vui lòng nêu rõ lý do từ chối nhận việc (quá tải, sai chuyên môn, trùng lịch công tác...) để Lãnh đạo xem xét phân bổ lại:';
            icon.className = 'fa-solid fa-user-xmark text-red-600';
            btn.className = 'px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-xs transition flex items-center space-x-1.5';
        } else if (actionType === 'REJECT_PROPOSAL') {
            titleText.innerText = 'Bác Bỏ Đề Xuất Sáng Kiến';
            descText.innerText = 'Vui lòng cung cấp lý do bác bỏ đề xuất để thông báo và giải thích cho cán bộ đề xuất:';
            icon.className = 'fa-solid fa-ban text-red-600';
            btn.className = 'px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-xs transition flex items-center space-x-1.5';
        } else if (actionType === 'REQUEST_PROPOSAL_CHANGES') {
            titleText.innerText = 'Yêu Cầu Bổ Sung / Chỉnh Sửa Đề Xuất';
            descText.innerText = 'Vui lòng nhập ý kiến chỉ đạo, các điểm cần làm rõ hoặc bổ sung trước khi phê duyệt:';
            icon.className = 'fa-solid fa-rotate-left text-amber-600';
            btn.className = 'px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shadow-xs transition flex items-center space-x-1.5';
        }

        document.getElementById('modalReasonPrompt').classList.remove('hidden');
    },

    closeReasonPromptModal() {
        document.getElementById('modalReasonPrompt').classList.add('hidden');
    },

    async handleReasonPromptSubmit(e) {
        e.preventDefault();
        const actionType = document.getElementById('reasonPromptActionType').value;
        const taskId = document.getElementById('reasonPromptTaskId').value;
        const inputVal = document.getElementById('reasonPromptInput').value.trim();

        if (!inputVal) {
            Common.showToast('Vui lòng nhập lý do cụ thể!', 'warning');
            return;
        }

        try {
            if (actionType === 'REJECT_ASSIGNMENT') {
                await API.rejectTaskAssignment(taskId, inputVal);
                Common.showToast('Đã gửi báo cáo từ chối tiếp nhận nhiệm vụ!', 'success');
            } else if (actionType === 'REJECT_PROPOSAL') {
                await API.rejectTaskProposal(taskId, inputVal);
                Common.showToast('Đã bác bỏ đề xuất thành công!', 'success');
            } else if (actionType === 'REQUEST_PROPOSAL_CHANGES') {
                await API.requestProposalChanges(taskId, inputVal);
                Common.showToast('Đã gửi yêu cầu chỉnh sửa đề xuất!', 'success');
            }

            this.closeReasonPromptModal();
            await this.openTaskDetailModal(taskId);
            this.loadTasks();
        } catch (err) {
            Common.showToast(err.message || 'Lỗi xử lý yêu cầu', 'error');
        }
    },

    // ----------------------------------------------------
    // KPI AUDIT LOGS MODAL HANDLER
    // ----------------------------------------------------
    async openKpiAuditModal(userId = null, deptId = null) {
        const modal = document.getElementById('modalKpiAuditLogs');
        const container = document.getElementById('kpiAuditLogsContainer');
        if (!modal || !container) return;

        modal.classList.remove('hidden');
        container.innerHTML = `
            <div class="flex items-center justify-center py-8 text-slate-400">
                <i class="fa-solid fa-spinner fa-spin mr-2"></i> Đang nạp nhật ký kiểm toán điểm KPI...
            </div>
        `;

        try {
            const logs = await API.getKpiAuditLogs({ user_id: userId, dept_id: deptId, limit: 50 });
            if (!logs || logs.length === 0) {
                container.innerHTML = `
                    <div class="text-center py-10 text-slate-400 space-y-2">
                        <i class="fa-solid fa-clipboard-check text-3xl text-slate-300"></i>
                        <p class="font-bold text-slate-600">Chưa có vết tính điểm phát sinh trong chu kỳ này</p>
                        <p class="text-[11px] text-slate-400">Vết tính điểm sẽ tự động ghi nhận khi bạn hoàn thành nhiệm vụ 100% hoặc được phê duyệt sáng kiến.</p>
                    </div>
                `;
                return;
            }

            container.innerHTML = `
                <div class="overflow-x-auto">
                    <table class="w-full text-left border-collapse">
                        <thead>
                            <tr class="border-b border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-600 uppercase">
                                <th class="py-2.5 px-3">Thời gian</th>
                                <th class="py-2.5 px-3">Đối tượng</th>
                                <th class="py-2.5 px-3">Loại điểm</th>
                                <th class="py-2.5 px-3">Giá trị</th>
                                <th class="py-2.5 px-3">Phiên bản / Bằng chứng</th>
                                <th class="py-2.5 px-3 text-center">Trạng thái</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                            ${logs.map(l => {
                                const isPositive = l.score_value >= 0;
                                const valBadge = isPositive 
                                    ? `<span class="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-black">+${l.score_value}</span>`
                                    : `<span class="px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-black">${l.score_value}</span>`;
                                return `
                                    <tr class="hover:bg-slate-50/80 transition">
                                        <td class="py-2 px-3 text-slate-500 font-mono text-[11px] whitespace-nowrap">${l.created_at ? new Date(l.created_at).toLocaleString('vi-VN') : '--'}</td>
                                        <td class="py-2 px-3 font-bold text-slate-900">${l.user_name} <span class="text-[10px] text-slate-400 font-normal">(${l.department_code || 'Toàn trường'})</span></td>
                                        <td class="py-2 px-3"><span class="px-2 py-0.5 rounded-full bg-blue-50 text-blue-900 text-[10.5px] font-bold">${l.score_type}</span></td>
                                        <td class="py-2 px-3">${valBadge}</td>
                                        <td class="py-2 px-3">
                                            <div class="font-mono text-[10.5px] text-indigo-700 font-bold">${l.formula_version}</div>
                                            <div class="text-[10.5px] text-slate-500 truncate max-w-xs" title="${l.evidence || ''}">${l.evidence || '--'}</div>
                                        </td>
                                        <td class="py-2 px-3 text-center">
                                            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${l.is_final ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}">
                                                ${l.is_final ? 'Chốt kỳ' : 'Tạm tính'}
                                            </span>
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        } catch (err) {
            container.innerHTML = `
                <div class="p-4 bg-rose-50 text-rose-700 rounded-xl text-xs font-semibold">
                    <i class="fa-solid fa-circle-exclamation mr-1"></i> Lỗi khi tải nhật ký kiểm toán: ${err.message || 'Không xác định'}
                </div>
            `;
        }
    },

    closeKpiAuditModal() {
        const modal = document.getElementById('modalKpiAuditLogs');
        if (modal) modal.classList.add('hidden');
    },

    // ----------------------------------------------------
    // WORKLOAD & ESCALATE ALERTS MODAL HANDLER
    // ----------------------------------------------------
    async openWorkloadAlertsModal(deptId = null) {
        const modal = document.getElementById('modalWorkloadAlertsDetail');
        const content = document.getElementById('workloadAlertsModalContent');
        if (!modal || !content) return;

        modal.classList.remove('hidden');
        content.innerHTML = `
            <div class="flex items-center justify-center py-8 text-slate-400">
                <i class="fa-solid fa-spinner fa-spin mr-2"></i> Đang phân tích tình trạng quá tải & hàng đợi Escalate...
            </div>
        `;

        try {
            const data = await API.getWorkloadAlerts(deptId);
            const escQueue = data.escalate_queue || [];
            const overloadStaff = data.overload_alerts || [];

            content.innerHTML = `
                <div class="space-y-4">
                    <!-- Khối 1: Cán bộ có nguy cơ hoặc đang quá tải (>120%) -->
                    <div class="bg-purple-50/60 border border-purple-200/80 rounded-2xl p-4 shadow-2xs">
                        <div class="flex items-center justify-between pb-2.5 mb-3 border-b border-purple-200">
                            <div class="flex items-center space-x-2">
                                <span class="w-2.5 h-2.5 rounded-full bg-purple-600 animate-pulse"></span>
                                <h4 class="font-bold text-sm text-purple-950">1. Cán Bộ Đang Quá Tải Hoặc Gánh Nhiều Việc (${overloadStaff.length})</h4>
                            </div>
                            <span class="text-[11px] font-bold px-2 py-0.5 rounded-full bg-purple-200 text-purple-900">Định mức chuẩn: 3 việc</span>
                        </div>
                        ${overloadStaff.length === 0 ? `
                            <p class="text-xs text-slate-500 italic py-2">Hiện tại nhân sự phân bổ rất đồng đều, không có ai quá tải trên 120%.</p>
                        ` : `
                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                ${overloadStaff.map(s => `
                                    <div class="p-3 bg-white border border-purple-100 rounded-xl shadow-2xs flex items-center justify-between">
                                        <div>
                                            <div class="font-bold text-xs text-slate-900">${s.full_name} <span class="text-slate-500 font-normal">(@${s.username})</span></div>
                                            <div class="text-[11px] text-purple-800 font-semibold mt-0.5">
                                                Đang gánh: <b>${s.active_tasks_count} việc</b> (Tải: <b>${s.workload_index}%</b>)
                                            </div>
                                        </div>
                                        <div>
                                            ${s.is_overload 
                                                ? `<span class="px-2 py-1 bg-purple-100 text-purple-900 border border-purple-300 rounded-lg font-bold text-[10px] flex items-center gap-1 shadow-2xs">🛡️ KHIÊN BẬT</span>` 
                                                : `<span class="px-2 py-1 bg-slate-100 text-slate-700 rounded-lg font-semibold text-[10px]">Tiệm cận tải</span>`}
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        `}
                    </div>

                    <!-- Khối 2: Hàng đợi Escalate (Task chưa phân công sắp/đã quá 24h-48h-72h) -->
                    <div class="bg-amber-50/60 border border-amber-200/80 rounded-2xl p-4 shadow-2xs">
                        <div class="flex items-center justify-between pb-2.5 mb-3 border-b border-amber-200">
                            <div class="flex items-center space-x-2">
                                <span class="w-2.5 h-2.5 rounded-full bg-amber-600 animate-ping"></span>
                                <h4 class="font-bold text-sm text-amber-950">2. Hàng Đợi Escalate — Nhiệm Vụ Chưa Phân Công (${escQueue.length})</h4>
                            </div>
                            <span class="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-200 text-amber-900">Mốc phạt: 24h / 48h / 72h</span>
                        </div>
                        ${escQueue.length === 0 ? `
                            <p class="text-xs text-slate-500 italic py-2">Tất cả nhiệm vụ đều đã được phân công kịp thời, không có nguy cơ phạt trễ.</p>
                        ` : `
                            <div class="space-y-2">
                                ${escQueue.map(item => {
                                    let badgeColor = 'bg-slate-100 text-slate-700';
                                    if (item.level === 'CRITICAL_72H') badgeColor = 'bg-rose-600 text-white font-black';
                                    else if (item.level === 'WARNING_48H') badgeColor = 'bg-amber-500 text-white font-bold';
                                    else if (item.level === 'ALERT_24H') badgeColor = 'bg-amber-200 text-amber-900 font-bold';
                                    return `
                                        <div class="p-2.5 bg-white border border-amber-100 rounded-xl shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                            <div>
                                                <div class="font-bold text-xs text-slate-900">${item.title}</div>
                                                <div class="text-[10.5px] text-rose-700 font-semibold mt-0.5">
                                                    <i class="fa-solid fa-clock mr-1"></i>Đã trôi qua: <b>${item.hours_elapsed} giờ</b> — ${item.penalty_desc}
                                                </div>
                                            </div>
                                            <div class="flex items-center space-x-2">
                                                <span class="px-2 py-1 rounded-lg text-[10px] ${badgeColor}">${item.level}</span>
                                                <button onclick="TasksPage.closeWorkloadAlertsModal(); TasksPage.openTaskDetail(${item.task_id});" class="px-2.5 py-1 bg-blue-800 text-white rounded-lg text-xs font-bold hover:bg-blue-900 cursor-pointer">
                                                    Giao Việc Ngay
                                                </button>
                                            </div>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        `}
                    </div>
                </div>
            `;
        } catch (err) {
            content.innerHTML = `
                <div class="p-4 bg-rose-50 text-rose-700 rounded-xl text-xs font-semibold">
                    <i class="fa-solid fa-circle-exclamation mr-1"></i> Lỗi khi tải dữ liệu cảnh báo: ${err.message || 'Không xác định'}
                </div>
            `;
        }
    },

    closeWorkloadAlertsModal() {
        const modal = document.getElementById('modalWorkloadAlertsDetail');
        if (modal) modal.classList.add('hidden');
    },

    // ----------------------------------------------------
    // PERIOD GOVERNANCE & SNAPSHOT HUB (3 SHEETS)
    // ----------------------------------------------------
    _governanceTab: 'MONTH',
    _periodCache: {},


};
