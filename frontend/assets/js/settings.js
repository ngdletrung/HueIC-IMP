// Settings Page Logic (settings.html)
const SettingsPage = {
    departments: [],
    users: [],
    workflows: [],
    currentSubTab: 'departments',
    deptViewMode: 'table', // 'table' (mặc định) | 'cards'
    selectedPermUserId: null,
    permissionCatalog: null,
    currentEditingPermissions: [],
    modalWorkflowSteps: [],

    async init() {
        Common.init('settings');

        try {
            await this.loadInitialData();
            const startTab = this.applySubtabGuards();
            this.switchSubTab(startTab);
        } catch (e) {
            console.error('Lỗi khởi tạo Settings:', e);
            Common.showToast('Không thể nạp dữ liệu thiết lập', 'error');
        }
    },

    applySubtabGuards() {
        const canDepts = Common.hasPermission('dept:manage');
        const canUsers = Common.hasPermission('user:manage');
        const canPerms = Common.hasPermission('perm:manage');

        const elDepts = document.getElementById('subnav-departments');
        const elUsers = document.getElementById('subnav-users');
        const elPerms = document.getElementById('subnav-permissions');

        if (elDepts) elDepts.style.display = canDepts ? '' : 'none';
        if (elUsers) elUsers.style.display = canUsers ? '' : 'none';
        if (elPerms) elPerms.style.display = canPerms ? '' : 'none';

        if (canDepts) return 'departments';
        if (canUsers) return 'users';
        if (canPerms) return 'permissions';
        return 'workflows';
    },

    async loadInitialData() {
        const [depts, users] = await Promise.all([
            API.getDepartments(),
            API.getUsers()
        ]);
        this.departments = depts;
        this.users = users;
        this.updateDynamicDeptCounts();

        const formUserDeptSelect = document.getElementById('formUserDept');
        if (formUserDeptSelect) {
            formUserDeptSelect.innerHTML = '<option value="">-- Thuộc Đơn vị / Phòng / Khoa --</option>' +
                this.departments.map(d => `<option value="${d.id}">${d.parent_id ? '↳ ' : ''}${d.name} (${d.code})</option>`).join('');
        }

        const filterUserDept = document.getElementById('filterUserDeptSelect');
        if (filterUserDept) {
            filterUserDept.innerHTML = '<option value="">-- Tất cả Đơn vị / Phòng / Khoa --</option>' +
                this.departments.map(d => `<option value="${d.id}">${d.parent_id ? '↳ ' : ''}${d.name} (${d.code})</option>`).join('');
        }

        const filterWfDeptSelect = document.getElementById('filterWorkflowDept');
        if (filterWfDeptSelect) {
            filterWfDeptSelect.innerHTML = '<option value="">Tất cả đơn vị</option>' +
                '<option value="global">🌐 Dùng chung toàn trường</option>' +
                this.departments.map(d => `<option value="${d.id}">${d.name} (${d.code})</option>`).join('');
        }

        const formWfDeptSelect = document.getElementById('formWorkflowDept');
        if (formWfDeptSelect) {
            formWfDeptSelect.innerHTML = '<option value="">🌐 Dùng chung toàn trường</option>' +
                this.departments.map(d => `<option value="${d.id}">${d.name} (${d.code})</option>`).join('');
        }
    },

    updateDynamicDeptCounts() {
        const count = Array.isArray(this.departments) ? this.departments.length : 0;
        
        const subnavCountEl = document.getElementById('subnavDeptCount');
        if (subnavCountEl) subnavCountEl.innerText = count;

        const subnavLabelEl = document.getElementById('subnavDeptLabel');
        if (subnavLabelEl && !subnavCountEl) subnavLabelEl.innerText = `1. Phòng / Khoa (${count} Đơn vị)`;

        const subtitleEl = document.getElementById('settingsDeptCountSubtitle');
        if (subtitleEl) subtitleEl.innerText = count;

        const countLabel = document.getElementById('deptCountLabel');
        if (countLabel) countLabel.innerText = `${count} Đơn vị`;

        const optPermAll = document.querySelector('#filterPermUserDept option[value=""]');
        if (optPermAll) optPermAll.innerText = `-- Tất cả ${count} Đơn vị HueIC --`;
    },

    switchSubTab(subTabId) {
        this.currentSubTab = subTabId;

        // Xóa active state của tất cả các nút, reset về inactive
        document.querySelectorAll('.settings-subnav').forEach(btn => {
            const activeClasses = (btn.dataset.active || '').split(' ').filter(Boolean);
            btn.classList.remove(...activeClasses);
            btn.classList.remove('bg-white', 'text-blue-900', 'shadow-xs', 'shadow-sm');
            btn.classList.add('text-slate-500');
            btn.classList.remove('hover:bg-slate-300/60'); // tạm xóa để re-add
            btn.classList.add('hover:bg-slate-300/60', 'hover:text-slate-800');
        });

        // Apply màu đặc trưng cho tab active
        const activeBtn = document.getElementById(`subnav-${subTabId}`);
        if (activeBtn) {
            const activeClasses = (activeBtn.dataset.active || 'bg-blue-700 text-white shadow-sm').split(' ').filter(Boolean);
            activeBtn.classList.remove('text-slate-500', 'hover:bg-slate-300/60', 'hover:text-slate-800', 'text-slate-600');
            activeBtn.classList.add(...activeClasses);
        }

        document.querySelectorAll('.settings-subpane').forEach(pane => pane.classList.add('hidden'));
        const activePane = document.getElementById(`subpane-${subTabId}`);
        if (activePane) activePane.classList.remove('hidden');

        if (subTabId === 'departments') this.loadDepartments();
        if (subTabId === 'users') this.loadUsersTable();
        if (subTabId === 'permissions') this.loadPermissionsView();
        if (subTabId === 'workflows') this.loadWorkflows();
        if (subTabId === 'themes') this.renderThemesConfig();
    },

    // 1. Department Logic
    setDeptViewMode(mode) {
        this.deptViewMode = mode;
        const btnCards = document.getElementById('btnViewCards');
        const btnTable = document.getElementById('btnViewTable');
        const gridView = document.getElementById('departmentsGrid');
        const tableView = document.getElementById('departmentsTableContainer');

        if (mode === 'cards') {
            btnCards?.classList.add('bg-white', 'text-blue-800', 'shadow-xs');
            btnCards?.classList.remove('text-slate-500');
            btnTable?.classList.remove('bg-white', 'text-blue-800', 'shadow-xs');
            btnTable?.classList.add('text-slate-500');

            gridView?.classList.remove('hidden');
            tableView?.classList.add('hidden');
        } else {
            btnTable?.classList.add('bg-white', 'text-blue-800', 'shadow-xs');
            btnTable?.classList.remove('text-slate-500');
            btnCards?.classList.remove('bg-white', 'text-blue-800', 'shadow-xs');
            btnCards?.classList.add('text-slate-500');

            gridView?.classList.add('hidden');
            tableView?.classList.remove('hidden');
        }
        this.renderDepartmentsList();
    },

    filterDepartments() {
        this.renderDepartmentsList();
    },

    async loadDepartments() {
        this.departments = await API.getDepartments();
        this.updateDynamicDeptCounts();
        this.renderDepartmentsList();
    },

    renderDepartmentsList() {
        const query = document.getElementById('searchDeptInput')?.value.trim().toLowerCase() || '';
        const filterType = document.getElementById('filterDeptType')?.value || '';

        const list = this.departments.filter(d => {
            const matchQuery = d.name.toLowerCase().includes(query) || 
                               d.code.toLowerCase().includes(query) ||
                               (d.description && d.description.toLowerCase().includes(query)) ||
                               (d.parent_name && d.parent_name.toLowerCase().includes(query));
            
            let matchType = true;
            if (filterType === 'LEVEL1') {
                matchType = !d.parent_id;
            } else if (filterType === 'LEVEL2') {
                matchType = !!d.parent_id;
            } else if (filterType) {
                matchType = d.type === filterType;
            }

            return matchQuery && matchType;
        });

        const countLabel = document.getElementById('deptCountLabel');
        if (countLabel) countLabel.innerText = `Hiển thị ${list.length} / ${this.departments.length} Đơn vị`;

        const getTypeBadge = (type) => {
            const t = (type || 'DEPARTMENT').toUpperCase();
            if (t === 'FACULTY') return '<span class="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-bold text-[10.5px]">🎓 Khoa Đào Tạo</span>';
            if (t === 'DEPARTMENT') return '<span class="px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-bold text-[10.5px]">🏢 Phòng Chức Năng</span>';
            if (t === 'CENTER') return '<span class="px-2 py-0.5 rounded bg-purple-100 text-purple-800 font-bold text-[10.5px]">🏛️ Trung Tâm</span>';
            if (t === 'SECTION') return '<span class="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-bold text-[10.5px]">👥 Tổ / Ban</span>';
            if (t === 'WORKSHOP') return '<span class="px-2 py-0.5 rounded bg-teal-100 text-teal-800 font-bold text-[10.5px]">⚙️ Xưởng / Lab</span>';
            if (t === 'BGH') return '<span class="px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 font-bold text-[10.5px]">🏛️ Ban Giám Hiệu</span>';
            return '<span class="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-bold text-[10.5px]">Đơn Vị</span>';
        };

        // Render Cards View
        const grid = document.getElementById('departmentsGrid');
        if (grid) {
            if (list.length === 0) {
                grid.innerHTML = `<div class="col-span-3 text-center py-10 text-slate-400 text-xs">Không tìm thấy đơn vị nào phù hợp.</div>`;
            } else {
                grid.innerHTML = list.map(d => `
                    <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-xs hover:border-blue-300 transition flex flex-col justify-between ${d.parent_id ? 'border-l-4 border-l-amber-500' : ''}">
                        <div>
                            <div class="flex justify-between items-start mb-2">
                                <div class="flex items-center space-x-1.5">
                                    <span class="px-2.5 py-1 ${d.parent_id ? 'bg-amber-50 text-amber-900 border-amber-200' : 'bg-blue-50 text-blue-900 border-blue-200'} font-mono font-bold text-xs rounded-lg border">
                                        ${d.code}
                                    </span>
                                    ${getTypeBadge(d.type)}
                                </div>
                                <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${d.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}">
                                    ${d.is_active ? 'Hoạt động' : 'Tạm ngưng'}
                                </span>
                            </div>
                            <h4 class="font-bold text-slate-900 text-sm mb-1">${d.parent_id ? '↳ ' : ''}${d.name}</h4>
                            ${d.parent_name ? `<div class="text-[11px] text-blue-800 font-bold bg-blue-50/80 px-2 py-0.5 rounded mb-2 inline-block">Trực thuộc: [${d.parent_code}] ${d.parent_name}</div>` : ''}
                            <p class="text-xs text-slate-500 line-clamp-2 mb-3">${d.description || 'Chưa có mô tả chức năng nhiệm vụ.'}</p>
                        </div>
                        
                        <div class="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                            <div class="text-[11px] text-slate-400 space-y-0.5">
                                ${d.phone ? `<div><i class="fa-solid fa-phone text-[9px] mr-1"></i> ${d.phone}</div>` : ''}
                                ${d.email ? `<div><i class="fa-solid fa-envelope text-[9px] mr-1"></i> ${d.email}</div>` : ''}
                            </div>
                            <div class="inline-flex items-center space-x-1">
                                <button onclick="SettingsPage.openEditDeptModal(${d.id})" class="px-2.5 py-1 bg-blue-50 hover:bg-blue-800 hover:text-white text-blue-700 rounded-lg font-semibold transition" title="Chỉnh sửa">
                                    <i class="fa-solid fa-pen-to-square"></i>
                                </button>
                                <button onclick="SettingsPage.deleteDepartment(${d.id}, '${d.name.replace(/'/g, "\\'")}')" class="px-2.5 py-1 bg-red-50 hover:bg-red-600 hover:text-white text-red-600 rounded-lg font-semibold transition" title="Xóa">
                                    <i class="fa-solid fa-trash-can"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                `).join('');
            }
        }

        // Render Table View (Hỗ trợ phân cấp cây đa tầng)
        const tbody = document.getElementById('departmentsTableBody');
        if (tbody) {
            if (list.length === 0) {
                tbody.innerHTML = `<tr><td colspan="9" class="text-center py-6 text-slate-400 text-xs">Không có dữ liệu phù hợp.</td></tr>`;
            } else {
                tbody.innerHTML = list.map((d, index) => {
                    const isChild = !!d.parent_id;
                    return `
                        <tr class="hover:bg-slate-50 border-b border-slate-100 text-xs ${isChild ? 'bg-slate-50/40' : ''}">
                            <td class="px-4 py-3 text-center text-slate-400 font-mono whitespace-nowrap">${index + 1}</td>
                            <td class="px-4 py-3 font-mono font-bold whitespace-nowrap">
                                <span class="px-2 py-0.5 ${isChild ? 'bg-amber-50 text-amber-900 border-amber-200' : 'bg-blue-50 text-blue-900 border-blue-200'} border rounded">${d.code}</span>
                            </td>
                            <td class="px-4 py-3 whitespace-nowrap">
                                ${isChild ? `
                                    <div class="pl-4 flex items-center space-x-1.5">
                                        <span class="text-amber-600 font-bold">↳</span>
                                        <span class="font-bold text-slate-800">${d.name}</span>
                                    </div>
                                ` : `
                                    <span class="font-bold text-slate-900 text-[13px]">${d.name}</span>
                                `}
                            </td>
                            <td class="px-4 py-3 whitespace-nowrap">
                                ${getTypeBadge(d.type)}
                            </td>
                            <td class="px-4 py-3 whitespace-nowrap">
                                ${isChild ? `
                                    <span class="px-2 py-0.5 bg-blue-50 text-blue-800 border border-blue-200 rounded font-bold text-[11px]">
                                        [${d.parent_code}] ${d.parent_name || 'Cấp trên'}
                                    </span>
                                ` : `
                                    <span class="text-slate-400 font-medium italic text-[11px]">Trực thuộc BGH</span>
                                `}
                            </td>
                            <td class="px-4 py-3 text-slate-600 font-mono whitespace-nowrap">${d.phone || '-'}</td>
                            <td class="px-4 py-3 text-slate-600 whitespace-nowrap">${d.email || '-'}</td>
                            <td class="px-4 py-3 text-center whitespace-nowrap">
                                <span class="inline-block px-2.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap ${d.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}">
                                    ${d.is_active ? 'Hoạt động' : 'Tạm ngưng'}
                                </span>
                            </td>
                            <td class="px-4 py-3 text-right whitespace-nowrap">
                                <div class="inline-flex items-center space-x-1.5">
                                    <button onclick="SettingsPage.openEditDeptModal(${d.id})" class="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-800 hover:text-white text-blue-700 rounded-lg text-xs font-bold transition flex items-center space-x-1" title="Sửa">
                                        <i class="fa-solid fa-pen-to-square"></i>
                                        <span>Sửa</span>
                                    </button>
                                    <button onclick="SettingsPage.deleteDepartment(${d.id}, '${d.name.replace(/'/g, "\\'")}')" class="px-2.5 py-1.5 bg-red-50 hover:bg-red-600 hover:text-white text-red-600 rounded-lg text-xs font-bold transition flex items-center space-x-1" title="Xóa">
                                        <i class="fa-solid fa-trash-can"></i>
                                        <span>Xóa</span>
                                    </button>
                                </div>
                            </td>
                        </tr>
                    `;
                }).join('');
            }
        }
    },

    populateDeptParentSelect(selectedParentId = null, currentDeptId = null) {
        const sel = document.getElementById('formDeptParent');
        if (!sel) return;

        // Chỉ hiển thị các đơn vị Cấp 1 (hoặc không phải chính nó và không phải con của nó)
        const parentCandidates = (this.departments || []).filter(d => {
            if (currentDeptId && d.id === currentDeptId) return false;
            if (d.parent_id) return false; // Chỉ cho phép trực thuộc đơn vị Cấp 1
            return true;
        });

        sel.innerHTML = '<option value="">🏛️ Đơn vị Cấp 1 (Trực thuộc Ban Giám Hiệu)</option>' +
            parentCandidates.map(d => `<option value="${d.id}" ${selectedParentId == d.id ? 'selected' : ''}>${d.name} (${d.code})</option>`).join('');
    },

    openCreateDeptModal() {
        document.getElementById('formDept').reset();
        document.getElementById('formDeptId').value = '';
        document.getElementById('modalDeptTitle').innerText = 'Thêm Mới Đơn Vị / Phòng / Khoa / Tổ / Ban';
        document.getElementById('formDeptCode').readOnly = false;
        
        this.populateDeptParentSelect();
        const typeSelect = document.getElementById('formDeptType');
        if (typeSelect) typeSelect.value = 'DEPARTMENT';

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
        
        this.populateDeptParentSelect(dept.parent_id, dept.id);
        const typeSelect = document.getElementById('formDeptType');
        if (typeSelect) typeSelect.value = dept.type || 'DEPARTMENT';

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
        
        const parentVal = document.getElementById('formDeptParent')?.value;
        const parent_id = parentVal ? parseInt(parentVal) : null;
        const type = document.getElementById('formDeptType')?.value || 'DEPARTMENT';

        const btn = document.getElementById('btnSubmitDept');
        btn.disabled = true;
        btn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin mr-1"></i> Đang lưu...`;

        try {
            if (id) {
                await API.updateDepartment(id, { name, phone, email, description, parent_id, type });
                Common.showToast('Cập nhật thông tin đơn vị thành công!', 'success');
            } else {
                await API.createDepartment({ code, name, phone, email, description, parent_id, type });
                Common.showToast('Thêm mới đơn vị thành công!', 'success');
            }
            this.closeDeptModal();
            await this.loadInitialData();
            this.loadDepartments();
        } catch (err) {
            Common.showToast(err.message || 'Lỗi lưu thông tin đơn vị', 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = `Lưu Đơn Vị`;
        }
    },

    async deleteDepartment(deptId, deptName) {
        if (!confirm(`Bạn có chắc chắn muốn xóa đơn vị "${deptName}"?\nLưu ý: Không thể xóa nếu đang có cán bộ hoặc tổ trực thuộc.`)) return;

        try {
            const res = await API.deleteDepartment(deptId);
            Common.showToast(res.message || `Đã xóa đơn vị thành công!`, 'success');
            await this.loadInitialData();
            this.loadDepartments();
        } catch (err) {
            Common.showToast(err.message || 'Lỗi khi xóa đơn vị', 'error');
        }
    },

    // 2. User Management Logic
    getUserRoleBadge(role) {
        const r = (role || 'STAFF').toUpperCase();
        if (r === 'SUPERADMIN') {
            return '<span class="inline-flex items-center px-2 py-0.5 rounded-md font-bold bg-purple-100 text-purple-900 border border-purple-200 text-[10.5px]"><i class="fa-solid fa-crown mr-1 text-[9px] text-purple-600"></i>1. Nhóm Quản Trị</span>';
        }
        if (r === 'BGH') {
            return '<span class="inline-flex items-center px-2 py-0.5 rounded-md font-bold bg-indigo-100 text-indigo-900 border border-indigo-200 text-[10.5px]"><i class="fa-solid fa-building-columns mr-1 text-[9px] text-indigo-600"></i>2. BGH</span>';
        }
        if (r === 'DEPT_HEAD') {
            return '<span class="inline-flex items-center px-2 py-0.5 rounded-md font-bold bg-blue-100 text-blue-900 border border-blue-200 text-[10.5px]"><i class="fa-solid fa-user-tie mr-1 text-[9px] text-blue-600"></i>3. Quản Lý</span>';
        }
        if (r === 'DEPT_VICE') {
            return '<span class="inline-flex items-center px-2 py-0.5 rounded-md font-bold bg-blue-50 text-blue-800 border border-blue-200 text-[10.5px]"><i class="fa-solid fa-briefcase mr-1 text-[9px] text-blue-600"></i>3. Quản Lý (Phó ĐV)</span>';
        }
        return '<span class="inline-flex items-center px-2 py-0.5 rounded-md font-bold bg-slate-100 text-slate-700 border border-slate-200 text-[10.5px]"><i class="fa-solid fa-user mr-1 text-[9px] text-slate-500"></i>4. Nhân Viên</span>';
    },

    async loadUsersTable() {
        try {
            this.users = await API.getUsers();
            this.filterUsers();
        } catch (e) {
            Common.showToast('Lỗi tải danh sách nhân sự', 'error');
        }
    },

    filterUsers() {
        const query = (document.getElementById('filterUserSearch')?.value || '').toLowerCase().trim();
        const roleFilter = document.getElementById('filterUserRole')?.value || '';
        const deptFilter = document.getElementById('filterUserDeptSelect')?.value || '';

        const list = (this.users || []).filter(u => {
            const matchQuery = !query || 
                (u.full_name && u.full_name.toLowerCase().includes(query)) ||
                (u.username && u.username.toLowerCase().includes(query)) ||
                (u.email && u.email.toLowerCase().includes(query)) ||
                (u.position && u.position.toLowerCase().includes(query));

            let matchRole = true;
            if (roleFilter) {
                if (roleFilter === 'MANAGEMENT') {
                    matchRole = u.role === 'DEPT_HEAD' || u.role === 'DEPT_VICE';
                } else {
                    matchRole = u.role === roleFilter;
                }
            }

            const matchDept = !deptFilter || (u.department_id && String(u.department_id) === String(deptFilter));

            return matchQuery && matchRole && matchDept;
        });

        const countLabel = document.getElementById('userCountLabel');
        if (countLabel) countLabel.innerText = `Hiển thị ${list.length} / ${(this.users || []).length} Cán bộ`;

        const tbody = document.getElementById('usersTableBody');
        if (!tbody) return;

        if (list.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center py-8 text-slate-400 text-xs">Không tìm thấy cán bộ phù hợp với bộ lọc.</td></tr>`;
            return;
        }

        tbody.innerHTML = list.map(u => `
            <tr class="hover:bg-slate-50 border-b border-slate-100 text-xs">
                <td class="px-4 py-3 font-semibold text-slate-800 whitespace-nowrap">
                    <div class="flex items-center space-x-2.5">
                        <div class="w-7 h-7 rounded-full bg-blue-50 text-blue-900 border border-blue-200 flex items-center justify-center font-black text-[10px]">
                            ${u.full_name ? u.full_name.charAt(0).toUpperCase() : 'U'}
                        </div>
                        <div>
                            <div class="font-bold text-slate-900">${u.full_name}</div>
                            ${!u.is_active ? '<span class="text-[10px] text-red-500 font-bold">(Đã khóa tài khoản)</span>' : ''}
                        </div>
                    </div>
                </td>
                <td class="px-4 py-3 font-mono text-slate-600 whitespace-nowrap">@${u.username}</td>
                <td class="px-4 py-3 text-slate-600 whitespace-nowrap">${u.email}</td>
                <td class="px-4 py-3 whitespace-nowrap">
                    ${u.department ? `<span class="font-semibold text-blue-900">${u.department.name}</span> <span class="text-xs text-slate-400">(${u.department.code})</span>` : '<span class="text-slate-400 italic">Chưa gán đơn vị</span>'}
                </td>
                <td class="px-4 py-3 whitespace-nowrap">
                    ${this.getUserRoleBadge(u.role)}
                </td>
                <td class="px-4 py-3 text-slate-600 whitespace-nowrap font-medium">${u.position || '-'}</td>
                <td class="px-4 py-3 text-right whitespace-nowrap">
                    <div class="inline-flex items-center space-x-1.5">
                        <button onclick="SettingsPage.openEditUserModal(${u.id})" class="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-800 hover:text-white text-blue-700 rounded-lg text-xs font-bold transition flex items-center space-x-1" title="Chỉnh sửa thông tin">
                            <i class="fa-solid fa-pen-to-square"></i>
                            <span>Sửa</span>
                        </button>
                        <button onclick="SettingsPage.toggleUserStatus(${u.id}, ${u.is_active})" class="p-1.5 px-2 ${u.is_active ? 'bg-slate-100 hover:bg-amber-50 text-slate-600 hover:text-amber-700' : 'bg-green-50 text-green-700 hover:bg-green-100'} rounded-lg text-xs font-bold transition" title="${u.is_active ? 'Khóa tài khoản' : 'Kích hoạt lại'}">
                            <i class="fa-solid ${u.is_active ? 'fa-user-lock' : 'fa-user-check'}"></i>
                        </button>
                        <button onclick="SettingsPage.deleteUser(${u.id}, '${u.full_name.replace(/'/g, "\\'")}')" class="p-1.5 px-2 bg-red-50 hover:bg-red-600 hover:text-white text-red-600 rounded-lg text-xs font-bold transition" title="Xóa tài khoản">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    },

    openCreateUserModal() {
        document.getElementById('formUser').reset();
        document.getElementById('formUserId').value = '';
        document.getElementById('modalUserTitle').innerText = 'Thêm Mới Cán Bộ / Giảng Viên';
        document.getElementById('formUserUsername').readOnly = false;
        document.getElementById('formUserPassword').required = true;
        document.getElementById('formUserPasswordLabel').innerText = 'Mật khẩu khởi tạo *';
        document.getElementById('modalUserForm').classList.remove('hidden');
    },

    async openEditUserModal(userId) {
        try {
            const user = await API.getUserDetail(userId);
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
            document.getElementById('formUserPasswordLabel').innerText = 'Đặt lại mật khẩu mới (Bỏ trống nếu giữ nguyên)';
            document.getElementById('modalUserTitle').innerText = `Chỉnh Sửa Cán Bộ: ${user.full_name}`;
            document.getElementById('modalUserForm').classList.remove('hidden');
        } catch (err) {
            Common.showToast('Lỗi lấy thông tin cán bộ', 'error');
        }
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
        const department_id = document.getElementById('formUserDept').value ? parseInt(document.getElementById('formUserDept').value) : null;
        const role = document.getElementById('formUserRole').value;
        const position = document.getElementById('formUserPosition').value.trim();
        const password = document.getElementById('formUserPassword').value;

        const btn = document.getElementById('btnSubmitUser');
        btn.disabled = true;
        btn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin mr-1"></i> Đang lưu...`;

        try {
            if (id) {
                const payload = { full_name, email, phone, department_id, role, position };
                if (password) payload.password = password;
                await API.updateUser(id, payload);
                Common.showToast('Cập nhật thông tin cán bộ thành công!', 'success');
            } else {
                const payload = { full_name, username, email, phone, department_id, role, position, password };
                await API.createUser(payload);
                Common.showToast('Tạo tài khoản cán bộ mới thành công!', 'success');
            }
            this.closeUserModal();
            await this.loadInitialData();
            this.loadUsersTable();
        } catch (err) {
            Common.showToast(err.message || 'Lỗi khi lưu thông tin cán bộ', 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = `Lưu Thông Tin`;
        }
    },

    async toggleUserStatus(userId, currentStatus) {
        const action = currentStatus ? 'khóa' : 'mở khóa';
        if (!confirm(`Bạn có chắc muốn ${action} tài khoản này?`)) return;

        try {
            await API.toggleUserActive(userId, !currentStatus);
            Common.showToast(`Đã ${action} tài khoản thành công!`, 'success');
            this.loadUsersTable();
        } catch (e) {
            Common.showToast('Lỗi thay đổi trạng thái tài khoản', 'error');
        }
    },

    async deleteUser(userId, userName) {
        if (!confirm(`Bạn có chắc chắn muốn xóa vĩnh viễn tài khoản "${userName}"?\nLưu ý: Các công việc liên quan sẽ được tự động giải phóng an toàn.`)) return;

        try {
            const res = await API.deleteUser(userId);
            Common.showToast(res.message || `Đã xóa tài khoản thành công!`, 'success');
            await this.loadInitialData();
            this.loadUsersTable();
        } catch (err) {
            Common.showToast(err.message || 'Lỗi khi xóa tài khoản', 'error');
        }
    },

    // 3. Permissions Matrix Logic (RBAC 3 Tầng Thực Tế)
    async loadPermissionsView() {
        try {
            const [catalog, presets, users, depts] = await Promise.all([
                API.getPermissionsCatalog(),
                API.getPermissionPresets(),
                API.getUsers(),
                API.getDepartments()
            ]);

            this.permissionCatalog = catalog || [];
            this.permissionPresets = presets || {};
            this.users = users || [];
            this.departments = depts || [];

            // Populate Department filter dropdown if empty
            const deptSelect = document.getElementById('filterPermUserDept');
            if (deptSelect && deptSelect.options.length <= 1 && Array.isArray(depts)) {
                depts.forEach(d => {
                    const opt = document.createElement('option');
                    opt.value = d.code;
                    opt.innerText = `[${d.code}] ${d.name}`;
                    deptSelect.appendChild(opt);
                });
            }

            this.renderPermRolesList();
            this.renderPermUsersList();

            // Khởi tạo mặc định ở Role Mode (Cấu hình quyền gốc chuẩn theo Role)
            this.currentRbacMode = 'role';
            this.selectPermRole(this.selectedPermRoleKey || 'bgh');
        } catch (e) {
            console.error('Lỗi loadPermissionsView:', e);
            Common.showToast('Lỗi tải cấu hình phân quyền', 'error');
        }
    },

    switchRbacMode(mode) {
        this.currentRbacMode = mode;
        const btnRole = document.getElementById('btnRbacModeRole');
        const btnUser = document.getElementById('btnRbacModeUser');
        const headerRole = document.getElementById('permRoleListHeader');
        const headerUser = document.getElementById('permUserListHeader');
        const listRole = document.getElementById('permRolesList');
        const listUser = document.getElementById('permUsersList');
        const helpText = document.getElementById('rbacModeHelpText');
        const btnSave = document.getElementById('btnSavePerms');

        // Helper: reset inactive button
        const resetBtn = (btn) => {
            if (!btn) return;
            const ac = (btn.dataset.active || '').split(' ').filter(Boolean);
            btn.classList.remove(...ac, 'bg-white', 'text-blue-900', 'shadow-xs', 'shadow-sm');
            btn.classList.add('text-slate-500', 'hover:bg-slate-200', 'hover:text-slate-800');
        };
        // Helper: activate button
        const activateBtn = (btn) => {
            if (!btn) return;
            const ac = (btn.dataset.active || 'bg-blue-700 text-white shadow-sm').split(' ').filter(Boolean);
            btn.classList.remove('text-slate-500', 'hover:bg-slate-200', 'hover:text-slate-800', 'text-slate-600');
            btn.classList.add(...ac);
        };

        if (mode === 'role') {
            resetBtn(btnUser);
            activateBtn(btnRole);

            headerRole?.classList.remove('hidden');
            listRole?.classList.remove('hidden');
            headerUser?.classList.add('hidden');
            listUser?.classList.add('hidden');

            if (helpText) helpText.innerText = '⚙️ Đang chỉnh sửa bộ quyền gốc & quyền truy cập Module cho toàn bộ Role';
            if (btnSave) {
                btnSave.onclick = () => SettingsPage.saveRolePermissions();
                btnSave.innerHTML = `<i class="fa-solid fa-floppy-disk mr-1"></i> Lưu Bộ Quyền Gốc Của Vai Trò`;
            }

            this.selectPermRole(this.selectedPermRoleKey || 'bgh');
        } else {
            resetBtn(btnRole);
            activateBtn(btnUser);

            headerRole?.classList.add('hidden');
            listRole?.classList.add('hidden');
            headerUser?.classList.remove('hidden');
            listUser?.classList.remove('hidden');

            if (helpText) helpText.innerText = '👤 Đang chỉnh sửa quyền tùy biến (Override / Cấp thêm) cho từng Cán bộ';
            if (btnSave) {
                btnSave.onclick = () => SettingsPage.saveUserPermissions();
                btnSave.innerHTML = `<i class="fa-solid fa-floppy-disk mr-1"></i> Lưu Cấu Hình Cho Cán Bộ`;
            }

            if (this.selectedPermUserId) {
                this.selectPermUser(this.selectedPermUserId);
            } else if (this.users && this.users.length > 0) {
                this.selectPermUser(this.users[0].id);
            }
        }
    },

    renderPermRolesList() {
        const list = document.getElementById('permRolesList');
        if (!list) return;

        const roles = [
            { key: 'admin', name: '👑 1/ Quản Trị Hệ Thống (SuperAdmin)', roleCode: 'SUPERADMIN', desc: 'Toàn quyền điều hành toàn bộ phân hệ và CSDL', inactiveBg: 'bg-violet-50/60 hover:bg-violet-100/80 border-violet-200 text-violet-950', activeBg: 'bg-violet-900 border-violet-900 text-white', activeSubText: 'text-violet-200', activeBadge: 'bg-violet-800 text-violet-100 border-violet-700', inactiveBadge: 'bg-white text-violet-900 border border-violet-200' },
            { key: 'bgh', name: '🏛️ 2/ Ban Giám Hiệu (BGH)', roleCode: 'BGH', desc: 'Chỉ đạo toàn trường, phân công đơn vị, duyệt đề xuất', inactiveBg: 'bg-indigo-50/60 hover:bg-indigo-100/80 border-indigo-200 text-indigo-950', activeBg: 'bg-indigo-900 border-indigo-900 text-white', activeSubText: 'text-indigo-200', activeBadge: 'bg-indigo-800 text-indigo-100 border-indigo-700', inactiveBadge: 'bg-white text-indigo-900 border border-indigo-200' },
            { key: 'dept_head', name: '👔 3/ Trưởng Đơn Vị (DEPT_HEAD)', roleCode: 'DEPT_HEAD', desc: 'Quản lý toàn diện đơn vị, phân công cán bộ, duyệt KPI', inactiveBg: 'bg-blue-50/60 hover:bg-blue-100/80 border-blue-200 text-blue-950', activeBg: 'bg-blue-900 border-blue-900 text-white', activeSubText: 'text-blue-200', activeBadge: 'bg-blue-800 text-blue-100 border-blue-700', inactiveBadge: 'bg-white text-blue-900 border border-blue-200' },
            { key: 'dept_vice', name: '🎖️ 4/ Phó Đơn Vị (DEPT_VICE)', roleCode: 'DEPT_VICE', desc: 'Phối hợp quản lý đơn vị, duyệt đề xuất khi được ủy quyền', inactiveBg: 'bg-green-50/60 hover:bg-green-100/80 border-green-200 text-green-950', activeBg: 'bg-green-800 border-green-800 text-white', activeSubText: 'text-green-200', activeBadge: 'bg-green-700 text-green-100 border-green-600', inactiveBadge: 'bg-white text-green-900 border border-green-200' },
            { key: 'staff', name: '👤 5/ Cán Bộ / Giảng Viên (STAFF)', roleCode: 'STAFF', desc: 'Thực hiện nhiệm vụ được giao, đề xuất sáng kiến, báo cáo', inactiveBg: 'bg-amber-50/60 hover:bg-amber-100/80 border-amber-200 text-amber-950', activeBg: 'bg-amber-800 border-amber-800 text-white', activeSubText: 'text-amber-200', activeBadge: 'bg-amber-700 text-amber-100 border-amber-600', inactiveBadge: 'bg-white text-amber-900 border border-amber-200' }
        ];

        list.innerHTML = roles.map(r => {
            const isSelected = r.key === this.selectedPermRoleKey;
            const permsCount = (this.permissionPresets && this.permissionPresets[r.key]) ? this.permissionPresets[r.key].length : 0;

            return `
                <div onclick="SettingsPage.selectPermRole('${r.key}')" 
                    class="p-3 rounded-xl cursor-pointer transition-all border text-xs flex flex-col justify-between ${isSelected ? `${r.activeBg} shadow-md` : `${r.inactiveBg} shadow-2xs`}">
                    <div class="flex items-center justify-between">
                        <div class="font-bold text-xs ${isSelected ? 'text-white' : 'text-slate-900'}">${r.name}</div>
                        <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold ${isSelected ? r.activeBadge : r.inactiveBadge}">${permsCount} quyền</span>
                    </div>
                    <div class="text-[10.5px] mt-1 ${isSelected ? r.activeSubText : 'text-slate-500'}">
                        ${r.desc}
                    </div>
                </div>
            `;
        }).join('');
    },

    selectPermRole(roleKey) {
        this.selectedPermRoleKey = roleKey;
        this.renderPermRolesList();

        const roleLabels = {
            admin: { title: '👑 Quản Trị Hệ Thống (SuperAdmin)', desc: 'Bộ quyền gốc chuẩn cho tài khoản Quản trị viên toàn quyền hệ thống' },
            bgh: { title: '🏛️ Ban Giám Hiệu (BGH)', desc: 'Bộ quyền gốc chuẩn cho Hiệu trưởng và các Phó Hiệu trưởng' },
            dept_head: { title: '👔 Trưởng Đơn Vị (Phòng / Khoa / TT)', desc: 'Bộ quyền gốc chuẩn cho Trưởng các Phòng ban, Khoa chuyên môn và Giám đốc TT' },
            dept_vice: { title: '🎖️ Phó Đơn Vị (Phó Trưởng Phòng / Khoa)', desc: 'Bộ quyền gốc chuẩn cho Phó Trưởng phòng và Phó Trưởng khoa' },
            staff: { title: '👤 Cán Bộ / Giảng Viên / Nhân Viên (STAFF)', desc: 'Bộ quyền gốc chuẩn cho Chuyên viên, Giảng viên và Nhân viên thực thi' }
        };

        const currentPreset = (this.permissionPresets && this.permissionPresets[roleKey]) ? [...this.permissionPresets[roleKey]] : [];
        this.originalSavedPermissions = [...currentPreset];
        this.currentEditingPermissions = [...currentPreset];

        const nameEl = document.getElementById('selectedUserFullName');
        const metaEl = document.getElementById('selectedUserMeta');
        const diffBar = document.getElementById('permSmartDiffBar');

        if (nameEl) nameEl.innerText = roleLabels[roleKey]?.title || roleKey;
        if (metaEl) {
            metaEl.innerHTML = `
                <div class="flex flex-wrap items-center gap-1.5 mt-1">
                    <span class="px-2 py-0.5 rounded bg-purple-50 text-purple-900 border border-purple-200 font-bold text-[10.5px]">🏛️ Quy chuẩn Gốc Vai Trò: ${roleKey.toUpperCase()}</span>
                    <span class="text-[10.5px] text-slate-500 italic">${roleLabels[roleKey]?.desc || ''}</span>
                </div>
            `;
        }

        if (diffBar) {
            diffBar.classList.add('hidden'); // Ẩn diff bar khi ở Role Mode
        }

        this.updatePermCountDisplay();
        this.renderPermissionCheckboxes();
    },

    async saveRolePermissions() {
        if (!this.selectedPermRoleKey) return;
        const btn = document.getElementById('btnSavePerms');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin mr-1"></i> Đang lưu...`;
        }

        try {
            const res = await API.updateRolePreset(this.selectedPermRoleKey, this.currentEditingPermissions || []);
            if (!this.permissionPresets) this.permissionPresets = {};
            this.permissionPresets[this.selectedPermRoleKey] = [...this.currentEditingPermissions];
            this.originalSavedPermissions = [...this.currentEditingPermissions];
            this.renderPermRolesList();
            Common.showToast(`Đã lưu thành công bộ quyền gốc cho vai trò ${this.selectedPermRoleKey.toUpperCase()}!`, 'success');
        } catch (e) {
            Common.showToast(e.message || 'Lỗi khi lưu bộ quyền gốc của vai trò', 'error');
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = `<i class="fa-solid fa-floppy-disk mr-1"></i> Lưu Bộ Quyền Gốc Của Vai Trò`;
            }
        }
    },

    filterPermUsers() {
        this.renderPermUsersList();
    },

    renderPermUsersList() {
        const list = document.getElementById('permUsersList');
        if (!list) return;

        const q = document.getElementById('searchPermUser')?.value.trim().toLowerCase() || '';
        const deptCode = document.getElementById('filterPermUserDept')?.value || '';

        const filtered = (this.users || []).filter(u => {
            const matchQuery = (u.full_name || '').toLowerCase().includes(q) || (u.username || '').toLowerCase().includes(q);
            const userDeptCode = u.department ? u.department.code : '';
            const matchDept = !deptCode || userDeptCode === deptCode;
            return matchQuery && matchDept;
        });

        const countLabel = document.getElementById('permUserCount');
        if (countLabel) countLabel.innerText = `${filtered.length} người`;

        list.innerHTML = filtered.map(u => {
            const isSelected = u.id === this.selectedPermUserId;
            const roleBadge = u.role === 'SUPERADMIN' ? '<span class="px-1.5 py-0.5 rounded bg-purple-100 text-purple-900 border border-purple-200 font-bold text-[9.5px]">👑 QUẢN TRỊ</span>' :
                              u.role === 'BGH' ? '<span class="px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-900 border border-indigo-200 font-bold text-[9.5px]">🏛️ BGH</span>' :
                              u.role === 'DEPT_HEAD' ? '<span class="px-1.5 py-0.5 rounded bg-blue-100 text-blue-900 border border-blue-200 font-bold text-[9.5px]">👔 QUẢN LÝ</span>' :
                              u.role === 'DEPT_VICE' ? '<span class="px-1.5 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200 font-bold text-[9.5px]">👔 PHÓ ĐV</span>' :
                              '<span class="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 font-bold text-[9.5px]">👤 NHÂN VIÊN</span>';

            return `
                <div onclick="SettingsPage.selectPermUser(${u.id})" 
                    class="p-2.5 rounded-xl cursor-pointer transition border text-xs flex items-center justify-between ${isSelected ? 'bg-blue-900 text-white border-blue-900 shadow-sm' : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200'}">
                    <div>
                        <div class="font-bold text-xs">${u.full_name || u.username}</div>
                        <div class="text-[10px] mt-0.5 ${isSelected ? 'text-blue-200' : 'text-slate-500'} flex items-center space-x-1.5">
                            <span>@${u.username}</span>
                            <span>•</span>
                            <span class="font-bold">${u.department ? u.department.code : 'HueIC'}</span>
                        </div>
                    </div>
                    <div>
                        ${roleBadge}
                    </div>
                </div>
            `;
        }).join('');
    },

    async selectPermUser(userId) {
        this.selectedPermUserId = userId;
        this.renderPermUsersList();

        try {
            const res = await API.getUserPermissions(userId);
            const user = (this.users || []).find(u => u.id === userId) || {
                full_name: res.full_name,
                username: res.username,
                role: res.role,
                department: null
            };
            this.currentSelectedUserObj = user;
            this.originalSavedPermissions = Array.isArray(res.permissions) ? [...res.permissions] : [];
            this.currentEditingPermissions = [...this.originalSavedPermissions];

            const nameEl = document.getElementById('selectedUserFullName');
            const metaEl = document.getElementById('selectedUserMeta');
            const diffBar = document.getElementById('permSmartDiffBar');

            if (diffBar) diffBar.classList.remove('hidden'); // Hiện diff bar khi ở User Mode

            if (nameEl) nameEl.innerText = user.full_name || res.full_name || `@${res.username}`;
            if (metaEl) {
                const roleBadge = user.role === 'SUPERADMIN' ? '<span class="px-2 py-0.5 rounded bg-purple-50 text-purple-900 border border-purple-200 font-bold text-[10.5px]">👑 Lớp 1: Role ' + user.role + '</span>' :
                                  user.role === 'BGH' ? '<span class="px-2 py-0.5 rounded bg-indigo-50 text-indigo-900 border border-indigo-200 font-bold text-[10.5px]">🏛️ Lớp 1: Ban Giám Hiệu</span>' :
                                  user.role === 'DEPT_HEAD' ? '<span class="px-2 py-0.5 rounded bg-blue-50 text-blue-900 border border-blue-200 font-bold text-[10.5px]">👔 Lớp 1: Trưởng Đơn Vị</span>' :
                                  user.role === 'DEPT_VICE' ? '<span class="px-2 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-200 font-bold text-[10.5px]">🎖️ Lớp 1: Phó Đơn Vị</span>' :
                                  '<span class="px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 font-bold text-[10.5px]">👤 Lớp 1: Nhân Viên</span>';
                
                const posBadge = user.position 
                    ? `<span class="px-2 py-0.5 rounded bg-emerald-50 text-emerald-900 border border-emerald-200 font-bold text-[10.5px]">📋 Lớp 2: ${user.position}</span>`
                    : '<span class="px-2 py-0.5 rounded bg-slate-50 text-slate-500 border border-slate-200 text-[10.5px]">📋 Lớp 2: Chưa gán chức vụ</span>';
                
                const deptBadge = user.department
                    ? `<span class="px-2 py-0.5 rounded bg-blue-50 text-blue-950 border border-blue-200 font-bold text-[10.5px]">🏢 Lớp 3: [${user.department.code}] ${user.department.name}</span>`
                    : '<span class="px-2 py-0.5 rounded bg-slate-50 text-slate-500 border border-slate-200 text-[10.5px]">🏢 Lớp 3: Toàn trường</span>';

                metaEl.innerHTML = `
                    <div class="flex flex-wrap items-center gap-1.5 mt-1">
                        ${roleBadge}
                        ${posBadge}
                        ${deptBadge}
                        <span class="text-[10px] text-slate-400 font-mono">(@${user.username || res.username})</span>
                    </div>
                `;
            }

            this.updatePermCountDisplay();
            this.renderPermissionCheckboxes();
        } catch (e) {
            console.error('Lỗi selectPermUser:', e);
            Common.showToast('Lỗi nạp quyền tài khoản', 'error');
        }
    },

    getBasePresetForUser(user) {
        if (!user) return [];
        const role = (user.role || '').toLowerCase();
        const roleKeyMap = {
            'superadmin': 'admin',
            'admin': 'admin',
            'bgh': 'bgh',
            'dept_head': 'dept_head',
            'dept_vice': 'dept_vice',
            'staff': 'staff'
        };
        const key = roleKeyMap[role] || 'staff';
        if (this.permissionPresets && this.permissionPresets[key]) {
            return this.permissionPresets[key];
        }
        const fallbacks = {
            admin: ["module:dashboard", "module:tasks", "module:calendar", "module:assets", "module:documents", "module:database", "module:settings", "scope:school", "scope:dept", "scope:personal", "task:dispatch_school", "task:dispatch_dept", "task:todo_personal", "task:edit", "task:progress", "task:approve_proposal", "task:approve_complete", "task:extend_deadline", "task:delete", "dept:manage", "user:manage", "workflow:manage", "perm:manage"],
            bgh: ["module:dashboard", "module:tasks", "module:calendar", "module:assets", "module:documents", "module:settings", "scope:school", "scope:dept", "scope:personal", "task:dispatch_school", "task:dispatch_dept", "task:todo_personal", "task:edit", "task:progress", "task:approve_proposal", "task:approve_complete", "task:extend_deadline", "task:delete", "dept:manage", "user:manage", "workflow:manage", "perm:manage"],
            dept_head: ["module:tasks", "scope:dept", "scope:personal", "task:dispatch_dept", "task:todo_personal", "task:edit", "task:progress", "task:approve_proposal", "task:approve_complete", "task:extend_deadline"],
            dept_vice: ["module:tasks", "scope:dept", "scope:personal", "task:dispatch_dept", "task:todo_personal", "task:edit", "task:progress", "task:approve_proposal", "task:approve_complete"],
            staff: ["module:tasks", "scope:personal", "task:todo_personal", "task:progress"]
        };
        return fallbacks[key] || fallbacks.staff;
    },

    applyRolePreset(presetKey) {
        if (!this.permissionPresets || !this.permissionPresets[presetKey]) {
            const fallbacks = {
                admin: ["module:dashboard", "module:tasks", "module:calendar", "module:assets", "module:documents", "module:database", "module:settings", "scope:school", "scope:dept", "scope:personal", "task:dispatch_school", "task:dispatch_dept", "task:todo_personal", "task:edit", "task:progress", "task:approve_proposal", "task:approve_complete", "task:extend_deadline", "task:delete", "dept:manage", "user:manage", "workflow:manage", "perm:manage"],
                bgh: ["module:dashboard", "module:tasks", "module:calendar", "module:assets", "module:documents", "module:settings", "scope:school", "scope:dept", "scope:personal", "task:dispatch_school", "task:dispatch_dept", "task:todo_personal", "task:edit", "task:progress", "task:approve_proposal", "task:approve_complete", "task:extend_deadline", "task:delete", "dept:manage", "user:manage", "workflow:manage", "perm:manage"],
                dept_head: ["module:tasks", "scope:dept", "scope:personal", "task:dispatch_dept", "task:todo_personal", "task:edit", "task:progress", "task:approve_proposal", "task:approve_complete", "task:extend_deadline"],
                dept_vice: ["module:tasks", "scope:dept", "scope:personal", "task:dispatch_dept", "task:todo_personal", "task:edit", "task:progress", "task:approve_proposal", "task:approve_complete"],
                staff: ["module:tasks", "scope:personal", "task:todo_personal", "task:progress"]
            };
            this.currentEditingPermissions = fallbacks[presetKey] ? [...fallbacks[presetKey]] : [];
        } else {
            this.currentEditingPermissions = [...this.permissionPresets[presetKey]];
        }

        this.updatePermCountDisplay();
        this.renderPermissionCheckboxes();
        const presetLabels = { admin: 'SuperAdmin', bgh: 'Ban Giám Hiệu', dept_head: 'Trưởng Đơn Vị', dept_vice: 'Phó Đơn Vị', staff: 'Cán Bộ / Giảng Viên' };
        Common.showToast(`Đã áp dụng mẫu quyền chuẩn cho ${presetLabels[presetKey] || presetKey}!`, 'info');
    },

    renderPermissionCheckboxes() {
        const container = document.getElementById('permissionGroupsContainer');
        if (!container || !this.permissionCatalog || !Array.isArray(this.permissionCatalog)) return;

        const isRoleMode = this.currentRbacMode === 'role';
        const user = this.currentSelectedUserObj || {};
        const basePreset = isRoleMode ? [] : this.getBasePresetForUser(user);
        const isStaff = !isRoleMode && ['STAFF', 'EMPLOYEE', 'NHAN_VIEN'].includes(user.role);
        const sensitivePerms = ['scope:school', 'task:dispatch_school', 'task:delete', 'user:manage', 'perm:manage', 'dept:manage', 'module:database'];

        const groupThemes = {
            module: { dot: 'bg-rose-600', badge: 'bg-rose-50 text-rose-900 border-rose-200' },
            scope: { dot: 'bg-blue-600', badge: 'bg-blue-50 text-blue-900 border-blue-200' },
            dispatch: { dot: 'bg-indigo-600', badge: 'bg-indigo-50 text-indigo-900 border-indigo-200' },
            approval: { dot: 'bg-amber-500', badge: 'bg-amber-50 text-amber-900 border-amber-200' },
            system: { dot: 'bg-emerald-600', badge: 'bg-emerald-50 text-emerald-900 border-emerald-200' }
        };

        container.innerHTML = this.permissionCatalog.map(group => {
            const groupKey = group.group_id;
            const groupName = group.group_name;
            const groupDesc = group.description || '';
            const groupPerms = group.permissions || [];
            const theme = groupThemes[groupKey] || { dot: 'bg-blue-800', badge: 'bg-slate-50 text-slate-800 border-slate-200' };

            return `
                <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                    <div class="flex flex-col sm:flex-row sm:items-center justify-between pb-2.5 mb-3 border-b border-slate-100 gap-1.5">
                        <div>
                            <h4 class="font-bold text-xs text-slate-900 flex items-center space-x-1.5">
                                <span class="w-2.5 h-2.5 rounded-full ${theme.dot}"></span>
                                <span>${groupName}</span>
                            </h4>
                            ${groupDesc ? `<p class="text-[10.5px] text-slate-500 mt-0.5 leading-tight">${groupDesc}</p>` : ''}
                        </div>
                        <button type="button" onclick="SettingsPage.toggleGroupAll('${groupKey}')" class="text-[11px] text-blue-700 hover:underline font-bold shrink-0 self-start sm:self-auto cursor-pointer">
                            Chọn tất cả nhóm
                        </button>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                        ${groupPerms.map(p => {
                            const isChecked = (this.currentEditingPermissions || []).includes(p.code);
                            const isBase = basePreset.includes(p.code);
                            const isAddedOverride = !isRoleMode && isChecked && !isBase;
                            const isRevoked = !isRoleMode && !isChecked && isBase;
                            const isEscalation = !isRoleMode && isChecked && isStaff && sensitivePerms.includes(p.code);

                            let cardClass = 'bg-slate-50 border-slate-200 hover:border-slate-300';
                            if (isChecked) {
                                cardClass = isAddedOverride 
                                    ? 'bg-emerald-50/40 border-emerald-300 ring-1 ring-emerald-400/20' 
                                    : 'bg-blue-50/70 border-blue-300';
                            } else if (isRevoked) {
                                cardClass = 'bg-red-50/20 border-dashed border-red-200';
                            }

                            let tagHtml = '';
                            if (isEscalation) {
                                tagHtml = '<span class="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 text-[9px] font-bold">⚠️ Vượt cấp</span>';
                            } else if (isAddedOverride) {
                                tagHtml = '<span class="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200 text-[9px] font-bold">➕ Cấp thêm</span>';
                            } else if (isRevoked) {
                                tagHtml = '<span class="px-1.5 py-0.5 rounded bg-red-100 text-red-700 border border-red-200 text-[9px] font-bold">⛔ Đã thu hồi</span>';
                            } else if (!isRoleMode && isBase && isChecked) {
                                tagHtml = '<span class="px-1.5 py-0.5 rounded bg-slate-200/70 text-slate-600 text-[9px] font-semibold">🔒 Gốc Role</span>';
                            }

                            return `
                                <label class="flex items-start p-2.5 ${cardClass} border rounded-lg cursor-pointer transition text-xs select-none relative">
                                    <input type="checkbox" value="${p.code}" ${isChecked ? 'checked' : ''} 
                                        onchange="SettingsPage.handleCheckboxChange(this)"
                                        class="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-800 focus:ring-blue-800 accent-blue-800 cursor-pointer">
                                    <div class="ml-2.5 flex-1 min-w-0">
                                        <div class="font-bold text-slate-800 flex items-center justify-between gap-1">
                                            <span class="truncate">${p.name}</span>
                                            ${tagHtml}
                                        </div>
                                        ${p.description ? `<div class="text-[10.5px] text-slate-500 mt-0.5 leading-snug">${p.description}</div>` : ''}
                                        <div class="text-[9.5px] text-slate-400 font-mono mt-0.5">${p.code}</div>
                                    </div>
                                </label>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
        }).join('');
    },

    handleCheckboxChange(checkbox) {
        const code = checkbox.value;
        if (!this.currentEditingPermissions) this.currentEditingPermissions = [];
        if (checkbox.checked) {
            if (!this.currentEditingPermissions.includes(code)) {
                this.currentEditingPermissions.push(code);
            }
        } else {
            this.currentEditingPermissions = this.currentEditingPermissions.filter(p => p !== code);
        }
        this.updatePermCountDisplay();
        this.renderPermissionCheckboxes();
    },

    toggleGroupAll(groupId) {
        if (!this.permissionCatalog || !Array.isArray(this.permissionCatalog)) return;
        const group = this.permissionCatalog.find(g => g.group_id === groupId);
        if (!group) return;
        const groupPerms = (group.permissions || []).map(p => p.code);
        if (!this.currentEditingPermissions) this.currentEditingPermissions = [];

        const allSelected = groupPerms.every(code => this.currentEditingPermissions.includes(code));

        if (allSelected) {
            this.currentEditingPermissions = this.currentEditingPermissions.filter(c => !groupPerms.includes(c));
        } else {
            groupPerms.forEach(c => {
                if (!this.currentEditingPermissions.includes(c)) this.currentEditingPermissions.push(c);
            });
        }
        this.updatePermCountDisplay();
        this.renderPermissionCheckboxes();
    },

    updatePermCountDisplay() {
        let total = 0;
        if (this.permissionCatalog && Array.isArray(this.permissionCatalog)) {
            this.permissionCatalog.forEach(g => {
                total += (g.permissions || []).length;
            });
        } else {
            total = 23;
        }
        const activeCount = (this.currentEditingPermissions || []).length;
        const el = document.getElementById('selectedUserPermCount');
        if (el) el.innerText = `${activeCount} / ${total} quyền`;

        // Tính toán Ma trận Diff thông minh theo thời gian thực (chỉ ở User Mode)
        const isRoleMode = this.currentRbacMode === 'role';
        if (isRoleMode) return;

        const user = this.currentSelectedUserObj || {};
        const basePreset = this.getBasePresetForUser(user);
        const currentPerms = this.currentEditingPermissions || [];
        const isStaff = ['STAFF', 'EMPLOYEE', 'NHAN_VIEN'].includes(user.role);
        const sensitivePerms = ['scope:school', 'task:dispatch_school', 'task:delete', 'user:manage', 'perm:manage', 'dept:manage', 'module:database'];

        const standardCount = basePreset.filter(p => currentPerms.includes(p)).length;
        const addedCount = currentPerms.filter(p => !basePreset.includes(p)).length;
        const revokedCount = basePreset.filter(p => !currentPerms.includes(p)).length;
        const escalationCount = isStaff ? currentPerms.filter(p => sensitivePerms.includes(p)).length : 0;

        const elStandard = document.getElementById('diffMetricStandard');
        const elAdded = document.getElementById('diffMetricAdded');
        const elRevoked = document.getElementById('diffMetricRevoked');
        const elWarning = document.getElementById('diffMetricWarning');

        if (elStandard) {
            elStandard.innerText = `🔒 ${standardCount}/${basePreset.length} chuẩn Role`;
        }

        if (elAdded) {
            if (addedCount > 0) {
                elAdded.classList.remove('hidden');
                elAdded.innerText = `➕ +${addedCount} cấp thêm`;
            } else {
                elAdded.classList.add('hidden');
            }
        }

        if (elRevoked) {
            if (revokedCount > 0) {
                elRevoked.classList.remove('hidden');
                elRevoked.innerText = `⛔ -${revokedCount} thu hồi`;
            } else {
                elRevoked.classList.add('hidden');
            }
        }

        if (elWarning) {
            if (escalationCount > 0) {
                elWarning.classList.remove('hidden');
                elWarning.innerText = `⚠️ ${escalationCount} quyền vượt cấp`;
            } else {
                elWarning.classList.add('hidden');
            }
        }
    },

    revertUnsavedPermissions() {
        if (!this.originalSavedPermissions) return;
        this.currentEditingPermissions = [...this.originalSavedPermissions];
        this.updatePermCountDisplay();
        this.renderPermissionCheckboxes();
        Common.showToast('Đã hoàn tác các thay đổi chưa lưu về trạng thái ban đầu!', 'info');
    },

    async confirmAndRestoreDefaultPermissions() {
        if (!this.selectedPermUserId) return;
        const user = this.currentSelectedUserObj || {};
        const roleLabel = user.role || 'Cán bộ';

        if (!confirm(`Bạn có chắc chắn muốn KHÔI PHỤC TOÀN BỘ quyền của cán bộ "${user.full_name || user.username}" về chuẩn mặc định 100% của vai trò "${roleLabel}"?\n\nTất cả quyền cấp thêm tùy biến hoặc thu hồi sẽ được xóa sạch.`)) {
            return;
        }

        try {
            const res = await API.resetDefaultPermissions(this.selectedPermUserId);
            this.originalSavedPermissions = Array.isArray(res.permissions) ? [...res.permissions] : [];
            this.currentEditingPermissions = [...this.originalSavedPermissions];
            this.updatePermCountDisplay();
            this.renderPermissionCheckboxes();
            Common.showToast('Đã khôi phục 100% quyền mặc định gốc theo vai trò thành công!', 'success');
        } catch (e) {
            console.error('Lỗi restoreDefaultPermissions:', e);
            Common.showToast('Lỗi khôi phục quyền mặc định', 'error');
        }
    },

    async saveUserPermissions() {
        if (!this.selectedPermUserId) return;

        const btn = document.getElementById('btnSavePerms');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin mr-1"></i> Đang lưu...`;
        }

        try {
            await API.updateUserPermissions(this.selectedPermUserId, this.currentEditingPermissions || []);
            Common.showToast('Đã lưu cấu hình phân quyền cho cán bộ thành công!', 'success');
        } catch (e) {
            Common.showToast(e.message || 'Lỗi khi lưu phân quyền', 'error');
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = `<i class="fa-solid fa-floppy-disk mr-1"></i> Lưu Cấu Hình Phân Quyền`;
            }
        }
    },

    // ==========================================
    // 4. PHÂN HỆ QUẢN LÝ QUY TRÌNH MẪU (WORKFLOWS)
    // ==========================================
    async loadWorkflows() {
        try {
            this.workflows = await API.getWorkflows({ include_global: true });
            this.renderWorkflowsList();
        } catch (e) {
            console.error('Lỗi tải danh mục quy trình:', e);
            Common.showToast('Lỗi nạp danh sách quy trình mẫu', 'error');
        }
    },

    filterWorkflows() {
        this.renderWorkflowsList();
    },

    renderWorkflowsList() {
        const grid = document.getElementById('workflowsGrid');
        const countLabel = document.getElementById('workflowCountLabel');
        const query = document.getElementById('searchWorkflowInput')?.value.trim().toLowerCase() || '';
        const deptFilter = document.getElementById('filterWorkflowDept')?.value || '';

        if (!grid) return;

        let filtered = this.workflows.filter(wf => {
            const matchSearch = wf.name.toLowerCase().includes(query) || wf.code.toLowerCase().includes(query);
            let matchDept = true;
            if (deptFilter === 'global') {
                matchDept = wf.department_id === null;
            } else if (deptFilter) {
                matchDept = wf.department_id === parseInt(deptFilter);
            }
            return matchSearch && matchDept;
        });

        if (countLabel) {
            countLabel.innerText = `Hiển thị ${filtered.length} / ${this.workflows.length} quy trình`;
        }

        if (filtered.length === 0) {
            grid.innerHTML = `
                <div class="col-span-full text-center py-12 bg-white rounded-2xl border border-slate-200 p-6 space-y-2">
                    <i class="fa-solid fa-route text-3xl text-slate-300"></i>
                    <p class="text-xs text-slate-500 font-semibold">Chưa có quy trình mẫu nào phù hợp với bộ lọc.</p>
                    <button onclick="SettingsPage.openCreateWorkflowModal()" class="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-800 text-xs font-bold rounded-lg transition inline-flex items-center space-x-1">
                        <i class="fa-solid fa-plus text-[10px]"></i>
                        <span>Tạo Quy Trình Mới</span>
                    </button>
                </div>
            `;
            return;
        }

        grid.innerHTML = filtered.map(wf => {
            const steps = wf.steps || [];
            const deptText = wf.department ? `${wf.department.name} (${wf.department.code})` : '🌐 Dùng chung toàn trường';
            const deptBadgeClass = wf.department ? 'bg-blue-50 text-blue-900 border-blue-200' : 'bg-emerald-50 text-emerald-900 border-emerald-200';

            return `
                <div class="bg-white rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition p-4 flex flex-col justify-between space-y-3">
                    <div class="space-y-2">
                        <div class="flex items-start justify-between gap-2">
                            <span class="px-2 py-0.5 rounded font-mono font-bold text-[10px] border ${deptBadgeClass}">
                                ${wf.code}
                            </span>
                            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${wf.is_active ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-500'}">
                                ${wf.is_active ? 'Đang áp dụng' : 'Tạm ngưng'}
                            </span>
                        </div>

                        <div>
                            <h4 class="font-black text-slate-900 text-sm leading-snug">${wf.name}</h4>
                            <p class="text-[11px] font-semibold text-blue-800 mt-0.5 flex items-center space-x-1">
                                <i class="fa-solid fa-building text-[10px]"></i>
                                <span>${deptText}</span>
                            </p>
                            ${wf.description ? `<p class="text-[11px] text-slate-500 line-clamp-2 mt-1">${wf.description}</p>` : ''}
                        </div>

                        <!-- Stepper Preview -->
                        <div class="bg-slate-50 p-2.5 rounded-xl border border-slate-100 space-y-1.5">
                            <div class="flex justify-between items-center text-[11px] font-bold text-slate-700">
                                <span>Quy trình gồm ${steps.length} bước:</span>
                                <span class="font-mono text-blue-900 text-[10px]">${Math.round(100 / (steps.length || 1))}% / bước</span>
                            </div>
                            <div class="space-y-1 max-h-32 overflow-y-auto">
                                ${steps.map(s => `
                                    <div class="flex items-start space-x-1.5 text-[11px] text-slate-600">
                                        <span class="w-4 h-4 rounded-full bg-blue-100 text-blue-900 font-mono font-bold text-[9px] flex items-center justify-center shrink-0 mt-0.5">
                                            ${s.id}
                                        </span>
                                        <span class="truncate font-medium">${s.title}</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>

                    <div class="pt-2 border-t border-slate-100 flex items-center justify-end space-x-1.5">
                        <button onclick="SettingsPage.openEditWorkflowModal(${wf.id})" class="px-3 py-1.5 bg-blue-50 hover:bg-blue-800 hover:text-white text-blue-800 rounded-lg text-xs font-bold transition flex items-center space-x-1">
                            <i class="fa-solid fa-pen-to-square text-[10px]"></i>
                            <span>Sửa</span>
                        </button>
                        <button onclick="SettingsPage.deleteWorkflow(${wf.id}, '${wf.name.replace(/'/g, "\\'")}')" class="px-2.5 py-1.5 bg-red-50 hover:bg-red-600 hover:text-white text-red-600 rounded-lg text-xs font-bold transition" title="Xóa">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    },

    openCreateWorkflowModal() {
        document.getElementById('formWorkflow').reset();
        document.getElementById('formWorkflowId').value = '';
        document.getElementById('modalWorkflowTitle').innerText = 'Tạo Mới Quy Trình Mẫu';
        document.getElementById('formWorkflowCode').readOnly = false;
        
        // Mặc định nạp 4 bước
        this.modalWorkflowSteps = [
            { id: 1, title: "Lập kế hoạch & Khảo sát", description: "" },
            { id: 2, title: "Triển khai thực hiện", description: "" },
            { id: 3, title: "Kiểm tra & Đánh giá kết quả", description: "" },
            { id: 4, title: "Nghiệm thu & Bàn giao", description: "" }
        ];
        this.renderWorkflowModalSteps();
        document.getElementById('modalWorkflowForm').classList.remove('hidden');
    },

    openEditWorkflowModal(wfId) {
        const wf = this.workflows.find(w => w.id === wfId);
        if (!wf) return;

        document.getElementById('formWorkflowId').value = wf.id;
        document.getElementById('formWorkflowCode').value = wf.code;
        document.getElementById('formWorkflowCode').readOnly = true;
        document.getElementById('formWorkflowName').value = wf.name;
        document.getElementById('formWorkflowDept').value = wf.department_id || '';
        document.getElementById('formWorkflowActive').value = wf.is_active ? 'true' : 'false';
        document.getElementById('formWorkflowDesc').value = wf.description || '';
        document.getElementById('modalWorkflowTitle').innerText = `Chỉnh Sửa: ${wf.name} (${wf.code})`;

        this.modalWorkflowSteps = (wf.steps && wf.steps.length > 0)
            ? JSON.parse(JSON.stringify(wf.steps))
            : [{ id: 1, title: "Bước 1: Thực hiện", description: "" }];

        this.renderWorkflowModalSteps();
        document.getElementById('modalWorkflowForm').classList.remove('hidden');
    },

    closeWorkflowModal() {
        document.getElementById('modalWorkflowForm').classList.add('hidden');
    },

    addWorkflowModalStep(title = '', desc = '') {
        const nextId = this.modalWorkflowSteps.length + 1;
        this.modalWorkflowSteps.push({
            id: nextId,
            title: title || `Bước ${nextId}: Nội dung công việc`,
            description: desc || ''
        });
        this.renderWorkflowModalSteps();
    },

    removeWorkflowModalStep(stepIdx) {
        this.modalWorkflowSteps.splice(stepIdx, 1);
        this.modalWorkflowSteps.forEach((s, idx) => s.id = idx + 1);
        this.renderWorkflowModalSteps();
    },

    updateWorkflowModalStep(stepIdx, field, val) {
        if (this.modalWorkflowSteps[stepIdx]) {
            this.modalWorkflowSteps[stepIdx][field] = val;
        }
    },

    renderWorkflowModalSteps() {
        const container = document.getElementById('modalWorkflowStepsContainer');
        if (!container) return;

        if (this.modalWorkflowSteps.length === 0) {
            container.innerHTML = `
                <div class="text-center py-4 text-slate-400 italic text-[11px] bg-white rounded-lg border border-dashed border-slate-200">
                    Chưa có bước nào. Bấm <b>+ Thêm bước</b> để bắt đầu thiết lập.
                </div>
            `;
            return;
        }

        container.innerHTML = this.modalWorkflowSteps.map((step, idx) => `
            <div class="bg-white p-2.5 rounded-lg border border-slate-200 shadow-2xs space-y-1.5">
                <div class="flex items-center space-x-2">
                    <span class="w-6 h-6 rounded-full bg-blue-100 text-blue-900 font-mono font-black text-xs flex items-center justify-center shrink-0">
                        ${step.id}
                    </span>
                    <input type="text" value="${step.title}" 
                        oninput="SettingsPage.updateWorkflowModalStep(${idx}, 'title', this.value)"
                        placeholder="Tên bước thực hiện (VD: Khảo sát hiện trạng...)"
                        class="flex-1 px-2.5 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:border-blue-800 font-semibold">
                    <button type="button" onclick="SettingsPage.removeWorkflowModalStep(${idx})" class="text-slate-400 hover:text-red-600 p-1 transition" title="Xóa bước này">
                        <i class="fa-solid fa-trash-can text-xs"></i>
                    </button>
                </div>
                <div class="pl-8">
                    <input type="text" value="${step.description || ''}" 
                        oninput="SettingsPage.updateWorkflowModalStep(${idx}, 'description', this.value)"
                        placeholder="Mô tả hướng dẫn thực hiện bước này (nếu có)..."
                        class="w-full px-2 py-0.5 text-[11px] bg-slate-50 border border-slate-200 rounded focus:bg-white focus:outline-none focus:border-blue-800 text-slate-600">
                </div>
            </div>
        `).join('');
    },

    async handleSaveWorkflow(e) {
        e.preventDefault();
        const id = document.getElementById('formWorkflowId').value;
        const code = document.getElementById('formWorkflowCode').value.trim().toUpperCase();
        const name = document.getElementById('formWorkflowName').value.trim();
        const deptVal = document.getElementById('formWorkflowDept').value;
        const department_id = deptVal ? parseInt(deptVal) : null;
        const is_active = document.getElementById('formWorkflowActive').value === 'true';
        const description = document.getElementById('formWorkflowDesc').value.trim();

        if (this.modalWorkflowSteps.length === 0) {
            Common.showToast('Vui lòng thiết lập ít nhất 1 bước cho quy trình!', 'error');
            return;
        }

        const btn = document.getElementById('btnSubmitWorkflow');
        btn.disabled = true;
        btn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin mr-1"></i> Đang lưu...`;

        try {
            const payload = {
                code,
                name,
                department_id,
                is_active,
                description,
                steps: this.modalWorkflowSteps
            };

            if (id) {
                await API.updateWorkflow(id, payload);
                Common.showToast('Cập nhật quy trình mẫu thành công!', 'success');
            } else {
                await API.createWorkflow(payload);
                Common.showToast('Tạo mới quy trình mẫu thành công!', 'success');
            }
            this.closeWorkflowModal();
            await this.loadWorkflows();
        } catch (err) {
            Common.showToast(err.message || 'Lỗi lưu quy trình mẫu', 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = `Lưu Quy Trình`;
        }
    },

    async deleteWorkflow(wfId, wfName) {
        if (!confirm(`Bạn có chắc chắn muốn xóa quy trình mẫu "${wfName}"?`)) return;

        try {
            await API.deleteWorkflow(wfId);
            Common.showToast('Đã xóa quy trình mẫu!', 'success');
            await this.loadWorkflows();
        } catch (err) {
            Common.showToast(err.message || 'Lỗi khi xóa quy trình', 'error');
        }
    },

    // 5. System Themes & Status Meta Config
    selectTheme(themeName) {
        Common.setTheme(themeName);
        this.renderActiveThemeUI();
        const themeLabels = {
            'soft-light': 'Sáng Dịu Mắt (Eye-Care Soft Light)',
            'dark': 'Chế Độ Tối (Modern Dark Mode)'
        };
        Common.showToast(`✨ Đã áp dụng giao diện: ${themeLabels[themeName] || themeName}!`, 'success');
    },

    renderActiveThemeUI() {
        const currentTheme = Common.getTheme();
        const badge = document.getElementById('currentThemeBadge');
        const themeLabels = {
            'soft-light': 'Sáng Dịu Mắt (Soft Light)',
            'dark': 'Chế Độ Tối (Modern Dark Mode)'
        };

        if (badge) {
            badge.innerHTML = `<i class="fa-solid fa-circle-check text-blue-600"></i><span>Đang áp dụng: ${themeLabels[currentTheme] || 'Sáng Dịu Mắt'}</span>`;
        }

        const themes = ['soft-light', 'dark'];
        themes.forEach(t => {
            const card = document.getElementById(`theme-card-${t}`);
            if (!card) return;
            const statusText = card.querySelector('.theme-status-text');
            const checkIcon = card.querySelector('.theme-check-icon');

            if (t === currentTheme) {
                card.classList.add('ring-2', 'ring-blue-600', 'border-blue-600', 'shadow-md');
                if (statusText) {
                    statusText.innerText = 'Đang sử dụng';
                    statusText.className = t === 'dark' ? 'text-xs font-bold text-blue-400 theme-status-text' : 'text-xs font-bold text-amber-800 theme-status-text';
                }
                if (checkIcon) {
                    checkIcon.innerHTML = '<i class="fa-solid fa-check"></i>';
                    checkIcon.className = t === 'dark' ? 'w-6 h-6 rounded-full bg-blue-950 border border-blue-400 flex items-center justify-center text-xs text-blue-300 theme-check-icon' : 'w-6 h-6 rounded-full bg-amber-100 border border-amber-500 flex items-center justify-center text-xs text-amber-800 theme-check-icon';
                }
            } else {
                card.classList.remove('ring-2', 'ring-blue-600', 'border-blue-600', 'shadow-md');
                if (statusText) {
                    statusText.innerText = 'Bấm để chọn';
                    statusText.className = 'text-xs font-semibold text-slate-400 theme-status-text';
                }
                if (checkIcon) {
                    checkIcon.innerHTML = '';
                    checkIcon.className = 'w-6 h-6 rounded-full border border-slate-300 dark:border-slate-700 flex items-center justify-center text-xs theme-check-icon';
                }
            }
        });
    },

    renderThemesConfig() {
        this.renderActiveThemeUI();
        const statuses = Common.getStatusConfig();
        const priorities = Common.getPriorityConfig();

        const statusContainer = document.getElementById('statusConfigList');
        if (statusContainer) {
            statusContainer.className = "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2";
            statusContainer.innerHTML = statuses.sort((a, b) => (a.order || 0) - (b.order || 0)).map((s, idx) => `
                <div class="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between gap-2 shadow-2xs hover:border-slate-300 transition">
                    <div class="flex items-center space-x-2 min-w-0">
                        <span class="w-5 h-5 rounded-md bg-slate-200 text-slate-700 font-bold text-[11px] flex items-center justify-center flex-shrink-0">${s.order || idx + 1}</span>
                        <span class="font-bold text-xs text-slate-800 truncate" title="${s.label}">${s.label}</span>
                    </div>
                    <div class="flex items-center space-x-1.5 flex-shrink-0">
                        <input type="color" id="statusColor_${s.code}" value="${s.color}" class="w-5 h-5 p-0 border border-slate-300 rounded cursor-pointer hover:scale-105 transition">
                        <input type="number" id="statusOrder_${s.code}" value="${s.order || idx + 1}" min="1" max="10" class="w-9 px-1 py-0.5 border border-slate-300 rounded text-center text-xs font-bold focus:border-blue-600">
                    </div>
                </div>
            `).join('');
        }

        const priorityContainer = document.getElementById('priorityConfigList');
        if (priorityContainer) {
            priorityContainer.className = "grid grid-cols-1 sm:grid-cols-2 gap-2";
            priorityContainer.innerHTML = priorities.sort((a, b) => (a.order || 0) - (b.order || 0)).map((p, idx) => `
                <div class="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between gap-2 shadow-2xs hover:border-slate-300 transition">
                    <div class="flex items-center space-x-2 min-w-0">
                        <span class="w-5 h-5 rounded-md bg-slate-200 text-slate-700 font-bold text-[11px] flex items-center justify-center flex-shrink-0">${p.order || idx + 1}</span>
                        <span class="font-bold text-xs text-slate-800 truncate" title="${p.label}">${p.label}</span>
                    </div>
                    <div class="flex items-center space-x-1.5 flex-shrink-0">
                        <input type="color" id="priorityColor_${p.code}" value="${p.color}" class="w-5 h-5 p-0 border border-slate-300 rounded cursor-pointer hover:scale-105 transition">
                        <input type="number" id="priorityOrder_${p.code}" value="${p.order || idx + 1}" min="1" max="10" class="w-9 px-1 py-0.5 border border-slate-300 rounded text-center text-xs font-bold focus:border-blue-600">
                    </div>
                </div>
            `).join('');
        }

        // Render tab color config section (KHỐI 3)
        this.renderTabColorConfig();
    },

    saveThemesConfig() {
        const statuses = Common.getStatusConfig();
        const priorities = Common.getPriorityConfig();

        statuses.forEach(s => {
            const colInput = document.getElementById(`statusColor_${s.code}`);
            const ordInput = document.getElementById(`statusOrder_${s.code}`);
            if (colInput) s.color = colInput.value;
            if (ordInput) s.order = parseInt(ordInput.value) || s.order;
        });

        priorities.forEach(p => {
            const colInput = document.getElementById(`priorityColor_${p.code}`);
            const ordInput = document.getElementById(`priorityOrder_${p.code}`);
            if (colInput) p.color = colInput.value;
            if (ordInput) p.order = parseInt(ordInput.value) || p.order;
        });

        Common.saveStatusConfig(statuses);
        Common.savePriorityConfig(priorities);
        Common.showToast('Đã lưu cấu hình quy chuẩn màu sắc & trạng thái thành công!', 'success');
        this.renderThemesConfig();
    },

    resetThemesDefault() {
        if (!confirm('Bạn có chắc chắn muốn khôi phục toàn bộ bảng màu và thứ tự về chuẩn mặc định của HueIC IMP?')) return;
        Common.resetDefaultStatusPriorityConfig();
        Common.showToast('Đã khôi phục cài đặt mặc định thành công!', 'success');
        this.renderThemesConfig();
    },

    // ─────────────────────────────────────────────────────────────────────
    // BẢNG 10 MÀU CHUẨN HIỆN ĐẠI (HUEIC SYSTEM PALETTE 1..10) - SOFT MEDIUM 500/600 TONES (DỊU 75%)
    SYSTEM_PALETTE_10: [
        { id: 'color-1',  index: 1,  name: '1. Violet',  hex: '#8b5cf6', icon: 'fa-crown',                 desc: 'SuperAdmin / Tab 1' },
        { id: 'color-2',  index: 2,  name: '2. Indigo',  hex: '#6366f1', icon: 'fa-building-columns',      desc: 'Ban Giám Hiệu / Tab 2' },
        { id: 'color-3',  index: 3,  name: '3. Blue',    hex: '#3b82f6', icon: 'fa-sitemap',               desc: 'Trưởng ĐV / Tab 3 (RBAC)' },
        { id: 'color-4',  index: 4,  name: '4. Green',   hex: '#10b981', icon: 'fa-users',                 desc: 'Phó ĐV / Tab 4 (Quy Trình)' },
        { id: 'color-5',  index: 5,  name: '5. Yellow',  hex: '#f59e0b', icon: 'fa-sun',                   desc: 'Nhân Viên / Tab 5 (Giao Diện)' },
        { id: 'color-6',  index: 6,  name: '6. Orange',  hex: '#f97316', icon: 'fa-route',                 desc: 'Cam Năng Động' },
        { id: 'color-7',  index: 7,  name: '7. Teal',    hex: '#14b8a6', icon: 'fa-user-tie',              desc: 'Xanh Ngọc Dịu' },
        { id: 'color-8',  index: 8,  name: '8. Red',     hex: '#f43f5e', icon: 'fa-triangle-exclamation',  desc: 'Cảnh Báo / Khẩn Cấp' },
        { id: 'color-9',  index: 9,  name: '9. Pink',    hex: '#ec4899', icon: 'fa-wand-magic-sparkles',   desc: 'Hồng Sáng Tạo' },
        { id: 'color-10', index: 10, name: '10. Slate',  hex: '#64748b', icon: 'fa-circle-dot',            desc: 'Trung Tính / Mặc Định' },
    ],

    TAB_COLOR_DEFAULTS: [
        // 5 Tab Điều Hướng Chính ánh xạ theo 5 màu đầu tiên (1..5)
        { id: 'departments', label: '1. Phòng / Khoa (12 Đơn vị)', icon: 'fa-building-columns', defaultColor: '#8b5cf6' },  // Màu #1: Violet-500
        { id: 'users',       label: '2. Cán Bộ & Nhân Sự',         icon: 'fa-users-gear',       defaultColor: '#6366f1' },  // Màu #2: Indigo-500
        { id: 'permissions', label: '3. Phân Quyền Chi Tiết',      icon: 'fa-shield-halved',    defaultColor: '#3b82f6' },  // Màu #3: Blue-500
        { id: 'workflows',   label: '4. Quy Trình Mẫu',            icon: 'fa-route',            defaultColor: '#10b981' },  // Màu #4: Emerald-500
        { id: 'themes',      label: '5. Giao Diện & Màu Sắc',      icon: 'fa-wand-magic-sparkles', defaultColor: '#f59e0b' }, // Màu #5: Amber-500
    ],

    getTabColors() {
        try {
            return JSON.parse(localStorage.getItem('hueic_tabColors') || '{}');
        } catch { return {}; }
    },

    renderTabColorConfig() {
        const list = document.getElementById('tabColorConfigList');
        const preview = document.getElementById('tabColorPreviewBar');
        if (!list || !preview) return;

        const saved = this.getTabColors();

        // 1. Render Live Preview Bar: Đúng 1 dòng 10 viên pill (1..10)
        preview.innerHTML = this.SYSTEM_PALETTE_10.map(item => {
            const color = saved[item.id] || item.hex;
            return `<span class="px-2 py-1 rounded-lg text-white text-[11px] font-bold flex items-center justify-center gap-1 shadow-2xs transition-all whitespace-nowrap min-w-0"
                         id="preview_pill_${item.id}"
                         style="background-color: ${color};">
                        <i class="fa-solid ${item.icon} text-[10px]"></i>
                        <span class="truncate">${item.name}</span>
                    </span>`;
        }).join('');

        // 2. Render Bảng 10 Ô Điều Khiển Màu: Nằm trên đúng 1 DÒNG DUY NHẤT (10 Cột)
        list.innerHTML = `
            <div class="grid grid-cols-5 xl:grid-cols-10 gap-1.5 w-full">
                ${this.SYSTEM_PALETTE_10.map(item => {
                    const color = saved[item.id] || item.hex;
                    return `
                    <div class="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between gap-1 shadow-2xs hover:border-slate-300 transition min-w-0">
                        <div class="flex items-center gap-1 min-w-0">
                            <span class="w-4 h-4 rounded text-white flex items-center justify-center text-[9px] font-bold flex-shrink-0 shadow-2xs" id="icon_badge_${item.id}" style="background-color: ${color};">
                                <i class="fa-solid ${item.icon}"></i>
                            </span>
                            <span class="font-bold text-[10.5px] text-slate-800 truncate" title="${item.name}">${item.name}</span>
                        </div>
                        <div class="flex items-center gap-1 flex-shrink-0">
                            <input type="color" id="tabColor_${item.id}" value="${color}"
                                oninput="SettingsPage.previewPaletteColor('${item.id}', this.value)"
                                class="w-5 h-5 p-0 border border-slate-300 rounded cursor-pointer hover:scale-105 transition flex-shrink-0">
                            <button onclick="SettingsPage.resetSinglePaletteColor('${item.id}')" title="Khôi phục mặc định"
                                class="w-4.5 h-4.5 rounded bg-white hover:bg-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center text-[9px] border border-slate-200 transition cursor-pointer flex-shrink-0">
                                <i class="fa-solid fa-rotate-left"></i>
                            </button>
                        </div>
                    </div>`;
                }).join('')}
            </div>
        `;
    },

    previewPaletteColor(colorId, newColor) {
        // Cập nhật live pill trên thanh preview
        const pill = document.getElementById(`preview_pill_${colorId}`);
        if (pill) pill.style.backgroundColor = newColor;

        // Cập nhật icon badge nhỏ trong ô điều khiển
        const badge = document.getElementById(`icon_badge_${colorId}`);
        if (badge) badge.style.backgroundColor = newColor;

        // Ánh xạ cập nhật live sang Tab điều hướng tương ứng nếu có
        const colorMapToTab = {
            'color-1': 'departments',  // Màu #1: Violet -> Tab 1. Phòng/Khoa
            'color-2': 'users',        // Màu #2: Indigo -> Tab 2. Cán Bộ & NV
            'color-3': 'permissions',  // Màu #3: Blue   -> Tab 3. Phân Quyền
            'color-4': 'workflows',    // Màu #4: Green  -> Tab 4. Quy Trình
            'color-5': 'themes',       // Màu #5: Yellow -> Tab 5. Giao Diện
        };
        const targetTab = colorMapToTab[colorId];
        if (targetTab) {
            this.applyTabColorLive(targetTab, newColor);
        }
    },

    saveTabColors() {
        const colors = {};
        this.SYSTEM_PALETTE_10.forEach(item => {
            const input = document.getElementById(`tabColor_${item.id}`);
            if (input) colors[item.id] = input.value;
        });
        // Đồng thời lưu ánh xạ sang 5 subnav tabs
        colors['departments'] = colors['color-1'] || '#7c3aed';
        colors['users']       = colors['color-2'] || '#4338ca';
        colors['permissions'] = colors['color-3'] || '#2563eb';
        colors['workflows']   = colors['color-4'] || '#16a34a';
        colors['themes']      = colors['color-5'] || '#eab308';
        colors['rbac-role']   = colors['departments'];
        colors['rbac-user']   = colors['users'];

        localStorage.setItem('hueic_tabColors', JSON.stringify(colors));
        this.applyTabColors();
        Common.showToast('✅ Đã lưu bảng 10 màu chuẩn hệ thống thành công!', 'success');
        this.renderTabColorConfig();
    },

    resetSinglePaletteColor(colorId) {
        const def = this.SYSTEM_PALETTE_10.find(c => c.id === colorId);
        if (!def) return;
        const input = document.getElementById(`tabColor_${colorId}`);
        if (input) input.value = def.hex;
        this.previewPaletteColor(colorId, def.hex);
    },

    resetTabColors() {
        if (!confirm('Khôi phục toàn bộ bảng 10 màu về cài đặt mặc định của HueIC IMP?')) return;
        localStorage.removeItem('hueic_tabColors');
        this.applyTabColors();
        Common.showToast('Đã khôi phục bảng 10 màu mặc định!', 'success');
        this.renderTabColorConfig();
    },

    previewTabColor(tabId, newColor) {
        // Cập nhật preview bar live
        const preview = document.getElementById('tabColorPreviewBar');
        if (preview) {
            const spans = preview.querySelectorAll('span');
            const allTabs = [...this.TAB_COLOR_DEFAULTS, ...this.RBAC_COLOR_DEFAULTS];
            const idx = allTabs.findIndex(t => t.id === tabId);
            if (idx !== -1 && spans[idx]) spans[idx].style.backgroundColor = newColor;
        }
        // Cập nhật icon nhỏ trong row
        const rowIcon = document.querySelector(`#tabColor_${tabId}`)?.closest('.flex')?.querySelector('span[style]');
        if (rowIcon) rowIcon.style.backgroundColor = newColor;
        // Apply live lên tab thực tế
        this.applyTabColorLive(tabId, newColor);
    },

    applyTabColorLive(tabId, color) {
        // Map tabId → element id
        const map = {
            'departments': 'subnav-departments',
            'users':       'subnav-users',
            'permissions': 'subnav-permissions',
            'workflows':   'subnav-workflows',
            'themes':      'subnav-themes',
            'rbac-role':   'btnRbacModeRole',
            'rbac-user':   'btnRbacModeUser',
        };
        const elId = map[tabId];
        if (!elId) return;
        const el = document.getElementById(elId);
        if (!el) return;
        // Update data-active to use inline style instead of Tailwind class
        el.dataset.activeColor = color;
        // If this tab is currently active, apply color immediately
        if (el.classList.contains('text-white')) {
            el.style.backgroundColor = color;
        }
    },

    applyTabColors() {
        // Called on page init to load saved colors and update data-active
        const saved = this.getTabColors();
        const allTabs = [...this.TAB_COLOR_DEFAULTS, ...this.RBAC_COLOR_DEFAULTS];
        const map = {
            'departments': 'subnav-departments',
            'users':       'subnav-users',
            'permissions': 'subnav-permissions',
            'workflows':   'subnav-workflows',
            'themes':      'subnav-themes',
            'rbac-role':   'btnRbacModeRole',
            'rbac-user':   'btnRbacModeUser',
        };
        allTabs.forEach(tab => {
            const color = saved[tab.id] || tab.defaultColor;
            const el = document.getElementById(map[tab.id]);
            if (el) el.dataset.activeColor = color;
        });
    },

    saveTabColors() {
        const allTabs = [...this.TAB_COLOR_DEFAULTS, ...this.RBAC_COLOR_DEFAULTS];
        const colors = {};
        allTabs.forEach(tab => {
            const input = document.getElementById(`tabColor_${tab.id}`);
            if (input) colors[tab.id] = input.value;
        });
        localStorage.setItem('hueic_tabColors', JSON.stringify(colors));
        this.applyTabColors();
        Common.showToast('✅ Đã lưu màu tab thành công!', 'success');
        this.renderTabColorConfig();
    },

    resetSingleTabColor(tabId) {
        const allTabs = [...this.TAB_COLOR_DEFAULTS, ...this.RBAC_COLOR_DEFAULTS];
        const def = allTabs.find(t => t.id === tabId);
        if (!def) return;
        const input = document.getElementById(`tabColor_${tabId}`);
        if (input) input.value = def.defaultColor;
        this.previewTabColor(tabId, def.defaultColor);
    },

    resetTabColors() {
        if (!confirm('Khôi phục toàn bộ màu tab về cài đặt mặc định?')) return;
        localStorage.removeItem('hueic_tabColors');
        this.applyTabColors();
        Common.showToast('Đã khôi phục màu tab mặc định!', 'success');
        this.renderTabColorConfig();
    },

};

document.addEventListener('DOMContentLoaded', () => {
    SettingsPage.init();
});
