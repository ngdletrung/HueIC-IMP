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

    // 6. Granular Permissions APIs
    getPermissionsCatalog() {
        return this.request('/permissions/catalog');
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
    }
};
