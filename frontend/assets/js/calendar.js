/**
 * CalendarPage v2.5.1 - HueIC IMP
 * Modern Editorial Calendar - Full-Height Adaptive Grid & Day Inspector Modal
 * 4 Views: Month / Week / Day / Agenda (Danh sách)
 * Features: Auto Full-Height Viewport Grid | 2-Line Wrapped Event Chips | Quick Day Modal | Color System
 */
const CalendarPage = {
    currentDate: new Date(),
    currentView: 'month',
    miniCalDate: new Date(),
    allTasks: [],
    filteredTasks: [],
    eventMap: {},
    selectedDept: '',
    searchTerm: '',
    departments: [],

    async init() {
        Common.init('calendar');

        // Cập nhật thông tin user trong sidebar (Common.init đã xử lý header)
        const user = API.getCurrentUser();
        const unEl = document.getElementById('sidebarUserName');
        if (unEl && user) unEl.innerText = user.full_name || user.username;
        const avEl = document.getElementById('sidebarUserAvatar');
        if (avEl && user) avEl.innerText = (user.full_name || user.username).charAt(0).toUpperCase();

        const hash = window.location.hash.replace('#', '');
        if (['month', 'week', 'day', 'agenda'].includes(hash)) this.currentView = hash;
        const dp = new URLSearchParams(window.location.search).get('date');
        if (dp) { const p = new Date(dp + 'T00:00:00'); if (!isNaN(p)) this.currentDate = p; }
        this.miniCalDate = new Date(this.currentDate);

        await this.loadDepartments();
        await this.loadTasks();
        this.setView(this.currentView, true);
    },

    async loadDepartments() {
        try {
            this.departments = await API.getDepartments();
            this.populateDepartmentSelects();
        } catch (e) {
            console.error('[CalendarPage] Error loading departments:', e);
            this.departments = [];
        }
    },

    populateDepartmentSelects() {
        const count = Array.isArray(this.departments) ? this.departments.length : 0;
        const selects = [
            document.getElementById('calendarFilterDept'),
            document.getElementById('calendarFilterDept-m')
        ];
        selects.forEach(sel => {
            if (!sel) return;
            sel.innerHTML = `<option value="">🏢 Tất Cả Đơn Vị (${count} Đơn Vị)</option>` +
                this.departments.map(d => `<option value="${d.id}">[${d.code}] ${d.name}</option>`).join('');
        });
    },

    async loadTasks() {
        try {
            this.allTasks = await API.getTasks({});
        } catch (e) {
            console.error('[CalendarPage] Error loading tasks:', e);
            this.allTasks = [];
        }
        this.applyFilters();
    },

    applyFilters() {
        let list = [...this.allTasks];
        if (this.selectedDept) {
            const deptId = parseInt(this.selectedDept);
            list = list.filter(t => t.leading_department_id === deptId || t.assisting_department_id === deptId);
        }
        if (this.searchTerm) {
            const kw = this.searchTerm.toLowerCase();
            list = list.filter(t => (t.title && t.title.toLowerCase().includes(kw)) ||
                                    (t.description && t.description.toLowerCase().includes(kw)) ||
                                    (t.leading_department && t.leading_department.code.toLowerCase().includes(kw)));
        }
        this.filteredTasks = list;
        this.buildEventMap();
        this.updateSummaryChips();
        this.renderCurrentView();
        this.updateMiniCal();
    },

    handleFilterChange(isMobile = false) {
        const selId = isMobile ? 'calendarFilterDept-m' : 'calendarFilterDept';
        const otherId = isMobile ? 'calendarFilterDept' : 'calendarFilterDept-m';
        const el = document.getElementById(selId);
        if (!el) return;
        this.selectedDept = el.value;
        const otherEl = document.getElementById(otherId);
        if (otherEl) otherEl.value = this.selectedDept;
        this.applyFilters();
    },

    handleSearchInput(event) {
        this.searchTerm = event.target.value.trim();
        this.applyFilters();
    },

    buildEventMap() {
        this.eventMap = {};
        this.filteredTasks.forEach(t => {
            if (!t.due_date) return;
            const k = t.due_date.split('T')[0];
            if (!this.eventMap[k]) this.eventMap[k] = [];
            this.eventMap[k].push(t);
        });
    },

    updateSummaryChips() {
        let od = 0, up = 0, td = 0;
        const today = this._dk(new Date());
        td = (this.eventMap[today] || []).length;
        this.filteredTasks.forEach(t => {
            if (!t.due_date || t.status === 'HOAN_THANH' || t.status === 'HUY_BO') return;
            const ds = typeof Common !== 'undefined' && Common.getDeadlineStatus 
                ? Common.getDeadlineStatus(t.due_date, false)
                : { isOverdue: new Date(t.due_date) < new Date(), isDueSoon: false };
            if (ds.isOverdue) od++;
            if (ds.isDueSoon) up++;
        });
        const s = (id, v) => { const el = document.getElementById(id); if (el) el.innerText = v; };
        s('summaryToday', td); s('summaryOverdue', od); s('summaryUpcoming', up);

        const badge = document.getElementById('navBadgeTasks');
        if (badge) {
            const pending = od + up;
            if (pending > 0) {
                badge.classList.remove('hidden');
                badge.innerText = pending;
            } else {
                badge.classList.add('hidden');
            }
        }
    },

    setView(view, render = true) {
        this.currentView = view;
        window.location.hash = view;
        const all = ['month', 'week', 'day', 'agenda'];
        all.forEach(v => {
            ['', '-m'].forEach(sfx => {
                const btn = document.getElementById('btn-view-' + v + sfx);
                if (!btn) return;
                if (v === view) {
                    btn.className = 'shrink-0 px-3 py-1.5 rounded-md text-xs font-bold bg-[#0E7C7B] text-white shadow-xs transition';
                } else {
                    btn.className = 'shrink-0 px-3 py-1.5 rounded-md text-xs font-semibold text-[#5B6472] hover:bg-white transition';
                }
            });
        });
        this._updateTitle();
        this.updateMiniCal();
        all.forEach(v => {
            const cap = v.charAt(0).toUpperCase() + v.slice(1);
            const el = document.getElementById('view' + cap);
            if (el) el.classList.toggle('hidden', v !== view);
        });
        if (render) {
            this.renderCurrentView();
        }
    },

    renderCurrentView() {
        if (this.currentView === 'month') this.renderMonthView();
        else if (this.currentView === 'week') this.renderWeekView();
        else if (this.currentView === 'day') this.renderDayView();
        else this.renderAgendaView();
    },

    _updateTitle() {
        const el = document.getElementById('calendarTitle'); if (!el) return;
        const d = this.currentDate, lo = 'vi-VN';
        if (this.currentView === 'month') {
            el.innerText = d.toLocaleDateString(lo, { month: 'long', year: 'numeric' });
        } else if (this.currentView === 'week') {
            const mon = this._sow(d), sun = new Date(mon); sun.setDate(sun.getDate() + 6);
            const f = dt => dt.toLocaleDateString(lo, { day: '2-digit', month: '2-digit' });
            el.innerText = 'Tuần ' + this._wn(d) + ' — ' + f(mon) + ' đến ' + f(sun);
        } else if (this.currentView === 'day') {
            el.innerText = d.toLocaleDateString(lo, { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
        } else {
            el.innerText = 'Danh Sách Lịch Trình';
        }
    },

    prevPeriod() {
        const d = this.currentDate;
        if (this.currentView === 'month') this.currentDate = new Date(d.getFullYear(), d.getMonth() - 1, 1);
        else if (this.currentView === 'week') this.currentDate = new Date(d.getTime() - 7 * 86400000);
        else if (this.currentView === 'day') this.currentDate = new Date(d.getTime() - 86400000);
        else this.currentDate = new Date(d.getTime() - 30 * 86400000);
        this.miniCalDate = new Date(this.currentDate);
        this.setView(this.currentView, true);
    },

    nextPeriod() {
        const d = this.currentDate;
        if (this.currentView === 'month') this.currentDate = new Date(d.getFullYear(), d.getMonth() + 1, 1);
        else if (this.currentView === 'week') this.currentDate = new Date(d.getTime() + 7 * 86400000);
        else if (this.currentView === 'day') this.currentDate = new Date(d.getTime() + 86400000);
        else this.currentDate = new Date(d.getTime() + 30 * 86400000);
        this.miniCalDate = new Date(this.currentDate);
        this.setView(this.currentView, true);
    },

    goToday() { 
        this.currentDate = new Date(); 
        this.miniCalDate = new Date(); 
        this.setView(this.currentView, true); 
    },

    goToDate(s) { 
        this.currentDate = new Date(s + 'T00:00:00'); 
        this.miniCalDate = new Date(this.currentDate); 
        this.setView('day', true); 
    },

    miniPrev() { 
        this.miniCalDate = new Date(this.miniCalDate.getFullYear(), this.miniCalDate.getMonth() - 1, 1); 
        this.updateMiniCal(); 
    },

    miniNext() { 
        this.miniCalDate = new Date(this.miniCalDate.getFullYear(), this.miniCalDate.getMonth() + 1, 1); 
        this.updateMiniCal(); 
    },

    updateMiniCal() {
        const el = document.getElementById('miniCalGrid');
        const titleEl = document.getElementById('miniCalTitle');
        if (!el) return;
        const y = this.miniCalDate.getFullYear(), m = this.miniCalDate.getMonth();
        if (titleEl) titleEl.innerText = this.miniCalDate.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' });
        
        const today = this._dk(new Date());
        const sel = this._dk(this.currentDate);
        const firstDay = new Date(y, m, 1);
        const startDow = (firstDay.getDay() + 6) % 7;
        const dim = new Date(y, m + 1, 0).getDate();
        const pmd = new Date(y, m, 0).getDate();
        
        let html = '';
        for (let i = 0; i < 35; i++) {
            let dn, isCurM = false, cd;
            if (i < startDow) { dn = pmd - startDow + i + 1; cd = new Date(y, m - 1, dn); }
            else if (i - startDow < dim) { dn = i - startDow + 1; isCurM = true; cd = new Date(y, m, dn); }
            else { dn = i - startDow - dim + 1; cd = new Date(y, m + 1, dn); }
            
            const dk = this._dk(cd);
            const isWe = [0, 6].includes(cd.getDay());
            const hasEv = (this.eventMap[dk] || []).length > 0 && isCurM;
            const isTd = dk === today;
            const isSel = dk === sel && isCurM;
            
            let cls = 'mini-day';
            if (!isCurM) cls += ' not-m';
            else if (isWe) cls += ' we-m';
            
            if (isTd) cls += ' today-m';
            else if (isSel) cls += ' ring-1.5 ring-[#0E7C7B] text-[#0E7C7B] font-bold bg-[#16233D]';
            
            if (hasEv) cls += ' has-event';
            html += `<div class="${cls}" onclick="CalendarPage.openDayModal('${dk}')" title="${dk}">${dn}</div>`;
        }
        el.innerHTML = html;
    },

    // 1. MONTH VIEW (Full-Height Adaptive Grid with Crisp Enterprise Borders)
    renderMonthView() {
        const grid = document.getElementById('monthGrid');
        if (!grid) return;
        const y = this.currentDate.getFullYear(), m = this.currentDate.getMonth();
        const today = this._dk(new Date());
        
        const firstDay = new Date(y, m, 1);
        const startDow = (firstDay.getDay() + 6) % 7;
        const dim = new Date(y, m + 1, 0).getDate();
        const pmd = new Date(y, m, 0).getDate();

        const totalCells = (startDow + dim > 35) ? 42 : 35;
        const rowCount = totalCells / 7;
        grid.style.gridTemplateRows = `repeat(${rowCount}, minmax(0, 1fr))`;

        let html = '', dc = 1, nc = 1;
        for (let i = 0; i < totalCells; i++) {
            let dn, isCurM = false, cd;
            if (i < startDow) {
                dn = pmd - startDow + i + 1;
                cd = new Date(y, m - 1, dn);
            } else if (dc <= dim) {
                dn = dc++;
                isCurM = true;
                cd = new Date(y, m, dn);
            } else {
                dn = nc++;
                cd = new Date(y, m + 1, dn);
            }
            
            const dk = this._dk(cd);
            const evs = this.eventMap[dk] || [];
            const isToday = dk === today;
            const isWe = [0, 6].includes(cd.getDay());

            let cellCls = 'day-cell group';
            if (!isCurM) cellCls += ' not-month';
            if (isToday) cellCls += ' is-today';
            if (isWe && isCurM) cellCls += ' is-weekend';

            const numPill = isToday 
                ? `<span class="w-6 h-6 rounded-full bg-blue-800 text-white font-black text-xs flex items-center justify-center shadow-xs">${dn}</span>`
                : (isCurM 
                    ? `<span class="w-6 h-6 rounded-full text-slate-800 font-bold text-xs flex items-center justify-center group-hover:bg-slate-200 transition ${isWe ? 'text-red-700' : ''}">${dn}</span>`
                    : `<span class="w-6 h-6 rounded-full text-slate-400 font-medium text-xs flex items-center justify-center">${dn}</span>`);

            const chips = evs.slice(0, 3).map(t => this._chip(t)).join('');
            const moreCount = evs.length - 3;
            const more = moreCount > 0 
                ? `<div class="text-[10px] font-bold text-blue-900 bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded cursor-pointer transition text-center mt-auto border border-blue-200" onclick="event.stopPropagation();CalendarPage.openDayModal('${dk}')">+${moreCount} việc khác</div>` 
                : '';

            html += `
                <div class="${cellCls}" onclick="CalendarPage.openDayModal('${dk}')" title="Bấm để xem lịch trình ngày ${dk}">
                    <div class="flex items-center justify-between shrink-0 mb-1">
                        ${numPill}
                        ${isToday ? `<span class="text-[9.5px] font-bold text-blue-900 bg-blue-100 border border-blue-200 rounded-full px-2 py-0.2">Hôm nay</span>` : (evs.length > 0 ? `<span class="text-[10px] font-bold text-slate-700 bg-slate-100 border border-slate-200 px-1.5 py-0.2 rounded-full">${evs.length} việc</span>` : '')}
                    </div>
                    <div class="day-events-list">
                        ${chips}
                        ${more}
                    </div>
                </div>
            `;
        }
        grid.innerHTML = html;
    },

    // 2. WEEK VIEW
    renderWeekView() {
        const container = document.getElementById('weekGrid');
        if (!container) return;
        const mon = this._sow(this.currentDate);
        const today = this._dk(new Date());
        const days = [];
        const dnames = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ Nhật'];
        for (let i = 0; i < 7; i++) days.push(new Date(mon.getTime() + i * 86400000));

        let hdr = '<div class="grid grid-cols-7 border-b border-slate-300 bg-slate-100/90 divide-x divide-slate-200 sticky top-0 z-10">';
        days.forEach((d, i) => {
            const dk = this._dk(d), isTd = dk === today, isWe = i >= 5;
            hdr += `
                <div class="py-2.5 text-center ${isTd ? 'bg-blue-50/60' : ''}">
                    <div class="text-[11px] font-bold uppercase tracking-wider ${isTd ? 'text-blue-900' : (isWe ? 'text-red-700' : 'text-slate-700')}">${dnames[i]}</div>
                    <div class="flex justify-center mt-1">
                        <span class="${isTd ? 'w-6 h-6 rounded-full bg-blue-800 text-white font-black text-xs inline-flex items-center justify-center shadow-xs' : 'text-slate-800 font-bold text-xs'}">${d.getDate()}</span>
                    </div>
                </div>
            `;
        });
        hdr += '</div>';

        let body = '<div class="grid grid-cols-7 flex-1 min-h-[520px] bg-slate-200 divide-x divide-slate-200">';
        days.forEach((d, i) => {
            const dk = this._dk(d), evs = this.eventMap[dk] || [], isTd = dk === today;
            const bgCol = isTd ? 'bg-blue-50/20' : 'bg-white';
            body += `
                <div class="${bgCol} p-2.5 space-y-2 overflow-y-auto min-h-[300px]">
                    ${evs.length === 0 ? '<div class="text-[11.5px] text-slate-400 text-center pt-10 italic">Không có việc</div>' : ''}
                    ${evs.map(t => this._weekCard(t)).join('')}
                </div>
            `;
        });
        body += '</div>';
        container.innerHTML = hdr + body;
    },

    // 3. DAY VIEW
    renderDayView() {
        const container = document.getElementById('dayContainer');
        if (!container) return;
        const dk = this._dk(this.currentDate), evs = this.eventMap[dk] || [];
        const isToday = dk === this._dk(new Date());

        const taskSec = evs.length === 0
            ? `<div class="bg-[#FFFFFF] rounded-xl border border-[#E4E1D8] p-10 text-center shadow-xs">
                <i class="fa-regular fa-calendar-check text-4xl text-[#C7C2B4] mb-3 block"></i>
                <h4 class="text-sm font-bold text-[#16233D]">Không có nhiệm vụ nào đến hạn ngày này</h4>
                <p class="text-xs text-[#5B6472] mt-1">Bấm nút "Giao việc" để thêm nhiệm vụ mới vào lịch trình</p>
               </div>`
            : `<div class="space-y-3">
                ${evs.map(t => this._dayCard(t)).join('')}
               </div>`;

        container.innerHTML = `
            <div class="bg-[#FFFFFF] p-5 rounded-xl border border-[#E4E1D8] mb-4 flex items-center justify-between shadow-xs">
                <div>
                    <span class="text-xs font-bold text-[#0E7C7B] uppercase tracking-wider">${isToday ? '⭐ Hôm nay' : 'Chi tiết ngày'}</span>
                    <h3 class="font-manrope font-extrabold text-xl text-[#16233D] mt-0.5 capitalize">${this.currentDate.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</h3>
                </div>
                <span class="text-xs font-bold px-3 py-1 bg-[#E4F1F0] text-[#0E7C7B] rounded-full">${evs.length} nhiệm vụ</span>
            </div>
            ${taskSec}
        `;
    },

    // 4. AGENDA VIEW (DANH SÁCH)
    renderAgendaView() {
        const container = document.getElementById('agendaContainer');
        if (!container) return;
        
        const sortedKeys = Object.keys(this.eventMap).sort();
        if (sortedKeys.length === 0) {
            container.innerHTML = `
                <div class="bg-[#FFFFFF] rounded-xl border border-[#E4E1D8] p-12 text-center shadow-xs">
                    <i class="fa-solid fa-list-check text-4xl text-[#C7C2B4] mb-3 block"></i>
                    <h4 class="text-base font-bold text-[#16233D]">Chưa có lịch trình công tác nào</h4>
                    <p class="text-xs text-[#5B6472] mt-1">Danh sách công việc có thời hạn sẽ hiển thị theo trình tự thời gian tại đây</p>
                </div>
            `;
            return;
        }

        let html = '<div class="bg-[#FFFFFF] rounded-xl border border-[#E4E1D8] overflow-hidden shadow-xs divide-y divide-[#E4E1D8]">';
        sortedKeys.forEach(k => {
            const evs = this.eventMap[k];
            const d = new Date(k + 'T00:00:00');
            const dStr = d.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
            
            html += `
                <div class="bg-[#FBFAF7] px-4 py-2.5 font-bold text-xs text-[#5B6472] uppercase tracking-wider flex items-center justify-between">
                    <span>${dStr}</span>
                    <span class="text-[11px] font-bold text-[#0E7C7B] bg-[#E4F1F0] px-2 py-0.5 rounded-full">${evs.length} việc</span>
                </div>
                <div class="divide-y divide-[#F1F0EB]">
                    ${evs.map(t => this._agendaRow(t)).join('')}
                </div>
            `;
        });
        html += '</div>';
        container.innerHTML = html;
    },

    // Quick Day Inspector Modal
    openDayModal(dateKey) {
        const modal = document.getElementById('dayModal');
        const titleEl = document.getElementById('dayModalTitle');
        const countEl = document.getElementById('dayModalCount');
        const bodyEl = document.getElementById('dayModalBody');
        if (!modal || !titleEl || !bodyEl) return;

        const d = new Date(dateKey + 'T00:00:00');
        const dStr = d.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
        titleEl.innerText = dStr;

        const evs = this.eventMap[dateKey] || [];
        if (countEl) countEl.innerText = `${evs.length} công việc`;

        if (evs.length === 0) {
            bodyEl.innerHTML = `
                <div class="text-center py-8 text-[#5B6472]">
                    <i class="fa-regular fa-calendar text-3xl text-[#C7C2B4] mb-2 block"></i>
                    <p class="text-xs italic">Không có nhiệm vụ nào trong ngày này.</p>
                </div>
            `;
        } else {
            bodyEl.innerHTML = evs.map(t => this._dayCard(t)).join('');
        }

        modal.classList.remove('hidden');
    },

    closeDayModal() {
        const modal = document.getElementById('dayModal');
        if (modal) modal.classList.add('hidden');
    },

    // Event Chip for Month View (Enterprise Pill with Department & Colored Status Dot)
    _chip(task) {
        const c = this._colors(task);
        const deptCode = task.leading_department ? task.leading_department.code : 'HueIC';
        return `
            <div onclick="event.stopPropagation();CalendarPage._open(${task.id})" 
                class="ev-chip ${c.bg} ${c.text} ${c.border}" 
                title="${task.title} - [${deptCode}]">
                <span class="w-1.5 h-3.5 rounded-full ${c.dot} shrink-0"></span>
                <span class="font-mono text-[9.5px] font-black opacity-85 shrink-0">[${deptCode}]</span>
                <span class="truncate flex-1 font-medium">${task.title}</span>
            </div>
        `;
    },

    _weekCard(task) {
        const c = this._colors(task);
        const ds = typeof Common !== 'undefined' && Common.getDeadlineStatus ? Common.getDeadlineStatus(task.due_date, task.status === 'HOAN_THANH') : { shortLabel: '', badgeClass: '' };
        return `
            <div onclick="CalendarPage._open(${task.id})" class="p-2.5 rounded-lg border ${c.borderCard} ${c.bgCard} cursor-pointer hover:shadow-md transition block" title="${task.title}">
                <div class="flex items-center justify-between text-[10.5px] mb-1">
                    <span class="font-bold text-slate-800">[${task.leading_department ? task.leading_department.code : 'HueIC'}]</span>
                    ${ds.shortLabel ? `<span class="font-bold text-[10px] ${ds.badgeClass} px-1.5 py-0.2 rounded">${ds.shortLabel}</span>` : ''}
                </div>
                <div class="font-semibold text-slate-900 text-xs leading-snug line-clamp-2">${task.title}</div>
                <div class="flex items-center justify-between mt-2 pt-1.5 border-t border-slate-200 text-[10.5px]">
                    <span class="font-semibold ${c.text}">${this._sn(task.status)}</span>
                    <span class="font-mono font-bold text-slate-900">${task.progress_percent || 0}%</span>
                </div>
            </div>
        `;
    },

    _dayCard(task) {
        const c = this._colors(task);
        const ds = typeof Common !== 'undefined' && Common.getDeadlineStatus ? Common.getDeadlineStatus(task.due_date, task.status === 'HOAN_THANH') : { shortLabel: '', badgeClass: '' };
        return `
            <div onclick="CalendarPage._open(${task.id})" class="flex items-center gap-3.5 p-3 rounded-xl border ${c.borderCard} ${c.bgCard} cursor-pointer hover:shadow-md transition bg-white">
                <div class="w-1.5 h-10 rounded-full shrink-0 ${c.dot}"></div>
                <div class="flex-1 min-w-0">
                    <div class="font-bold text-slate-900 text-xs line-clamp-2">${task.title}</div>
                    <div class="flex items-center flex-wrap gap-x-2 gap-y-1 mt-1">
                        <span class="text-[10.5px] font-bold ${c.text}">${this._sn(task.status)}</span>
                        ${ds.shortLabel ? `<span class="text-[9.5px] ${ds.badgeClass} px-1.5 py-0.2 rounded-full font-bold">${ds.shortLabel}</span>` : ''}
                        ${task.leading_department ? `<span class="text-[9.5px] text-slate-700 font-bold bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">[${task.leading_department.code}]</span>` : ''}
                        ${task.assignee ? `<span class="text-[10.5px] text-slate-600 font-medium"><i class="fa-solid fa-user-tie text-[9px] mr-1 text-slate-400"></i>${task.assignee.full_name}</span>` : ''}
                    </div>
                </div>
                <div class="text-right shrink-0">
                    <div class="text-xs font-mono font-bold text-slate-900">${task.progress_percent || 0}%</div>
                    <div class="w-14 bg-slate-200 rounded-full h-1.5 mt-1 overflow-hidden">
                        <div class="h-full rounded-full ${task.progress_percent >= 100 ? 'bg-emerald-600' : 'bg-blue-700'}" style="width: ${task.progress_percent || 0}%"></div>
                    </div>
                </div>
                <i class="fa-solid fa-chevron-right text-xs text-slate-400"></i>
            </div>
        `;
    },

    _agendaRow(task) {
        const c = this._colors(task);
        const ds = task.due_date && typeof Common !== 'undefined' && Common.getDeadlineStatus ? Common.getDeadlineStatus(task.due_date, task.status === 'HOAN_THANH') : null;
        const pri = { 'THAP': 'Thấp', 'TRUNG_BINH': 'Trung bình', 'CAO': 'Cao', 'KHAN_CAP': 'Khẩn cấp' };
        
        return `
            <div onclick="CalendarPage._open(${task.id})" class="flex items-center gap-3.5 p-3.5 hover:bg-slate-50 cursor-pointer transition">
                <div class="w-1.5 min-h-[38px] rounded-full ${c.dot} shrink-0 self-stretch"></div>
                <div class="flex-1 min-w-0">
                    <div class="font-bold text-slate-900 text-sm leading-snug truncate">${task.title}</div>
                    <div class="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs">
                        <span class="font-bold ${c.text}">${this._sn(task.status)}</span>
                        ${ds ? `<span class="text-[10.5px] font-bold ${ds.badgeClass} px-2 py-0.5 rounded-full">${ds.shortLabel}</span>` : ''}
                        ${task.leading_department ? `<span class="font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-[11px]">[${task.leading_department.code}]</span>` : ''}
                        ${task.assignee ? `<span class="text-slate-600 text-[11px]"><i class="fa-solid fa-user-tie text-[10px] mr-1 text-slate-400"></i>${task.assignee.full_name}</span>` : ''}
                    </div>
                </div>
                <div class="shrink-0 text-right min-w-[60px]">
                    <div class="text-xs font-mono font-bold text-slate-900">${task.progress_percent || 0}%</div>
                    <div class="text-[10px] text-slate-500 font-semibold mt-0.5">${pri[task.priority] || task.priority}</div>
                </div>
            </div>
        `;
    },

    _colors(task) {
        const ds = typeof Common !== 'undefined' && Common.getDeadlineStatus 
            ? Common.getDeadlineStatus(task.due_date, task.status === 'HOAN_THANH') 
            : { isOverdue: false, isDueSoon: false };
            
        if (task.status === 'HOAN_THANH') {
            return { bg: 'bg-emerald-50 text-emerald-900', text: 'text-emerald-800', dot: 'bg-emerald-600', border: 'border-emerald-200', bgCard: 'bg-emerald-50/60', borderCard: 'border-emerald-200' };
        }
        if (ds.isOverdue || task.status === 'TRE_HAN') {
            return { bg: 'bg-red-50 text-red-900', text: 'text-red-800', dot: 'bg-red-600', border: 'border-red-200', bgCard: 'bg-red-50/60', borderCard: 'border-red-200' };
        }
        if (task.status === 'CHO_DUYET' || ds.isDueSoon) {
            return { bg: 'bg-amber-50 text-amber-900', text: 'text-amber-800', dot: 'bg-amber-500', border: 'border-amber-200', bgCard: 'bg-amber-50/60', borderCard: 'border-amber-200' };
        }
        if (task.status === 'TAM_DUNG') {
            return { bg: 'bg-purple-50 text-purple-900', text: 'text-purple-800', dot: 'bg-purple-500', border: 'border-purple-200', bgCard: 'bg-purple-50/60', borderCard: 'border-purple-200' };
        }
        if (task.status === 'HUY_BO') {
            return { bg: 'bg-slate-100 text-slate-600', text: 'text-slate-600', dot: 'bg-slate-400', border: 'border-slate-300', bgCard: 'bg-slate-100', borderCard: 'border-slate-200' };
        }
        return { bg: 'bg-blue-50 text-blue-900', text: 'text-blue-800', dot: 'bg-blue-600', border: 'border-blue-200', bgCard: 'bg-blue-50/60', borderCard: 'border-blue-200' };
    },

    _sn(s) {
        return ({
            'CHUA_BAT_DAU': 'Chưa bắt đầu',
            'DANG_THUC_HIEN': 'Đang thực hiện',
            'CHO_DUYET': 'Chờ nghiệm thu',
            'HOAN_THANH': 'Đã hoàn thành',
            'TAM_DUNG': 'Tạm dừng',
            'HUY_BO': 'Hủy bỏ'
        })[s] || s;
    },

    _open(id) { 
        window.location.href = 'tasks.html?task_id=' + id; 
    },

    _dk(d) { 
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); 
    },

    _sow(d) { 
        const r = new Date(d), day = r.getDay(), diff = day === 0 ? -6 : 1 - day; 
        r.setDate(r.getDate() + diff); 
        r.setHours(0, 0, 0, 0); 
        return r; 
    },

    _wn(d) { 
        const r = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); 
        const dn = r.getUTCDay() || 7; 
        r.setUTCDate(r.getUTCDate() + 4 - dn); 
        const ys = new Date(Date.UTC(r.getUTCFullYear(), 0, 1)); 
        return Math.ceil((((r - ys) / 86400000) + 1) / 7); 
    }
};

document.addEventListener('DOMContentLoaded', () => CalendarPage.init());
