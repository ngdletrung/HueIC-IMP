/**
 * HueIC IMP - Tasks Module: Data Access Service Layer
 * Encapsulates backend API communication, error handling, and response transformation.
 */
window.TasksService = {
    async fetchAllMetadata() {
        const [depts, users, workflows] = await Promise.all([
            API.getDepartments().catch(e => { console.warn('Lỗi tải phòng ban:', e); return []; }),
            API.getUsers().catch(e => { console.warn('Lỗi tải người dùng:', e); return []; }),
            API.getWorkflows ? API.getWorkflows().catch(e => { console.warn('Lỗi tải quy trình:', e); return []; }) : Promise.resolve([])
        ]);

        TasksStore.setBatch({
            departments: Array.isArray(depts) ? depts : (depts.items || []),
            users: Array.isArray(users) ? users : (users.items || []),
            workflows: Array.isArray(workflows) ? workflows : (workflows.items || [])
        });
    },

    async fetchTasks(filters = {}) {
        try {
            const res = await API.getTasks(filters);
            const taskList = Array.isArray(res) ? res : (res && res.items ? res.items : []);
            TasksStore.set('tasks', taskList);
            return taskList;
        } catch (e) {
            console.error('[TasksService] Lỗi khi tải danh sách nhiệm vụ:', e);
            Common.showToast('Không thể nạp danh sách công việc', 'error');
            return [];
        }
    },

    async fetchKpiOverview(periodType = 'MONTH', periodKey = null, deptId = null, forceRefresh = false) {
        try {
            const res = await API.getDashboardOverview(periodType, periodKey, deptId, forceRefresh);
            TasksStore.set('kpiOverview', res);
            return res;
        } catch (e) {
            console.error('[TasksService] Lỗi khi nạp BGH KPI Overview:', e);
            return null;
        }
    },

    async fetchPersonalKpi() {
        try {
            return await API.getPersonalKPI();
        } catch (e) {
            console.warn('[TasksService] Lỗi getPersonalKPI:', e);
            return null;
        }
    },

    async fetchDepartmentKpi(deptId) {
        try {
            return await API.getDepartmentKPI(deptId);
        } catch (e) {
            console.warn('[TasksService] Lỗi getDepartmentKPI:', e);
            return null;
        }
    },

    async fetchAlerts(deptId = null) {
        try {
            return await API.getAlerts(deptId);
        } catch (e) {
            console.warn('[TasksService] Lỗi getAlerts:', e);
            return { overdue_count: 0, pending_approval: 0, overload_alerts: [], escalation_queue: [] };
        }
    },

    async updateTaskStatus(taskId, status, comment = '', progress = null) {
        try {
            const body = { status, comment };
            if (progress !== null && progress !== undefined) {
                body.progress_percent = progress;
            }
            const res = await API.updateTaskStatus(taskId, body);
            Common.showToast('Cập nhật trạng thái nhiệm vụ thành công', 'success');
            return res;
        } catch (e) {
            console.error('[TasksService] Lỗi updateTaskStatus:', e);
            Common.showToast(e.message || 'Lỗi khi cập nhật trạng thái', 'error');
            throw e;
        }
    },

    async saveTask(taskData, taskId = null) {
        try {
            let res;
            if (taskId) {
                res = await API.updateTask(taskId, taskData);
                Common.showToast('Cập nhật nhiệm vụ thành công', 'success');
            } else {
                res = await API.createTask(taskData);
                Common.showToast('Tạo nhiệm vụ mới thành công', 'success');
            }
            return res;
        } catch (e) {
            console.error('[TasksService] Lỗi saveTask:', e);
            Common.showToast(e.message || 'Lỗi lưu thông tin nhiệm vụ', 'error');
            throw e;
        }
    },

    async deleteTask(taskId) {
        try {
            await API.deleteTask(taskId);
            Common.showToast('Đã xóa nhiệm vụ thành công', 'success');
            return true;
        } catch (e) {
            console.error('[TasksService] Lỗi deleteTask:', e);
            Common.showToast(e.message || 'Lỗi khi xóa nhiệm vụ', 'error');
            throw e;
        }
    },

    async approveProposal(taskId, decision, notes = '') {
        try {
            const res = await API.approveProposal(taskId, { decision, notes });
            Common.showToast('Xử lý đề xuất thành công', 'success');
            return res;
        } catch (e) {
            console.error('[TasksService] Lỗi approveProposal:', e);
            Common.showToast(e.message || 'Lỗi phê duyệt đề xuất', 'error');
            throw e;
        }
    },

    async togglePeriodLock(periodType, periodKey, isClosed) {
        try {
            const res = await API.togglePeriodLock(periodType, periodKey, isClosed);
            Common.showToast(isClosed ? 'Đã khóa kỳ báo cáo thành công' : 'Đã mở lại kỳ báo cáo', 'success');
            return res;
        } catch (e) {
            console.error('[TasksService] Lỗi togglePeriodLock:', e);
            Common.showToast(e.message || 'Lỗi khóa/mở kỳ', 'error');
            throw e;
        }
    },

    async getPeriodGovernance(periodType, periodKey) {
        try {
            return await API.getPeriodGovernance(periodType, periodKey);
        } catch (e) {
            console.error('[TasksService] Lỗi getPeriodGovernance:', e);
            return null;
        }
    }
};
