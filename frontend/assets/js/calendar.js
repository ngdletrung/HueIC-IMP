/**
 * CalendarPage v2.3.0 - HueIC IMP
 * Inspired by Google Calendar + Notion Calendar + ClickUp Planner
 * 4 Views: Month / Week / Day / Agenda (danh sach)
 * Features: Full-height Adaptive Grid | Mini-calendar sidebar | Quick Department Filter & Search | Color-coded chips | Summary Badges
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
        Common.detectAndApplyDeviceClasses();
        const user = API.getCurrentUser();
        if (!user) { window.location.href = 'login.html'; return; }
        
        const unEl = document.getElementById('headerUserName');
        if (unEl) unEl.innerText = user.full_name || user.username;
        const avEl = document.getElementById('headerUserAvatar');
        if (avEl) avEl.innerText = (user.full_name || user.username).charAt(0).toUpperCase();

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
        const selects = [
            document.getElementById('calendarFilterDept'),
            document.getElementById('calendarFilterDept-m')
        ];
        selects.forEach(sel => {
            if (!sel) return;
            sel.innerHTML = '<option value="">🏢 Tất Cả Đơn Vị (12 Đơn Vị)</option>' +
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
            const ds = Common.getDeadlineStatus(t.due_date, false);
            if (ds.isOverdue) od++;
            if (ds.isDueSoon) up++;
        });
        const s = (id, v) => { const el = document.getElementById(id); if (el) el.innerText = v; };
        s('summaryToday', td); s('summaryOverdue', od); s('summaryUpcoming', up);
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
                    btn.className = 'shrink-0 px-3 py-1.5 rounded-md text-xs font-bold bg-blue-800 text-white shadow-xs transition';
                } else {
                    btn.className = 'shrink-0 px-3 py-1.5 rounded-md text-xs font-semibold text-slate-600 hover:bg-white transition';
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
            el.innerText = 'Tuần ' + this._wn(d) + ' \u2014 ' + f(mon) + ' đến ' + f(sun);
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
            else if (isSel) cls += ' ring-1.5 ring-blue-500 text-blue-400 font-black bg-blue-900/60';
            
            if (hasEv) cls += ' has-event';
            html += `<div class="${cls}" onclick="CalendarPage.goToDate('${dk}')" title="${dk}">${dn}</div>`;
        }
        el.innerHTML = html;
    },

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

            let cellCls = 'day-cell';
            if (!isCurM) cellCls += ' not-month';
            else if (isWe) cellCls += ' weekend';
            if (isToday) cellCls += ' today-col';

            let numCls = 'day-num';
            if (isToday) numCls += ' today';
            else if (!isCurM) numCls += ' not-month';
            else if (isWe) numCls += ' weekend';

            // Show top 3 chips, rest in "+X khác"
            const maxChips = 3;
            const chips = evs.slice(0, maxChips).map(t => this._chip(t)).join('');
            const moreCount = evs.length - maxChips;
            const more = moreCount > 0 
                ? `<div class="text-[10px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 px-1.5 py-0.5 rounded-md cursor-pointer transition text-center" onclick="event.stopPropagation();CalendarPage.goToDate('${dk}')">+${moreCount} việc khác</div>` 
                : '';

            html += `
                <div class="${cellCls}" onclick="CalendarPage.goToDate('${dk}')" title="Xem chi tiết ngày ${dk}">
                    <div class="day-header">
                        <span class="${numCls}">${dn}</span>
                        ${evs.length > 0 ? `<span class="text-[10px] font-extrabold text-blue-700 bg-blue-100/70 px-1.5 py-0.2 rounded-full">${evs.length} việc</span>` : ''}
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

    renderWeekView() {
        const container = document.getElementById('weekGrid');
        if (!container) return;
        const mon = this._sow(this.currentDate);
        const today = this._dk(new Date());
        const days = [];
        const dnames = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ Nhật'];
        for (let i = 0; i < 7; i++) days.push(new Date(mon.getTime() + i * 86400000));

        let hdr = '<div class="grid grid-cols-7 border-b border-slate-200 bg-white sticky top-0 z-10 shadow-xs">';
        days.forEach((d, i) => {
            const dk = this._dk(d), isTd = dk === today, isWe = i >= 5;
            hdr += `
                <div class="py-3 text-center ${i > 0 ? 'border-l border-slate-200' : ''} ${isTd ? 'bg-blue-50/80' : (isWe ? 'bg-rose-50/40' : '')}">
                    <div class="text-[11px] font-extrabold uppercase tracking-wider ${isTd ? 'text-blue-800' : (isWe ? 'text-rose-600' : 'text-slate-500')}">${dnames[i]}</div>
                    <div class="flex justify-center mt-1">
                        <span class="${isTd ? 'w-8 h-8 rounded-full bg-blue-800 text-white font-black text-sm inline-flex items-center justify-center shadow-sm' : 'text-slate-800 font-black text-base'}">${d.getDate()}</span>
                    </div>
                </div>
            `;
        });
        hdr += '</div>';

        let body = '<div class="grid grid-cols-7 flex-1 min-h-[500px] bg-slate-100 gap-px">';
        days.forEach((d, i) => {
            const dk = this._dk(d), evs = this.eventMap[dk] || [], isTd = dk === today, isWe = i >= 5;
            const bgCol = isTd ? 'bg-blue-50/30' : (isWe ? 'bg-rose-50/20' : 'bg-white');
            body += `
                <div class="${bgCol} p-2 space-y-2 overflow-y-auto">
                    ${evs.length === 0 ? '<div class="text-[11px] text-slate-300 text-center pt-12 italic font-medium">Không có việc</div>' : ''}
                    ${evs.map(t => this._weekCard(t)).join('')}
                </div>
            `;
        });
        body += '</div>';
        container.innerHTML = hdr + body;
    },

    renderDayView() {
        const container = document.getElementById('dayContainer');
        if (!container) return;
        const dk = this._dk(this.currentDate), evs = this.eventMap[dk] || [];
        const isToday = dk === this._dk(new Date());
        const hours = [];
        for (let h = 7; h <= 18; h++) hours.push(h);

        const taskSec = evs.length === 0
            ? `<div class="bg-white rounded-2xl border border-slate-200 p-8 text-center shadow-xs">
                <i class="fa-regular fa-calendar-check text-4xl text-slate-200 mb-3 block"></i>
                <h4 class="text-sm font-bold text-slate-700">Không có nhiệm vụ nào đến hạn ngày này</h4>
                <p class="text-xs text-slate-400 mt-1">Bạn có thể giao nhiệm vụ mới hoặc quay lại xem tháng</p>
                <a href="tasks.html" class="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-blue-800 text-white rounded-lg text-xs font-bold hover:bg-blue-900 shadow-xs transition">
                    <i class="fa-solid fa-plus text-[10px]"></i><span>Giao nhiệm vụ mới</span>
                </a>
               </div>`
            : `<div class="space-y-2.5">${evs.map(t => this._dayCard(t)).join('')}</div>`;

        const todayStr = this.currentDate.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
        
        container.innerHTML = `
            <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between gap-4 mb-5">
                <div class="flex items-center gap-3.5">
                    <div class="text-center shrink-0">
                        <div class="text-[10px] font-extrabold text-slate-400 uppercase">${this.currentDate.toLocaleDateString('vi-VN', { weekday: 'short' })}</div>
                        <div class="w-12 h-12 flex items-center justify-center rounded-2xl font-black text-xl shadow-xs ${isToday ? 'bg-blue-800 text-white' : 'bg-slate-100 text-slate-800'}">${this.currentDate.getDate()}</div>
                    </div>
                    <div>
                        <h3 class="font-black text-slate-900 text-base capitalize">${todayStr}</h3>
                        <p class="text-xs text-slate-500 mt-0.5 font-medium">${evs.length > 0 ? `Có <strong>${evs.length}</strong> nhiệm vụ đến hạn cần xử lý` : 'Không có công việc đến hạn'}</p>
                    </div>
                </div>
                <div class="flex items-center gap-1">
                    <button onclick="CalendarPage.prevPeriod()" class="p-2 text-slate-500 hover:text-blue-800 rounded-lg hover:bg-slate-100 text-xs font-bold"><i class="fa-solid fa-chevron-left"></i></button>
                    <button onclick="CalendarPage.setView('month', true)" class="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition flex items-center gap-1.5"><i class="fa-regular fa-calendar"></i>Về Lưới Tháng</button>
                    <button onclick="CalendarPage.nextPeriod()" class="p-2 text-slate-500 hover:text-blue-800 rounded-lg hover:bg-slate-100 text-xs font-bold"><i class="fa-solid fa-chevron-right"></i></button>
                </div>
            </div>

            <div class="mb-6">
                <h4 class="text-xs font-extrabold text-slate-600 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <i class="fa-solid fa-list-check text-blue-700"></i>
                    <span>Nhiệm vụ đến hạn (${evs.length})</span>
                </h4>
                ${taskSec}
            </div>

            <div>
                <h4 class="text-xs font-extrabold text-slate-600 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <i class="fa-solid fa-clock text-slate-500"></i>
                    <span>Khung Giờ Làm Việc Hành Chính</span>
                </h4>
                <div class="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs divide-y divide-slate-100">
                    ${hours.map(h => {
                        const bg = h === 12 ? 'bg-amber-50/60' : 'bg-white';
                        const badge = h === 7 ? '<span class="text-[11px] text-blue-700 font-bold bg-blue-50 px-2 py-0.5 rounded-full">Bắt đầu giờ Hành chính (07:00)</span>'
                            : (h === 11 ? '<span class="text-[11px] text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded-full">Nghỉ trưa (11:30)</span>'
                            : (h === 13 ? '<span class="text-[11px] text-blue-700 font-bold bg-blue-50 px-2 py-0.5 rounded-full">Bắt đầu ca Chiều (13:30)</span>'
                            : (h === 17 ? '<span class="text-[11px] text-slate-600 font-bold bg-slate-100 px-2 py-0.5 rounded-full">Kết thúc giờ Hành chính (17:00)</span>' : '')));
                        return `
                            <div class="flex items-center gap-3 px-4 py-2.5 ${bg}">
                                <span class="w-14 text-right text-xs font-mono font-bold text-slate-400 shrink-0">${String(h).padStart(2, '0')}:00</span>
                                <div class="w-px h-4 bg-slate-200 shrink-0"></div>
                                <div class="flex-1 text-xs text-slate-400">${badge}</div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    },

    renderAgendaView() {
        const container = document.getElementById('agendaContainer');
        if (!container) return;
        const withDue = this.filteredTasks.filter(t => t.due_date).sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
        const noDue = this.filteredTasks.filter(t => !t.due_date && t.status !== 'HOAN_THANH' && t.status !== 'HUY_BO');
        const today = this._dk(new Date());

        if (!withDue.length && !noDue.length) {
            container.innerHTML = `
                <div class="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs">
                    <i class="fa-regular fa-calendar-xmark text-4xl text-slate-200 mb-3 block"></i>
                    <h4 class="text-base font-bold text-slate-800">Chưa có nhiệm vụ nào trong danh sách</h4>
                    <p class="text-xs text-slate-400 mt-1">Không tìm thấy công việc phù hợp với bộ lọc hiện tại</p>
                    <a href="tasks.html" class="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-blue-800 text-white rounded-lg text-xs font-bold hover:bg-blue-900 shadow-xs transition">
                        <i class="fa-solid fa-plus text-[10px]"></i><span>Giao nhiệm vụ mới</span>
                    </a>
                </div>
            `;
            return;
        }

        let html = '<div class="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden divide-y divide-slate-100">';
        const grouped = {};
        withDue.forEach(t => {
            const dk = t.due_date.split('T')[0];
            if (!grouped[dk]) grouped[dk] = [];
            grouped[dk].push(t);
        });

        Object.keys(grouped).sort().forEach(dk => {
            const d = new Date(dk + 'T00:00:00');
            const isPast = dk < today;
            const isToday = dk === today;
            const label = isToday ? '⭐ Hôm nay — ' + d.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
                                  : d.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
            
            html += `<div class="agenda-date-hdr ${isToday ? 'text-blue-800 bg-blue-50/70 border-b border-blue-200' : (isPast ? 'text-rose-700' : '')}">${label}</div>`;
            grouped[dk].forEach(t => { html += this._agendaRow(t); });
        });

        if (noDue.length) {
            html += '<div class="agenda-date-hdr text-slate-400 bg-slate-50">Nhiệm vụ chưa đặt hạn chót</div>';
            noDue.forEach(t => { html += this._agendaRow(t); });
        }
        html += '</div>';
        container.innerHTML = html;
    },

    _chip(task) {
        const c = this._colors(task);
        const deptBadge = task.leading_department ? `<span class="text-[9px] font-bold opacity-80 shrink-0">[${task.leading_department.code}]</span>` : '';
        const title = task.title.length > 22 ? task.title.substring(0, 22) + '...' : task.title;
        const fullTooltip = `[${task.leading_department ? task.leading_department.code : 'HueIC'}] ${task.title}\nTrạng thái: ${this._sn(task.status)}\nTiến độ: ${task.progress_percent}%\nHạn: ${Common.formatDateTime(task.due_date)}`;

        return `
            <div onclick="event.stopPropagation();CalendarPage._open(${task.id})" class="ev-chip ${c.bg} ${c.text} ${c.border}" title="${fullTooltip}">
                <span class="ev-dot ${c.dot}"></span>
                ${deptBadge}
                <span class="truncate">${title}</span>
            </div>
        `;
    },

    _weekCard(task) {
        const c = this._colors(task);
        const title = task.title.length > 26 ? task.title.substring(0, 26) + '...' : task.title;
        const ds = Common.getDeadlineStatus(task.due_date, task.status === 'HOAN_THANH');
        return `
            <div onclick="CalendarPage._open(${task.id})" class="p-2.5 rounded-xl border ${c.borderCard} ${c.bgCard} cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition block" title="${task.title}">
                <div class="flex items-center justify-between text-[10px] mb-1">
                    <span class="font-black text-slate-700">${task.leading_department ? task.leading_department.code : 'HueIC'}</span>
                    <span class="font-bold text-[10px] ${ds.badgeClass} px-1.5 py-0.2 rounded-full">${ds.shortLabel}</span>
                </div>
                <div class="font-bold text-slate-900 text-xs leading-snug line-clamp-2">${title}</div>
                <div class="flex items-center justify-between mt-2 pt-1.5 border-t border-slate-200/60 text-[10px]">
                    <span class="font-semibold ${c.text}">${this._sn(task.status)}</span>
                    <span class="font-mono font-bold text-slate-700">${task.progress_percent}%</span>
                </div>
            </div>
        `;
    },

    _dayCard(task) {
        const c = this._colors(task);
        const ds = Common.getDeadlineStatus(task.due_date, task.status === 'HOAN_THANH');
        return `
            <div onclick="CalendarPage._open(${task.id})" class="flex items-center gap-3.5 p-3.5 rounded-2xl border ${c.borderCard} ${c.bgCard} cursor-pointer hover:shadow-md transition">
                <div class="w-1.5 h-12 rounded-full shrink-0 ${c.dot}"></div>
                <div class="flex-1 min-w-0">
                    <div class="font-bold text-slate-900 text-sm truncate">${task.title}</div>
                    <div class="flex items-center flex-wrap gap-x-2.5 gap-y-1 mt-1">
                        <span class="text-[11px] font-bold ${c.text}">${this._sn(task.status)}</span>
                        <span class="text-[10px] ${ds.badgeClass} px-2 py-0.5 rounded-full font-bold">${ds.shortLabel}</span>
                        ${task.leading_department ? `<span class="text-[10px] text-slate-600 font-bold bg-white px-2 py-0.5 rounded-md border border-slate-200">[${task.leading_department.code}] ${task.leading_department.name}</span>` : ''}
                        ${task.assignee ? `<span class="text-[11px] text-slate-500 font-medium"><i class="fa-solid fa-user-tie text-[10px] mr-1 text-slate-400"></i>${task.assignee.full_name}</span>` : ''}
                    </div>
                </div>
                <div class="text-right shrink-0">
                    <div class="text-xs font-mono font-black text-slate-800">${task.progress_percent}%</div>
                    <div class="w-14 bg-slate-200 rounded-full h-1.5 mt-1 overflow-hidden">
                        <div class="h-full rounded-full ${task.progress_percent >= 100 ? 'bg-emerald-500' : 'bg-blue-600'}" style="width: ${task.progress_percent}%"></div>
                    </div>
                </div>
                <i class="fa-solid fa-chevron-right text-xs text-slate-300"></i>
            </div>
        `;
    },

    _agendaRow(task) {
        const c = this._colors(task);
        const ds = task.due_date ? Common.getDeadlineStatus(task.due_date, task.status === 'HOAN_THANH') : null;
        const pri = { 'THAP': 'Thấp', 'TRUNG_BINH': 'Trung bình', 'CAO': 'Cao', 'KHAN_CAP': 'Khẩn cấp' };
        
        return `
            <div onclick="CalendarPage._open(${task.id})" class="agenda-row">
                <div class="w-1.5 min-h-[42px] rounded-full ${c.dot} shrink-0 self-stretch"></div>
                <div class="flex-1 min-w-0">
                    <div class="font-bold text-slate-900 text-sm leading-snug truncate">${task.title}</div>
                    <div class="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs">
                        <span class="font-bold ${c.text}">${this._sn(task.status)}</span>
                        ${ds ? `<span class="text-[11px] font-bold ${ds.badgeClass} px-2 py-0.5 rounded-full">${ds.shortLabel}</span>` : ''}
                        ${task.leading_department ? `<span class="font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md text-[11px]">[${task.leading_department.code}]</span>` : ''}
                        ${task.assignee ? `<span class="text-slate-500 text-[11px]"><i class="fa-solid fa-user-tie text-[10px] mr-1 text-slate-400"></i>${task.assignee.full_name}</span>` : ''}
                    </div>
                </div>
                <div class="shrink-0 text-right min-w-[60px]">
                    <div class="text-xs font-mono font-black text-slate-700">${task.progress_percent}%</div>
                    <div class="text-[10px] text-slate-400 font-semibold mt-0.5">${pri[task.priority] || task.priority}</div>
                </div>
            </div>
        `;
    },

    _colors(task) {
        const ds = Common.getDeadlineStatus(task.due_date, task.status === 'HOAN_THANH');
        if (task.status === 'HOAN_THANH') {
            return { bg: 'bg-emerald-50', text: 'text-emerald-800', dot: 'bg-emerald-500', border: 'border-emerald-500', bgCard: 'bg-emerald-50/50', borderCard: 'border-emerald-200' };
        }
        if (ds.isOverdue) {
            return { bg: 'bg-red-50', text: 'text-red-800', dot: 'bg-red-500', border: 'border-red-500', bgCard: 'bg-red-50/60', borderCard: 'border-red-200' };
        }
        if (task.status === 'CHO_DUYET') {
            return { bg: 'bg-amber-50', text: 'text-amber-900', dot: 'bg-amber-500', border: 'border-amber-500', bgCard: 'bg-amber-50/60', borderCard: 'border-amber-200' };
        }
        if (task.status === 'TAM_DUNG') {
            return { bg: 'bg-purple-50', text: 'text-purple-900', dot: 'bg-purple-500', border: 'border-purple-500', bgCard: 'bg-purple-50/60', borderCard: 'border-purple-200' };
        }
        if (task.status === 'HUY_BO') {
            return { bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400', border: 'border-slate-400', bgCard: 'bg-slate-50', borderCard: 'border-slate-200' };
        }
        if (ds.isDueSoon) {
            return { bg: 'bg-amber-50', text: 'text-amber-800', dot: 'bg-amber-500', border: 'border-amber-400', bgCard: 'bg-amber-50/50', borderCard: 'border-amber-200' };
        }
        if (task.priority === 'KHAN_CAP') {
            return { bg: 'bg-red-50', text: 'text-red-800', dot: 'bg-red-500', border: 'border-red-500', bgCard: 'bg-red-50/50', borderCard: 'border-red-200' };
        }
        return { bg: 'bg-blue-50', text: 'text-blue-800', dot: 'bg-blue-600', border: 'border-blue-600', bgCard: 'bg-blue-50/40', borderCard: 'border-blue-200' };
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

