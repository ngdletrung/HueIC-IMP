/**
 * HueIC IMP - Tasks Module: View Renderer (Table, Kanban, Calendar)
 */
window.TasksViewRenderer = {
    filterByStatus(status) {
        const sel = document.getElementById('filterStatus');
        if (sel) {
            sel.value = status;
        }
        this.loadTasks();
    },

    // ----------------------------------------------------
    // QUICK FILTER CONTROLLERS (Áp dụng bảng 10 màu Soft chuẩn 1..10)
    // ----------------------------------------------------
    QUICK_FILTER_STYLES: {
        all: {
            inactive: 'px-2.5 py-1 rounded-full border border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-400 font-bold transition',
            active: 'px-2.5 py-1 rounded-full border border-slate-500 bg-slate-500 text-white font-bold transition shadow-xs'
        },
        my_tasks: { // Màu #1: Violet
            inactive: 'px-2.5 py-1 rounded-full border border-violet-200 bg-violet-50 text-violet-800 hover:border-violet-400 font-bold transition',
            active: 'px-2.5 py-1 rounded-full border border-violet-500 bg-violet-500 text-white font-bold transition shadow-xs'
        },
        proposals: { // Màu #2: Indigo
            inactive: 'px-2.5 py-1 rounded-full border border-indigo-200 bg-indigo-50 text-indigo-800 hover:border-indigo-400 font-bold transition flex items-center space-x-1',
            active: 'px-2.5 py-1 rounded-full border border-indigo-500 bg-indigo-500 text-white font-bold transition shadow-xs flex items-center space-x-1'
        },
        pending_collab: { // Màu #3: Blue
            inactive: 'px-2.5 py-1 rounded-full border border-blue-200 bg-blue-50 text-blue-800 hover:border-blue-400 font-bold transition flex items-center space-x-1',
            active: 'px-2.5 py-1 rounded-full border border-blue-500 bg-blue-500 text-white font-bold transition shadow-xs flex items-center space-x-1'
        },
        urgent: { // Màu #4: Green / Emerald
            inactive: 'px-2.5 py-1 rounded-full border border-emerald-200 bg-emerald-50 text-emerald-800 hover:border-emerald-400 font-bold transition flex items-center space-x-1',
            active: 'px-2.5 py-1 rounded-full border border-emerald-500 bg-emerald-500 text-white font-bold transition shadow-xs flex items-center space-x-1'
        },
        overdue: { // Màu #5: Yellow / Amber
            inactive: 'px-2.5 py-1 rounded-full border border-amber-200 bg-amber-50 text-amber-800 hover:border-amber-400 font-bold transition flex items-center space-x-1',
            active: 'px-2.5 py-1 rounded-full border border-amber-500 bg-amber-500 text-white font-bold transition shadow-xs flex items-center space-x-1'
        },
        duesoon: { // Màu #6: Orange
            inactive: 'px-2.5 py-1 rounded-full border border-orange-200 bg-orange-50 text-orange-800 hover:border-orange-400 font-bold transition flex items-center space-x-1',
            active: 'px-2.5 py-1 rounded-full border border-orange-500 bg-orange-500 text-white font-bold transition shadow-xs flex items-center space-x-1'
        },
        ontrack: { // Màu #7: Teal
            inactive: 'px-2.5 py-1 rounded-full border border-teal-200 bg-teal-50 text-teal-800 hover:border-teal-400 font-bold transition flex items-center space-x-1',
            active: 'px-2.5 py-1 rounded-full border border-teal-500 bg-teal-500 text-white font-bold transition shadow-xs flex items-center space-x-1'
        }
    },

    setQuickFilter(filterType) {
        this.currentQuickFilter = filterType;

        const pills = ['all', 'my_tasks', 'proposals', 'pending_collab', 'urgent', 'overdue', 'duesoon', 'ontrack'];
        pills.forEach(p => {
            const btn = document.getElementById(`qf-${p}`);
            if (!btn) return;
            const styleDef = this.QUICK_FILTER_STYLES[p] || this.QUICK_FILTER_STYLES.all;
            if (p === filterType) {
                btn.className = styleDef.active;
            } else {
                btn.className = styleDef.inactive;
            }
        });

        this.renderCurrentView();
        window.dispatchEvent(new CustomEvent('taskFiltersChanged'));
    },

    updateQuickFilterBadges() {
        let overdueCount = 0;
        let dueSoonCount = 0;
        let onTrackCount = 0;
        let urgentCount = 0;
        let proposalCount = 0;
        let pendingCollabCount = 0;

        const currentUser = Common.currentUser || API.getUser() || {};
        const userDeptId = currentUser.department_id;
        const isBGH = ['SUPERADMIN', 'BGH'].includes(currentUser.role);
        const isDeptLeader = ['DEPT_HEAD', 'DEPT_VICE'].includes(currentUser.role);

        this.tasks.forEach(t => {
            const isCompleted = (t.status === 'HOAN_THANH');
            const dStatus = Common.getDeadlineStatus(t.due_date, isCompleted);
            
            if (!isCompleted) {
                if (dStatus.isOverdue) overdueCount++;
                else if (dStatus.isDueSoon) dueSoonCount++;
                else onTrackCount++;

                if (t.priority === 'KHAN_CAP') urgentCount++;
            }

            // 1. Đếm đề xuất chờ duyệt
            if (t.type === 'PROPOSAL' && !isCompleted) {
                if (isBGH) {
                    proposalCount++;
                } else if (isDeptLeader && t.leading_dept_id === userDeptId) {
                    proposalCount++;
                } else if (t.created_by_id === currentUser.id) {
                    proposalCount++;
                }
            }

            // 2. Đếm nhiệm vụ chờ xác nhận phối hợp
            if (t.collaboration_status === 'CHO_XAC_NHAN' && !isCompleted) {
                if (isBGH || (userDeptId && t.assisting_dept_id === userDeptId)) {
                    pendingCollabCount++;
                }
            }
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

        const badgeOnTrack = document.getElementById('badgeOnTrackCount');
        if (badgeOnTrack) {
            badgeOnTrack.innerText = onTrackCount;
            badgeOnTrack.classList.toggle('hidden', onTrackCount === 0);
        }

        const badgeUrgent = document.getElementById('badgeUrgentCount');
        if (badgeUrgent) {
            badgeUrgent.innerText = urgentCount;
            badgeUrgent.classList.toggle('hidden', urgentCount === 0);
        }

        const badgeProposal = document.getElementById('badgeProposalCount');
        if (badgeProposal) {
            badgeProposal.innerText = proposalCount;
            badgeProposal.classList.toggle('hidden', proposalCount === 0);
        }

        const badgePendingCollab = document.getElementById('badgePendingCollabCount');
        if (badgePendingCollab) {
            badgePendingCollab.innerText = pendingCollabCount;
            badgePendingCollab.classList.toggle('hidden', pendingCollabCount === 0);
        }
    },

    getFilteredTasks() {
        let list = [...this.tasks];
        const user = API.getCurrentUser();
        const currentUserId = user?.id || user?.user_id;

        if (this.currentQuickFilter === 'my_tasks') {
            list = list.filter(t => t.assignee_id === currentUserId);
        } else if (this.currentQuickFilter === 'proposals') {
            list = list.filter(t => t.type === 'PROPOSAL' && t.status !== 'HOAN_THANH');
        } else if (this.currentQuickFilter === 'pending_collab') {
            list = list.filter(t => t.collaboration_status === 'CHO_XAC_NHAN' && t.status !== 'HOAN_THANH');
        } else if (this.currentQuickFilter === 'urgent') {
            list = list.filter(t => t.priority === 'KHAN_CAP' && t.status !== 'HOAN_THANH');
        } else if (this.currentQuickFilter === 'overdue') {
            list = list.filter(t => t.status !== 'HOAN_THANH' && Common.getDeadlineStatus(t.due_date, false).isOverdue);
        } else if (this.currentQuickFilter === 'duesoon') {
            list = list.filter(t => t.status !== 'HOAN_THANH' && Common.getDeadlineStatus(t.due_date, false).isDueSoon);
        } else if (this.currentQuickFilter === 'ontrack') {
            list = list.filter(t => t.status !== 'HOAN_THANH' && !Common.getDeadlineStatus(t.due_date, false).isOverdue && !Common.getDeadlineStatus(t.due_date, false).isDueSoon);
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
        const currentUser = Common.currentUser || API.getUser() || {};

        const getStatusBadge = (t) => {
            if (t.type === 'PROPOSAL') {
                if (t.status === 'CHO_DUYET') {
                    return '<span class="px-2.5 py-1 bg-amber-100 text-amber-900 rounded-full text-[10px] font-bold whitespace-nowrap border border-amber-300">💡 Chờ phê duyệt</span>';
                } else if (t.status === 'TU_CHOI') {
                    return '<span class="px-2.5 py-1 bg-rose-100 text-rose-800 rounded-full text-[10px] font-bold whitespace-nowrap border border-rose-200">🔄 Yêu cầu sửa</span>';
                } else if (t.status === 'HUY_BO') {
                    return '<span class="px-2.5 py-1 bg-slate-200 text-slate-700 rounded-full text-[10px] font-bold whitespace-nowrap">❌ Bác bỏ</span>';
                }
            }
            const statusBadges = {
                'CHUA_BAT_DAU': '<span class="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-full text-[10px] font-bold whitespace-nowrap">Chưa bắt đầu</span>',
                'DANG_THUC_HIEN': '<span class="px-2.5 py-1 bg-cyan-100 text-cyan-800 rounded-full text-[10px] font-bold whitespace-nowrap">Đang thực hiện</span>',
                'CHO_DUYET': '<span class="px-2.5 py-1 bg-amber-100 text-amber-900 rounded-full text-[10px] font-bold whitespace-nowrap">📋 Chờ phê duyệt</span>',
                'HOAN_THANH': '<span class="px-2.5 py-1 bg-green-100 text-green-800 rounded-full text-[10px] font-bold whitespace-nowrap">Đã hoàn thành</span>',
                'TAM_DUNG': '<span class="px-2.5 py-1 bg-purple-100 text-purple-800 rounded-full text-[10px] font-bold whitespace-nowrap">Tạm dừng</span>',
                'TU_CHOI': '<span class="px-2.5 py-1 bg-rose-100 text-rose-800 rounded-full text-[10px] font-bold whitespace-nowrap">Trả lại</span>',
                'HUY_BO': '<span class="px-2.5 py-1 bg-slate-200 text-slate-600 rounded-full text-[10px] font-bold whitespace-nowrap">Hủy bỏ</span>'
            };
            return statusBadges[t.status] || `<span class="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-full text-[10px] font-bold">${t.status}</span>`;
        };

        const getAssigneeDisplay = (t) => {
            if (t.type === 'PROPOSAL') {
                const creatorName = t.creator ? t.creator.full_name : 'Cán bộ';
                const approverInfo = TasksPage.getProposalApproverInfo(t);
                
                let targetApprover = `<div class="text-[9.5px] text-indigo-700 font-semibold mt-0.5">${approverInfo.icon} Trình duyệt: ${approverInfo.shortText}</div>`;

                return `
                    <div class="text-[10px] text-amber-900 font-semibold mt-0.5">
                        <span class="bg-amber-50 text-amber-800 px-1.5 py-0.5 rounded border border-amber-200">💡 Đề xuất: ${creatorName}</span>
                    </div>
                    ${targetApprover}
                `;
            }
            return `<div class="text-[10px] text-slate-500 mt-0.5">${t.assignee ? t.assignee.full_name : '<span class="font-semibold text-indigo-700">🏢 Tập thể đơn vị</span>'}</div>`;
        };

        const getActionButtons = (t) => {
            // 1. Phê duyệt Đề xuất / Sáng kiến (PROPOSAL)
            if (t.type === 'PROPOSAL' && ['CHO_DUYET', 'CHUA_BAT_DAU'].includes(t.status)) {
                const canApprove = TasksPage.canUserApproveProposal(t, currentUser);
                if (canApprove) {
                    return `
                        <div class="relative inline-block text-left proposal-action-dropdown">
                            <button type="button" onclick="event.stopPropagation(); TasksPage.toggleProposalMenu(${t.id})" 
                                class="px-2.5 py-1.5 bg-purple-700 hover:bg-purple-800 text-white rounded-lg text-xs font-bold transition flex items-center space-x-1 shadow-xs cursor-pointer" title="Lựa chọn quyết định phê duyệt đề xuất">
                                <i class="fa-solid fa-stamp text-[11px]"></i>
                                <span>Phê duyệt</span>
                                <i class="fa-solid fa-chevron-down text-[8.5px] ml-0.5 opacity-80"></i>
                            </button>
                            <div id="proposalMenu_${t.id}" class="proposal-dropdown-menu hidden absolute right-0 mt-1.5 w-56 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 animate-fade-in text-left divide-y divide-slate-100">
                                <button type="button" onclick="TasksPage.openApproveProposalModalById(${t.id})" 
                                    class="w-full px-3 py-2 text-left text-xs font-bold text-emerald-800 hover:bg-emerald-50 flex items-center space-x-2.5 transition cursor-pointer">
                                    <span class="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[10px] shrink-0 font-bold">✅</span>
                                    <div>
                                        <div class="font-bold text-emerald-900">Phê duyệt đề xuất</div>
                                        <div class="text-[9.5px] text-slate-500 font-normal">Chuyển việc &amp; phân công</div>
                                    </div>
                                </button>
                                <button type="button" onclick="TasksPage.openReasonPrompt('REQUEST_PROPOSAL_CHANGES', ${t.id})" 
                                    class="w-full px-3 py-2 text-left text-xs font-bold text-amber-800 hover:bg-amber-50 flex items-center space-x-2.5 transition cursor-pointer">
                                    <span class="w-5 h-5 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-[10px] shrink-0 font-bold">🔄</span>
                                    <div>
                                        <div class="font-bold text-amber-900">Yêu cầu bổ sung</div>
                                        <div class="text-[9.5px] text-slate-500 font-normal">Yêu cầu cán bộ sửa lại</div>
                                    </div>
                                </button>
                                <button type="button" onclick="TasksPage.openReasonPrompt('REJECT_PROPOSAL', ${t.id})" 
                                    class="w-full px-3 py-2 text-left text-xs font-bold text-rose-800 hover:bg-rose-50 flex items-center space-x-2.5 transition cursor-pointer">
                                    <span class="w-5 h-5 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center text-[10px] shrink-0 font-bold">❌</span>
                                    <div>
                                        <div class="font-bold text-rose-900">Bác bỏ đề xuất</div>
                                        <div class="text-[9.5px] text-slate-500 font-normal">Từ chối chủ trương</div>
                                    </div>
                                </button>
                            </div>
                        </div>
                        <button onclick="TasksPage.openTaskDetail(${t.id})" class="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-700 hover:text-white text-slate-700 rounded-lg text-xs font-bold transition flex items-center space-x-1 cursor-pointer" title="Xem chi tiết &amp; trao đổi">
                            <i class="fa-solid fa-eye text-[11px]"></i>
                            <span>Chi tiết</span>
                        </button>
                    `;
                }
                return `
                    <button onclick="TasksPage.openTaskDetail(${t.id})" class="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-700 hover:text-white text-slate-700 rounded-lg text-xs font-bold transition flex items-center space-x-1 cursor-pointer" title="Xem chi tiết đề xuất">
                        <i class="fa-solid fa-eye text-[11px]"></i>
                        <span>Chi tiết</span>
                    </button>
                `;
            }

            // 2. Đề xuất bị yêu cầu chỉnh sửa (TU_CHOI)
            if (t.type === 'PROPOSAL' && t.status === 'TU_CHOI') {
                const isCreator = (Number(t.created_by_id) === Number(currentUser.id) || currentUser.role === 'SUPERADMIN');
                if (isCreator) {
                    return `
                        <button onclick="TasksPage.openResubmitProposalModalById(${t.id})" class="px-2.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition flex items-center space-x-1 shadow-xs cursor-pointer" title="Chỉnh sửa &amp; gửi lại đề xuất">
                            <i class="fa-solid fa-rotate-left text-[11px]"></i>
                            <span>Sửa &amp; Gửi lại</span>
                        </button>
                        <button onclick="TasksPage.openTaskDetail(${t.id})" class="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-700 hover:text-white text-slate-700 rounded-lg text-xs font-bold transition flex items-center space-x-1 cursor-pointer" title="Xem chi tiết đề xuất">
                            <i class="fa-solid fa-eye text-[11px]"></i>
                            <span>Chi tiết</span>
                        </button>
                    `;
                }
            }

            // 3. Nhiệm vụ chờ Lãnh đạo nghiệm thu hoàn thành (CHO_DUYET && type != PROPOSAL)
            const isLeader = ['SUPERADMIN', 'BGH', 'DEPT_HEAD', 'DEPT_VICE'].includes(currentUser.role) || t.created_by_id === currentUser.id;
            if (t.status === 'CHO_DUYET' && isLeader) {
                return `
                    <button onclick="TasksPage.openUpdateModal(${t.id})" class="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center space-x-1 shadow-xs cursor-pointer" title="Nghiệm thu &amp; Phê duyệt hoàn thành nhiệm vụ">
                        <i class="fa-solid fa-circle-check text-[11px]"></i>
                        <span>Nghiệm thu</span>
                    </button>
                    <button onclick="TasksPage.openTaskDetail(${t.id})" class="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-700 hover:text-white text-slate-700 rounded-lg text-xs font-bold transition flex items-center space-x-1 cursor-pointer" title="Xem chi tiết &amp; thảo luận">
                        <i class="fa-solid fa-eye text-[11px]"></i>
                        <span>Chi tiết</span>
                    </button>
                `;
            }

            // 4. Nhiệm vụ đã hoàn thành (HOAN_THANH) hoặc Đã hủy bỏ (HUY_BO) -> Không còn nút Tiến độ
            if (['HOAN_THANH', 'HUY_BO'].includes(t.status)) {
                return `
                    <button onclick="TasksPage.openTaskDetail(${t.id})" class="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-700 hover:text-white text-slate-700 rounded-lg text-xs font-bold transition flex items-center space-x-1 cursor-pointer" title="Xem chi tiết &amp; lịch sử">
                        <i class="fa-solid fa-eye text-[11px]"></i>
                        <span>Chi tiết</span>
                    </button>
                `;
            }

            // 5. Các nhiệm vụ đang thực hiện / thông thường
            return `
                <button onclick="TasksPage.openUpdateModal(${t.id})" class="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-800 hover:text-white text-blue-700 rounded-lg text-xs font-bold transition flex items-center space-x-1" title="Cập nhật tiến độ">
                    <i class="fa-solid fa-pen-to-square"></i>
                    <span>Tiến độ</span>
                </button>
                <button onclick="TasksPage.openTaskDetail(${t.id})" class="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-700 hover:text-white text-slate-700 rounded-lg text-xs font-bold transition flex items-center space-x-1" title="Xem chi tiết &amp; thảo luận">
                    <i class="fa-solid fa-eye text-[11px]"></i>
                    <span>Chi tiết</span>
                </button>
            `;
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
                const proposalBadge = t.type === 'PROPOSAL' ? '<span class="px-1.5 py-0.5 bg-amber-100 text-amber-900 rounded font-bold text-[9.5px] border border-amber-300">💡 Đề xuất</span>' : '';
                
                let assistingHtml = '';
                if (t.assisting_department) {
                    if (t.collaboration_status === 'CHO_XAC_NHAN') {
                        assistingHtml = `<div class="mt-0.5"><span class="px-1.5 py-0.2 bg-amber-50 text-amber-800 rounded font-medium text-[9.5px] border border-amber-200" title="Chờ đơn vị khác tiếp nhận">🤝 Chờ ${t.assisting_department.code} nhận</span></div>`;
                    } else if (t.collaboration_status === 'DA_TIEP_NHAN') {
                        assistingHtml = `<div class="mt-0.5"><span class="px-1.5 py-0.2 bg-emerald-50 text-emerald-800 rounded font-medium text-[9.5px] border border-emerald-200" title="Đã tiếp nhận phối hợp">🤝 ${t.assisting_department.code} phối hợp</span></div>`;
                    } else if (t.collaboration_status === 'TU_CHOI') {
                        assistingHtml = `<div class="mt-0.5"><span class="px-1.5 py-0.2 bg-red-50 text-red-800 rounded font-medium text-[9.5px] border border-red-200" title="Từ chối phối hợp">❌ ${t.assisting_department.code} từ chối</span></div>`;
                    }
                }

                const deptCode = t.type === 'PROPOSAL'
                    ? (t.creator?.department ? t.creator.department.code : (t.leading_department ? t.leading_department.code : 'HueIC'))
                    : (t.leading_department ? t.leading_department.code : '-');

                return `
                    <tr class="hover:bg-slate-50 border-b border-slate-100 text-xs transition">
                        <td class="px-4 py-3 font-mono text-slate-400 text-center">${index + 1}</td>
                        <td class="px-4 py-3">
                            <div class="flex items-center space-x-1.5 mb-0.5">
                                ${proposalBadge}
                                <button onclick="TasksPage.openTaskDetail(${t.id})" class="text-left font-bold text-slate-900 hover:text-blue-800 transition">
                                    ${t.title}
                                </button>
                            </div>
                            ${t.description ? `<p class="text-[11px] text-slate-500 truncate max-w-md mt-0.5">${t.description}</p>` : ''}
                            <div class="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-slate-400 mt-1">
                                <span>✍️ Tạo: <strong class="text-slate-600 font-semibold">${t.creator ? t.creator.full_name : 'Hệ thống'}</strong> (${t.created_at ? Common.formatDateTime(t.created_at) : ''})</span>
                                ${t.approver ? `<span>• 👑 Duyệt: <strong class="text-purple-700 font-semibold">${t.approver.full_name}</strong></span>` : ''}
                                ${t.assigned_by && t.assignee && t.assigned_by.id !== t.assignee.id ? `<span>• 🎯 Giao: <strong class="text-indigo-700 font-semibold">${t.assigned_by.full_name}</strong></span>` : ''}
                            </div>
                        </td>
                        <td class="px-4 py-3 whitespace-nowrap">
                            <div class="font-bold text-blue-900">${deptCode}</div>
                            ${assistingHtml}
                            ${getAssigneeDisplay(t)}
                        </td>
                        <td class="px-4 py-3 whitespace-nowrap">
                            <span class="px-2 py-0.5 rounded-full text-[10px] ${deadlineInfo.badgeClass}">
                                ${deadlineInfo.icon} ${deadlineInfo.shortLabel}
                            </span>
                        </td>
                        <td class="px-4 py-3 whitespace-nowrap">${priorityBadges[t.priority] || t.priority}</td>
                        <td class="px-4 py-3 whitespace-nowrap text-center">${getStatusBadge(t)}</td>
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
                                ${getActionButtons(t)}
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
                const proposalBadge = t.type === 'PROPOSAL' ? '<span class="px-1.5 py-0.5 bg-amber-100 text-amber-900 rounded font-bold text-[9.5px] border border-amber-300">💡 Đề xuất</span>' : '';
                const deptCode = t.type === 'PROPOSAL'
                    ? (t.creator?.department ? t.creator.department.code : (t.leading_department ? t.leading_department.code : 'HueIC'))
                    : (t.leading_department ? t.leading_department.code : 'HueIC');

                return `
                    <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
                        <div class="flex items-start justify-between gap-2">
                            <div class="flex items-center space-x-1.5">
                                ${proposalBadge}
                                <span class="px-2 py-0.5 bg-blue-50 text-blue-900 font-mono font-bold text-[10px] rounded border border-blue-200">
                                    ${deptCode}
                                </span>
                                <span class="px-2 py-0.5 rounded-full text-[10px] ${deadlineInfo.badgeClass}">
                                    ${deadlineInfo.icon} ${deadlineInfo.shortLabel}
                                </span>
                            </div>
                            <div>${getStatusBadge(t)}</div>
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
                                ${getAssigneeDisplay(t)}
                            </div>
                            <div class="flex items-center space-x-1.5">
                                <div class="w-16 bg-slate-200 rounded-full h-2 overflow-hidden">
                                    <div class="h-2 rounded-full ${t.progress_percent >= 100 ? 'bg-green-600' : 'bg-blue-600'}" style="width: ${t.progress_percent}%"></div>
                                </div>
                                <span class="font-mono font-bold text-slate-700 text-xs">${t.progress_percent}%</span>
                            </div>
                        </div>

                        <div class="pt-1 flex items-center justify-end space-x-2">
                            ${getActionButtons(t)}
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
                            <div class="flex items-center space-x-1.5 text-slate-600 truncate max-w-[130px]">
                                ${t.type === 'PROPOSAL' 
                                    ? `<div class="w-5 h-5 rounded-full bg-amber-500 text-white font-bold text-[9px] flex items-center justify-center shrink-0">💡</div>
                                       <span class="truncate text-[10px] font-semibold text-amber-800" title="Đề xuất: ${t.creator ? t.creator.full_name : 'Cán bộ'}">${t.creator ? t.creator.full_name : 'Đề xuất'}</span>`
                                    : `<div class="w-5 h-5 rounded-full ${t.assignee ? 'bg-blue-800' : 'bg-indigo-700'} text-white font-bold text-[9px] flex items-center justify-center shrink-0">
                                            ${t.assignee ? t.assignee.full_name.charAt(0) : '<i class="fa-solid fa-users text-[8px]"></i>'}
                                       </div>
                                       <span class="truncate text-[10px] ${t.assignee ? '' : 'font-semibold text-indigo-700'}" title="${t.assignee ? t.assignee.full_name : 'Tập thể đơn vị'}">${t.assignee ? t.assignee.full_name : 'Tập thể đơn vị'}</span>`
                                }
                            </div>
                            <div class="flex items-center space-x-1">
                                ${t.type === 'PROPOSAL' && t.status === 'CHO_DUYET'
                                    ? `<button onclick="TasksPage.openTaskDetail(${t.id})" class="px-2 py-1 bg-purple-50 hover:bg-purple-600 hover:text-white text-purple-700 rounded text-[10.5px] font-bold transition flex items-center space-x-1" title="Xem xét & Phê duyệt">
                                           <i class="fa-solid fa-stamp text-[10px]"></i>
                                           <span>Duyệt</span>
                                       </button>`
                                    : (['HOAN_THANH', 'HUY_BO'].includes(t.status)
                                        ? `<button onclick="TasksPage.openTaskDetail(${t.id})" class="px-2 py-1 bg-slate-100 hover:bg-slate-700 hover:text-white text-slate-700 rounded text-[10.5px] font-bold transition flex items-center space-x-1" title="Chi tiết & Lịch sử">
                                               <i class="fa-solid fa-eye text-[10px]"></i>
                                               <span>Chi tiết</span>
                                           </button>`
                                        : `<button onclick="TasksPage.openUpdateModal(${t.id})" class="p-1 text-blue-700 hover:bg-blue-50 rounded" title="Cập nhật tiến độ">
                                               <i class="fa-solid fa-pen-to-square"></i>
                                           </button>
                                           <button onclick="TasksPage.openTaskDetail(${t.id})" class="p-1 text-slate-500 hover:bg-slate-100 rounded" title="Chi tiết">
                                               <i class="fa-solid fa-comments"></i>
                                           </button>`
                                      )
                                }
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
    // SMART WORKFLOW SUGGESTER (HUEIC IMP PATTERN)
    // ----------------------------------------------------

};
