// Client API giao tiếp với Backend
const API = {
    BASE_URL: '/api/v1',

    getToken() {
        return localStorage.getItem('hueic_token');
    },

    getUser() {
        const u = localStorage.getItem('hueic_user');
        return u ? JSON.parse(u) : null;
    },

    getCurrentUser() {
        return this.getUser();
    },

    logout() {
        localStorage.removeItem('hueic_token');
        localStorage.removeItem('hueic_user');
        window.location.href = 'login.html';
    },

    async request(endpoint, options = {}) {
        const token = this.getToken();
        const headers = {
            'Content-Type': 'application/json',
            ...(options.headers || {})
        };

        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        try {
            const res = await fetch(`${this.BASE_URL}${endpoint}`, {
                ...options,
                headers
            });

            if (res.status === 401 || res.status === 403) {
                if (window.location.pathname.indexOf('login.html') === -1) {
                    this.logout();
                }
            }

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.detail || 'Có lỗi xảy ra trong quá trình xử lý.');
            }
            return data;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    },

    // 1. Auth APIs
    getMe() {
        return this.request('/auth/me');
    },

    // 2. Statistics APIs
    getStatsSummary(params = {}) {
        const q = new URLSearchParams();
        if (params.dept_id) q.append('dept_id', params.dept_id);
        if (params.user_id) q.append('user_id', params.user_id);
        if (params.start_date) q.append('start_date', params.start_date);
        if (params.end_date) q.append('end_date', params.end_date);
        const qs = q.toString() ? `?${q.toString()}` : '';
        return this.request(`/stats/summary${qs}`);
    },

    // 3. Department APIs
    getDepartments() {
        return this.request('/departments');
    },
    createDepartment(data) {
        return this.request('/departments', { method: 'POST', body: JSON.stringify(data) });
    },
    updateDepartment(id, data) {
        return this.request(`/departments/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    },
    deleteDepartment(id) {
        return this.request(`/departments/${id}`, { method: 'DELETE' });
    },

    // 4. User APIs
    getUsers(deptId = null) {
        let url = '/users';
        if (deptId) url += `?department_id=${deptId}`;
        return this.request(url);
    },
    getUserDetail(id) {
        return this.request(`/users/${id}`);
    },
    createUser(data) {
        return this.request('/users', { method: 'POST', body: JSON.stringify(data) });
    },
    updateUser(id, data) {
        return this.request(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    },
    deleteUser(id) {
        return this.request(`/users/${id}`, { method: 'DELETE' });
    },

    // 5. Task APIs
    getTasks(filters = {}) {
        const params = new URLSearchParams();
        if (filters.status) params.append('status', filters.status);
        if (filters.priority) params.append('priority', filters.priority);
        if (filters.dept_id) params.append('dept_id', filters.dept_id);
        if (filters.assignee_id) params.append('assignee_id', filters.assignee_id);
        if (filters.user_id) params.append('assignee_id', filters.user_id);
        if (filters.search) params.append('search', filters.search);
        return this.request(`/tasks?${params.toString()}`);
    },
    getTaskDetail(id) {
        return this.request(`/tasks/${id}`);
    },
    createTask(data) {
        return this.request('/tasks', { method: 'POST', body: JSON.stringify(data) });
    },
    updateTask(id, data) {
        return this.request(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    },
    async updateTaskProgress(id, data) {
        const payload = {
            status: data.status,
            progress_percent: data.progress_percent
        };
        if (data.workflow_steps) {
            payload.workflow_steps = data.workflow_steps;
        }
        const res = await this.updateTask(id, payload);
        if (data.comment && data.comment.trim()) {
            await this.addComment(id, data.comment.trim());
        }
        return res;
    },
    getWorkload(department_id = null) {
        const url = department_id ? `/tasks/workload?department_id=${department_id}` : '/tasks/workload';
        return this.request(url);
    },
    deleteTask(id) {
        return this.request(`/tasks/${id}`, { method: 'DELETE' });
    },
    addComment(taskId, content) {
        return this.request(`/tasks/${taskId}/comments`, { method: 'POST', body: JSON.stringify({ content }) });
    },
    addTaskComment(taskId, content) {
        return this.addComment(taskId, content);
    },

    // Assignment Accept / Reject APIs
    acceptTaskAssignment(taskId, note = '') {
        return this.request(`/tasks/${taskId}/assignment/accept`, { method: 'POST', body: JSON.stringify({ note }) });
    },
    rejectTaskAssignment(taskId, reason) {
        return this.request(`/tasks/${taskId}/assignment/reject`, { method: 'POST', body: JSON.stringify({ reason }) });
    },

    // Proposal Approval APIs
    approveTaskProposal(taskId, data) {
        return this.request(`/tasks/${taskId}/proposal/approve`, { method: 'POST', body: JSON.stringify(data) });
    },
    rejectTaskProposal(taskId, reason) {
        return this.request(`/tasks/${taskId}/proposal/reject`, { method: 'POST', body: JSON.stringify({ reason }) });
    },
    requestProposalChanges(taskId, feedback) {
        return this.request(`/tasks/${taskId}/proposal/request-changes`, { method: 'POST', body: JSON.stringify({ feedback }) });
    },
    resubmitTaskProposal(taskId, data) {
        return this.request(`/tasks/${taskId}/proposal/resubmit`, { method: 'POST', body: JSON.stringify(data) });
    },

    // 5.1 Task Notifications APIs
    getNotifications(limit = 25) {
        return this.request(`/tasks/notifications/list?limit=${limit}`);
    },
    markNotificationRead(notifId) {
        return this.request(`/tasks/notifications/${notifId}/read`, { method: 'PUT' });
    },
    markAllNotificationsRead() {
        return this.request('/tasks/notifications/read-all', { method: 'PUT' });
    },

    // 6. Granular Permissions APIs
    getPermissionsCatalog() {
        return this.request('/permissions/catalog');
    },
    getPermissionPresets() {
        return this.request('/permissions/presets');
    },
    updateRolePreset(roleKey, permissions) {
        return this.request(`/permissions/presets/${roleKey}`, {
            method: 'PUT',
            body: JSON.stringify({ permissions })
        });
    },
    getUserPermissions(userId) {
        return this.request(`/permissions/users/${userId}`);
    },
    updateUserPermissions(userId, permissions) {
        return this.request(`/permissions/users/${userId}`, {
            method: 'PUT',
            body: JSON.stringify({ permissions })
        });
    },
    resetUserPermissions(userId) {
        return this.request(`/permissions/users/${userId}/reset-default`, {
            method: 'POST'
        });
    },
    resetDefaultPermissions(userId) {
        return this.resetUserPermissions(userId);
    },
    toggleUserActive(userId, isActive) {
        return this.request(`/users/${userId}`, {
            method: 'PUT',
            body: JSON.stringify({ is_active: isActive })
        });
    },

    // 7. Workflow Templates APIs
    getWorkflows(filters = {}) {
        const params = new URLSearchParams();
        if (filters.dept_id !== undefined && filters.dept_id !== null && filters.dept_id !== '') {
            params.append('dept_id', filters.dept_id);
        }
        if (filters.include_global !== undefined) {
            params.append('include_global', filters.include_global);
        }
        if (filters.search) {
            params.append('search', filters.search);
        }
        const qs = params.toString();
        return this.request(`/workflows${qs ? '?' + qs : ''}`);
    },
    getWorkflowDetail(id) {
        return this.request(`/workflows/${id}`);
    },
    createWorkflow(data) {
        return this.request('/workflows', { method: 'POST', body: JSON.stringify(data) });
    },
    updateWorkflow(id, data) {
        return this.request(`/workflows/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    },
    deleteWorkflow(id) {
        return this.request(`/workflows/${id}`, { method: 'DELETE' });
    },

    // 8. Database Management APIs (Data Center)
    getDatabaseStats() {
        return this.request('/database/stats');
    },
    getTableData(tableName, limit = 50, offset = 0) {
        return this.request(`/database/tables/${tableName}?limit=${limit}&offset=${offset}`);
    },
    exportFullDatabase() {
        return this.request('/database/export/full-json');
    },
    executeSqlQuery(query) {
        return this.request('/database/query', {
            method: 'POST',
            body: JSON.stringify({ query })
        });
    },
    optimizeDatabase() {
        return this.request('/database/optimize', {
            method: 'POST'
        });
    },
    bulkImportTable(tableName, data, mode = 'upsert') {
        return this.request(`/database/import/${tableName}`, {
            method: 'POST',
            body: JSON.stringify({ data, mode })
        });
    },

    // 9. KpiEngine APIs (Đo Lường Hiệu Suất Tác Nghiệp v1.0)
    getPersonalKPI(userId = null, startDate = null, endDate = null) {
        let url = '/kpi/personal';
        const params = [];
        if (userId) params.push(`user_id=${userId}`);
        if (startDate) params.push(`start_date=${startDate}`);
        if (endDate) params.push(`end_date=${endDate}`);
        if (params.length) url += `?${params.join('&')}`;
        return this.request(url);
    },
    getDepartmentKPI(deptId = null, startDate = null, endDate = null) {
        let url = deptId ? `/kpi/department/${deptId}` : '/kpi/department';
        const params = [];
        if (startDate) params.push(`start_date=${startDate}`);
        if (endDate) params.push(`end_date=${endDate}`);
        if (params.length) url += `?${params.join('&')}`;
        return this.request(url);
    },
    getSchoolSPI(startDate = null, endDate = null) {
        let url = '/kpi/spi';
        const params = [];
        if (startDate) params.push(`start_date=${startDate}`);
        if (endDate) params.push(`end_date=${endDate}`);
        if (params.length) url += `?${params.join('&')}`;
        return this.request(url);
    },
    getKpiFormulaVersion() {
        return this.request('/kpi/formula-version');
    },
    requestDeadlineExtension(taskId, newDeadline, reason) {
        return this.request('/kpi/extensions', {
            method: 'POST',
            body: JSON.stringify({ task_id: taskId, requested_new_deadline: newDeadline, reason })
        });
    },
    getDeadlineExtensions(params = {}) {
        let url = '/kpi/extensions';
        const q = [];
        if (params.task_id) q.push(`task_id=${params.task_id}`);
        if (params.status) q.push(`status_filter=${params.status}`);
        if (q.length) url += `?${q.join('&')}`;
        return this.request(url);
    },
    resolveDeadlineExtension(extId, status, note = '') {
        return this.request(`/kpi/extensions/${extId}/resolve`, {
            method: 'PUT',
            body: JSON.stringify({ status, note })
        });
    },
    getAnalyticsDashboard(deptId = null, period = null) {
        let url = '/stats/analytics';
        const q = [];
        if (deptId) q.push(`dept_id=${deptId}`);
        if (period) q.push(`period=${period}`);
        if (q.length) url += `?${q.join('&')}`;
        return this.request(url);
    },
    getWorkloadAlerts(deptId = null) {
        let url = '/stats/workload-alerts';
        if (deptId) url += `?dept_id=${deptId}`;
        return this.request(url);
    },
    getKpiAuditLogs(params = {}) {
        let url = '/kpi/audit-logs';
        const q = [];
        if (params.user_id) q.push(`user_id=${params.user_id}`);
        if (params.dept_id) q.push(`dept_id=${params.dept_id}`);
        if (params.limit) q.push(`limit=${params.limit}`);
        if (q.length) url += `?${q.join('&')}`;
        return this.request(url);
    },

    // 10. BGH Executive Dashboard & Snapshot APIs (v4.0.0 Zero-Lag)
    getDashboardOverview(params = {}) {
        const q = [];
        if (params.period_type) q.push(`period_type=${encodeURIComponent(params.period_type)}`);
        if (params.period_key) q.push(`period_key=${encodeURIComponent(params.period_key)}`);
        if (params.dept_id) q.push(`dept_id=${encodeURIComponent(params.dept_id)}`);
        if (params.force_refresh) q.push(`force_refresh=true`);
        const qs = q.length ? `?${q.join('&')}` : '';
        return this.request(`/dashboard/overview${qs}`);
    },

    getDashboardTrend(params = {}) {
        const q = [];
        if (params.period_type) q.push(`period_type=${encodeURIComponent(params.period_type)}`);
        if (params.count) q.push(`count=${encodeURIComponent(params.count)}`);
        const qs = q.length ? `?${q.join('&')}` : '';
        return this.request(`/dashboard/trend${qs}`);
    },

    getDashboardAlerts(deptId = null) {
        const qs = deptId ? `?dept_id=${encodeURIComponent(deptId)}` : '';
        return this.request(`/dashboard/alerts${qs}`);
    },

    getPeriodSnapshotsList(periodType = 'MONTH') {
        return this.request(`/stats/period-snapshots-list?period_type=${encodeURIComponent(periodType)}`);
    },

    recalculatePeriodSnapshot(periodType, periodKey) {
        return this.request(`/stats/recalculate-period?period_type=${encodeURIComponent(periodType)}&period_key=${encodeURIComponent(periodKey)}`, {
            method: 'POST'
        });
    },

    toggleLockPeriod(periodType, periodKey) {
        return this.request(`/stats/toggle-lock-period?period_type=${encodeURIComponent(periodType)}&period_key=${encodeURIComponent(periodKey)}`, {
            method: 'POST'
        });
    },

    getWorkingHoursConfig() {
        return this.request('/settings/working-hours');
    },

    updateWorkingHoursConfig(data) {
        return this.request('/settings/working-hours', {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }
};
