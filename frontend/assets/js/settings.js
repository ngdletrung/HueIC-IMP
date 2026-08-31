// Settings Page Logic (settings.html)
const SettingsPage = {
    departments: [],
    users: [],
    workflows: [],
    currentSubTab: 'departments',
    deptViewMode: 'cards', // 'cards' | 'table'
    selectedPermUserId: null,
    permissionCatalog: null,
    currentEditingPermissions: [],
    modalWorkflowSteps: [],

    async init() {
        Common.init('settings');

        try {
            await this.loadInitialData();
            this.switchSubTab('departments');
        } catch (e) {
            console.error('Lỗi khởi tạo Settings:', e);
            Common.showToast('Không thể nạp dữ liệu thiết lập', 'error');
        }
    },

    async loadInitialData() {
        const [depts, users] = await Promise.all([
            API.getDepartments(),
            API.getUsers()
        ]);
        this.departments = depts;
        this.users = users;

        const formUserDeptSelect = document.getElementById('formUserDept');
        if (formUserDeptSelect) {
            formUserDeptSelect.innerHTML = '<option value="">-- Thuộc Đơn vị / Phòng / Khoa --</option>' +
                this.departments.map(d => `<option value="${d.id}">${d.name} (${d.code})</option>`).join('');
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

    switchSubTab(subTabId) {
        this.currentSubTab = subTabId;

        document.querySelectorAll('.settings-subnav').forEach(btn => {
            btn.classList.remove('bg-white', 'text-blue-900', 'shadow-xs');
            btn.classList.add('text-slate-600');
        });
        const activeBtn = document.getElementById(`subnav-${subTabId}`);
        if (activeBtn) {
            activeBtn.classList.remove('text-slate-600');
            activeBtn.classList.add('bg-white', 'text-blue-900', 'shadow-xs');
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
        this.renderDepartmentsList();
    },

    renderDepartmentsList() {
        const query = document.getElementById('searchDeptInput')?.value.trim().toLowerCase() || '';
        const list = this.departments.filter(d => 
            d.name.toLowerCase().includes(query) || 
            d.code.toLowerCase().includes(query) ||
            (d.description && d.description.toLowerCase().includes(query))
        );

        const countLabel = document.getElementById('deptCountLabel');
        if (countLabel) countLabel.innerText = `Hiển thị ${list.length} / ${this.departments.length} Đơn vị`;

        // Render Cards View
        const grid = document.getElementById('departmentsGrid');
        if (grid) {
            if (list.length === 0) {
                grid.innerHTML = `<div class="col-span-3 text-center py-10 text-slate-400 text-xs">Không tìm thấy đơn vị nào phù hợp.</div>`;
            } else {
                grid.innerHTML = list.map(d => `
                    <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-xs hover:border-blue-300 transition flex flex-col justify-between">
                        <div>
                            <div class="flex justify-between items-start mb-2">
                                <span class="px-2.5 py-1 bg-blue-50 text-blue-900 font-mono font-bold text-xs rounded-lg border border-blue-200">
                                    ${d.code}
                                </span>
                                <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${d.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}">
                                    ${d.is_active ? 'Hoạt động' : 'Tạm ngưng'}
                                </span>
                            </div>
                            <h4 class="font-bold text-slate-900 text-sm mb-1">${d.name}</h4>
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
                                <button onclick="SettingsPage.deleteDepartment(${d.id}, '${d.name.replace(/'/g, "\'")}')" class="px-2.5 py-1 bg-red-50 hover:bg-red-600 hover:text-white text-red-600 rounded-lg font-semibold transition" title="Xóa">
                                    <i class="fa-solid fa-trash-can"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                `).join('');
            }
        }

        // Render Table View
        const tbody = document.getElementById('departmentsTableBody');
        if (tbody) {
            if (list.length === 0) {
                tbody.innerHTML = `<tr><td colspan="8" class="text-center py-6 text-slate-400 text-xs">Không có dữ liệu phù hợp.</td></tr>`;
            } else {
                tbody.innerHTML = list.map((d, index) => `
                    <tr class="hover:bg-slate-50 border-b border-slate-100 text-xs">
                        <td class="px-4 py-3 text-center text-slate-400 font-mono whitespace-nowrap">${index + 1}</td>
                        <td class="px-4 py-3 font-mono font-bold text-blue-800 whitespace-nowrap">
                            <span class="px-2 py-0.5 bg-blue-50 border border-blue-200 rounded">${d.code}</span>
                        </td>
                        <td class="px-4 py-3 font-bold text-slate-900 whitespace-nowrap">${d.name}</td>
                        <td class="px-4 py-3 text-slate-600 font-mono whitespace-nowrap">${d.phone || '-'}</td>
                        <td class="px-4 py-3 text-slate-600 whitespace-nowrap">${d.email || '-'}</td>
                        <td class="px-4 py-3 text-slate-600 max-w-xs truncate" title="${d.description || ''}">${d.description || '-'}</td>
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
                                <button onclick="SettingsPage.deleteDepartment(${d.id}, '${d.name.replace(/'/g, "\'")}')" class="px-2.5 py-1.5 bg-red-50 hover:bg-red-600 hover:text-white text-red-600 rounded-lg text-xs font-bold transition flex items-center space-x-1" title="Xóa">
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
                Common.showToast('Cập nhật thông tin phòng ban thành công!', 'success');
            } else {
                await API.createDepartment({ code, name, phone, email, description });
                Common.showToast('Thêm mới phòng ban thành công!', 'success');
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
        if (!confirm(`Bạn có chắc chắn muốn xóa đơn vị "${deptName}"?\nLưu ý: Không thể xóa nếu đang có cán bộ trực thuộc.`)) return;

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
                            <button onclick="SettingsPage.openEditUserModal(${u.id})" class="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-800 hover:text-white text-blue-700 rounded-lg text-xs font-bold transition flex items-center space-x-1" title="Chỉnh sửa thông tin">
                                <i class="fa-solid fa-pen-to-square"></i>
                                <span>Sửa</span>
                            </button>
                            <button onclick="SettingsPage.toggleUserStatus(${u.id}, ${u.is_active})" class="p-1.5 px-2 ${u.is_active ? 'bg-slate-100 hover:bg-amber-50 text-slate-600 hover:text-amber-700' : 'bg-green-50 text-green-700 hover:bg-green-100'} rounded-lg text-xs font-bold transition" title="${u.is_active ? 'Khóa tài khoản' : 'Kích hoạt lại'}">
                                <i class="fa-solid ${u.is_active ? 'fa-user-lock' : 'fa-user-check'}"></i>
                            </button>
                            <button onclick="SettingsPage.deleteUser(${u.id}, '${u.full_name.replace(/'/g, "\'")}')" class="p-1.5 px-2 bg-red-50 hover:bg-red-600 hover:text-white text-red-600 rounded-lg text-xs font-bold transition" title="Xóa tài khoản">
                                <i class="fa-solid fa-trash-can"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `).join('');
        } catch (e) {
            Common.showToast('Lỗi tải danh sách nhân sự', 'error');
        }
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

    // 3. Permissions Matrix Logic (RBAC)
    async loadPermissionsView() {
        try {
            const [catalog, users] = await Promise.all([
                API.getPermissionsCatalog(),
                API.getUsers()
            ]);
            this.permissionCatalog = catalog;
            this.users = users;

            this.renderPermUsersList();
            if (!this.selectedPermUserId && this.users.length > 0) {
                this.selectPermUser(this.users[0].id);
            }
        } catch (e) {
            Common.showToast('Lỗi tải cấu hình phân quyền', 'error');
        }
    },

    filterPermUsers() {
        this.renderPermUsersList();
    },

    renderPermUsersList() {
        const list = document.getElementById('permUsersList');
        if (!list) return;

        const q = document.getElementById('searchPermUser')?.value.trim().toLowerCase() || '';
        const filtered = this.users.filter(u => 
            u.full_name.toLowerCase().includes(q) || 
            u.username.toLowerCase().includes(q)
        );

        const countLabel = document.getElementById('permUserCount');
        if (countLabel) countLabel.innerText = `${filtered.length} người`;

        list.innerHTML = filtered.map(u => {
            const isSelected = u.id === this.selectedPermUserId;
            return `
                <div onclick="SettingsPage.selectPermUser(${u.id})" 
                    class="p-2.5 rounded-lg cursor-pointer transition border text-xs flex items-center justify-between ${isSelected ? 'bg-blue-900 text-white border-blue-900 shadow' : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200'}">
                    <div>
                        <div class="font-bold">${u.full_name}</div>
                        <div class="text-[10px] ${isSelected ? 'text-blue-200' : 'text-slate-500'}">
                            @${u.username} • <span class="font-semibold">${u.role}</span> ${u.department ? `(${u.department.code})` : ''}
                        </div>
                    </div>
                    ${isSelected ? '<i class="fa-solid fa-chevron-right text-xs"></i>' : ''}
                </div>
            `;
        }).join('');
    },

    async selectPermUser(userId) {
        this.selectedPermUserId = userId;
        this.renderPermUsersList();

        try {
            const res = await API.getUserPermissions(userId);
            const user = res.user;
            this.currentEditingPermissions = [...res.assigned_permissions];

            document.getElementById('selectedUserFullName').innerText = user.full_name;
            document.getElementById('selectedUserMeta').innerText = `@${user.username} • Vai trò: ${user.role} ${user.department ? '• ' + user.department.name : ''}`;
            this.updatePermCountDisplay();
            this.renderPermissionCheckboxes();
        } catch (e) {
            Common.showToast('Lỗi nạp quyền tài khoản', 'error');
        }
    },

    renderPermissionCheckboxes() {
        const container = document.getElementById('permissionGroupsContainer');
        if (!container || !this.permissionCatalog) return;

        const groups = this.permissionCatalog.groups;
        const allPerms = this.permissionCatalog.permissions;

        container.innerHTML = Object.entries(groups).map(([groupKey, groupName]) => {
            const groupPerms = allPerms.filter(p => p.group === groupKey);
            return `
                <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                    <div class="flex justify-between items-center pb-2.5 mb-3 border-b border-slate-100">
                        <h4 class="font-bold text-xs text-slate-800 flex items-center space-x-1.5">
                            <span class="w-2 h-2 rounded-full bg-blue-800"></span>
                            <span>${groupName}</span>
                        </h4>
                        <button type="button" onclick="SettingsPage.toggleGroupAll('${groupKey}')" class="text-[11px] text-blue-700 hover:underline font-semibold">
                            Chọn tất cả nhóm
                        </button>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                        ${groupPerms.map(p => {
                            const isChecked = this.currentEditingPermissions.includes(p.code);
                            return `
                                <label class="flex items-start p-2.5 bg-slate-50 hover:bg-blue-50/50 border border-slate-200 rounded-lg cursor-pointer transition text-xs select-none">
                                    <input type="checkbox" value="${p.code}" ${isChecked ? 'checked' : ''} 
                                        onchange="SettingsPage.handleCheckboxChange(this)"
                                        class="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-800 focus:ring-blue-800 accent-blue-800">
                                    <div class="ml-2.5">
                                        <div class="font-bold text-slate-800">${p.name}</div>
                                        <div class="text-[10px] text-slate-400 font-mono">${p.code}</div>
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
        if (checkbox.checked) {
            if (!this.currentEditingPermissions.includes(code)) {
                this.currentEditingPermissions.push(code);
            }
        } else {
            this.currentEditingPermissions = this.currentEditingPermissions.filter(p => p !== code);
        }
        this.updatePermCountDisplay();
    },

    toggleGroupAll(groupKey) {
        if (!this.permissionCatalog) return;
        const groupPerms = this.permissionCatalog.permissions.filter(p => p.group === groupKey).map(p => p.code);
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
        const total = this.permissionCatalog ? this.permissionCatalog.permissions.length : 12;
        const el = document.getElementById('selectedUserPermCount');
        if (el) el.innerText = `${this.currentEditingPermissions.length} / ${total}`;
    },

    async resetCurrentPermissionsToDefault() {
        if (!this.selectedPermUserId) return;
        try {
            const res = await API.resetDefaultPermissions(this.selectedPermUserId);
            this.currentEditingPermissions = [...res.assigned_permissions];
            this.updatePermCountDisplay();
            this.renderPermissionCheckboxes();
            Common.showToast(res.message || 'Đã áp dụng quyền mặc định theo vai trò!', 'info');
        } catch (e) {
            Common.showToast('Lỗi gợi ý quyền mặc định', 'error');
        }
    },

    async saveUserPermissions() {
        if (!this.selectedPermUserId) return;

        const btn = document.getElementById('btnSavePerms');
        btn.disabled = true;
        btn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin mr-1"></i> Đang lưu...`;

        try {
            await API.updateUserPermissions(this.selectedPermUserId, this.currentEditingPermissions);
            Common.showToast('Đã lưu cấu hình phân quyền thành công!', 'success');
        } catch (e) {
            Common.showToast(e.message || 'Lỗi khi lưu phân quyền', 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = `<i class="fa-solid fa-floppy-disk mr-1"></i> Lưu Phân Quyền`;
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
    renderThemesConfig() {
        const statuses = Common.getStatusConfig();
        const priorities = Common.getPriorityConfig();

        const statusContainer = document.getElementById('statusConfigList');
        if (statusContainer) {
            statusContainer.innerHTML = statuses.sort((a, b) => (a.order || 0) - (b.order || 0)).map((s, idx) => `
                <div class="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between gap-3">
                    <div class="flex items-center space-x-2">
                        <span class="w-6 h-6 rounded bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center">${s.order || idx + 1}</span>
                        <div>
                            <div class="font-bold text-xs text-slate-800">${s.label}</div>
                            <span class="text-[10px] text-slate-400 font-mono">${s.code}</span>
                        </div>
                    </div>
                    <div class="flex items-center space-x-3">
                        <div class="flex items-center space-x-1.5">
                            <label class="text-[11px] font-medium text-slate-500">Màu:</label>
                            <input type="color" id="statusColor_${s.code}" value="${s.color}" class="w-7 h-7 p-0 border border-slate-300 rounded cursor-pointer">
                        </div>
                        <div class="flex items-center space-x-1.5">
                            <label class="text-[11px] font-medium text-slate-500">Thứ tự:</label>
                            <input type="number" id="statusOrder_${s.code}" value="${s.order || idx + 1}" min="1" max="10" class="w-12 px-1.5 py-1 border border-slate-300 rounded text-center text-xs font-bold">
                        </div>
                    </div>
                </div>
            `).join('');
        }

        const priorityContainer = document.getElementById('priorityConfigList');
        if (priorityContainer) {
            priorityContainer.innerHTML = priorities.sort((a, b) => (a.order || 0) - (b.order || 0)).map((p, idx) => `
                <div class="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between gap-3">
                    <div class="flex items-center space-x-2">
                        <span class="w-6 h-6 rounded bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center">${p.order || idx + 1}</span>
                        <div>
                            <div class="font-bold text-xs text-slate-800">${p.label}</div>
                            <span class="text-[10px] text-slate-400 font-mono">${p.code}</span>
                        </div>
                    </div>
                    <div class="flex items-center space-x-3">
                        <div class="flex items-center space-x-1.5">
                            <label class="text-[11px] font-medium text-slate-500">Màu:</label>
                            <input type="color" id="priorityColor_${p.code}" value="${p.color}" class="w-7 h-7 p-0 border border-slate-300 rounded cursor-pointer">
                        </div>
                        <div class="flex items-center space-x-1.5">
                            <label class="text-[11px] font-medium text-slate-500">Thứ tự:</label>
                            <input type="number" id="priorityOrder_${p.code}" value="${p.order || idx + 1}" min="1" max="10" class="w-12 px-1.5 py-1 border border-slate-300 rounded text-center text-xs font-bold">
                        </div>
                    </div>
                </div>
            `).join('');
        }
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
    }
};

document.addEventListener('DOMContentLoaded', () => {
    SettingsPage.init();
});
