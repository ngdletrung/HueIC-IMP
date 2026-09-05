/**
 * HueIC IMP - Tasks Module: Centralized State Store
 * Manages reactive application state for tasks, filters, pagination, and KPI metadata.
 */
window.TasksStore = {
    state: {
        tasks: [],
        departments: [],
        users: [],
        workflows: [],
        currentView: 'report', // 'report' | 'list' | 'kanban' | 'calendar'
        currentArchetype: 'workflow',
        selectedDeptId: null,
        selectedBghUnitId: null,
        bghPeriod: 'month',
        bghPeriodKey: null,
        bghUnitsView: 'table', // 'table' | 'scatter'
        currentPage: 1,
        pageSize: 20,
        filters: {
            status: '',
            priority: '',
            dept_id: '',
            search: '',
            user_id: ''
        },
        quickFilter: 'all', // 'all', 'mine', 'assigned', 'review', 'overdue', 'duesoon', 'ontrack'
        currentTaskDetail: null,
        kpiOverview: null,
        scatterData: [],
        workflowPerformance: [],
        delayRootCauses: null,
        deptsStackedData: [],
        bghActionQueue: { overdue: [], due_soon: [], review: [] },
        bghActiveTaskTab: 'overdue'
    },

    listeners: [],

    subscribe(fn) {
        if (typeof fn === 'function') {
            this.listeners.push(fn);
        }
    },

    notify(key, value) {
        this.listeners.forEach(fn => {
            try { fn(key, value, this.state); } catch (e) { console.error('[TasksStore] Listener error:', e); }
        });
    },

    get(key) {
        return this.state[key];
    },

    set(key, value) {
        this.state[key] = value;
        this.notify(key, value);
    },

    setBatch(updates) {
        Object.assign(this.state, updates);
        Object.keys(updates).forEach(k => this.notify(k, updates[k]));
    },

    getFilteredTasks() {
        const { tasks, filters, quickFilter, selectedDeptId } = this.state;
        const now = new Date();
        const currentUser = JSON.parse(localStorage.getItem('hueic_user') || '{}');
        const currentUserId = currentUser.id;

        return (tasks || []).filter(t => {
            // 1. Lọc theo selectedDeptId (nếu chọn lọc đơn vị BGH)
            if (selectedDeptId) {
                const matchDept = (t.leading_dept_id === parseInt(selectedDeptId)) ||
                                  (t.assignee && t.assignee.department_id === parseInt(selectedDeptId));
                if (!matchDept) return false;
            }

            // 2. Lọc theo dropdown filter
            if (filters.status && t.status !== filters.status) return false;
            if (filters.priority && t.priority !== filters.priority) return false;
            if (filters.dept_id && t.leading_dept_id !== parseInt(filters.dept_id)) return false;
            if (filters.user_id && t.assignee_id !== parseInt(filters.user_id)) return false;

            // 3. Lọc theo search input
            if (filters.search) {
                const q = filters.search.toLowerCase();
                const titleMatch = (t.title || '').toLowerCase().includes(q);
                const codeMatch = (t.code || '').toLowerCase().includes(q);
                const descMatch = (t.description || '').toLowerCase().includes(q);
                if (!titleMatch && !codeMatch && !descMatch) return false;
            }

            // 4. Lọc theo quickFilter (nút lọc nhanh)
            if (quickFilter === 'mine') {
                return t.assignee_id === currentUserId;
            } else if (quickFilter === 'assigned') {
                return t.creator_id === currentUserId && t.assignee_id !== currentUserId;
            } else if (quickFilter === 'review') {
                return t.status === 'CHO_DUYET';
            } else if (quickFilter === 'overdue') {
                return t.status === 'TRE_HAN' || (t.due_date && new Date(t.due_date) < now && t.status !== 'HOAN_THANH');
            } else if (quickFilter === 'duesoon') {
                if (t.status === 'HOAN_THANH' || t.status === 'HUY_BO') return false;
                if (!t.due_date) return false;
                const d = new Date(t.due_date);
                const diffHours = (d - now) / 3600000;
                return diffHours >= 0 && diffHours <= 48;
            } else if (quickFilter === 'ontrack') {
                if (t.status === 'HOAN_THANH' || t.status === 'HUY_BO') return false;
                if (!t.due_date) return true;
                return new Date(t.due_date) >= now;
            }

            return true;
        });
    },

    getPaginatedTasks() {
        const filtered = this.getFilteredTasks();
        const { currentPage, pageSize } = this.state;
        const total = filtered.length;
        const totalPages = Math.ceil(total / pageSize) || 1;
        const safePage = Math.min(Math.max(1, currentPage), totalPages);
        const start = (safePage - 1) * pageSize;
        const pageItems = filtered.slice(start, start + pageSize);

        return {
            items: pageItems,
            total,
            page: safePage,
            pageSize,
            totalPages
        };
    }
};
