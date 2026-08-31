// Common Javascript Utilities & Layout Handling
const Common = {
    currentUser: null,

    init(activePage = 'dashboard') {
        const token = API.getToken();
        this.currentUser = API.getUser();

        if (!token || !this.currentUser) {
            window.location.href = 'login.html';
            return;
        }

        // 0. Áp dụng giao diện (Theme: default | soft-light | dark)
        this.applyTheme();

        // 1. Cập nhật thông tin Header
        const headerUserName = document.getElementById('headerUserName');
        const headerUserRole = document.getElementById('headerUserRole');
        const headerUserAvatar = document.getElementById('headerUserAvatar');

        if (headerUserName) headerUserName.innerText = this.currentUser.full_name || this.currentUser.username;
        if (headerUserRole) {
            const roleLabels = {
                'SUPERADMIN': 'Quản Trị Viên (SuperAdmin)',
                'DEPT_HEAD': 'Trưởng / Phó Đơn Vị',
                'STAFF': 'Cán Bộ / Giảng Viên'
            };
            const deptCode = this.currentUser.department ? ` • ${this.currentUser.department.code}` : '';
            headerUserRole.innerText = `${roleLabels[this.currentUser.role] || this.currentUser.role}${deptCode}`;
        }
        if (headerUserAvatar) {
            headerUserAvatar.innerText = (this.currentUser.full_name || this.currentUser.username).charAt(0).toUpperCase();
        }

        // 2. Nhận diện thiết bị PC / Mobile / Tablet và gắn thuộc tính nhận diện
        this.detectAndApplyDeviceClasses();
        window.addEventListener('resize', () => {
            this.detectAndApplyDeviceClasses();
        });

        // 3. Cập nhật trạng thái Active của Menu Sidebar
        this.setActiveNav(activePage);

        // 4. Nạp Badge Cảnh báo số việc cần xử lý
        this.loadSidebarBadges();
    },

    async loadSidebarBadges() {
        const badge = document.getElementById('navBadgeTasks');
        if (!badge) return;
        try {
            const data = await API.getStatsSummary({});
            const ov = data?.overview;
            const alerts = (ov?.overdue_tasks || 0) + (ov?.review_tasks || 0);
            if (alerts > 0) {
                badge.classList.remove('hidden');
                badge.innerText = alerts;
            } else {
                badge.classList.add('hidden');
            }
        } catch (e) {
            // Silently ignore
        }
    },

    isMobile() {
        return window.innerWidth < 768 || /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(navigator.userAgent);
    },

    isTablet() {
        return window.innerWidth >= 768 && window.innerWidth < 1024;
    },

    isDesktop() {
        return window.innerWidth >= 1024;
    },

    getDeviceType() {
        if (this.isMobile()) return 'mobile';
        if (this.isTablet()) return 'tablet';
        return 'desktop';
    },

    detectAndApplyDeviceClasses() {
        const body = document.body;
        const deviceType = this.getDeviceType();
        body.classList.remove('device-mobile', 'device-tablet', 'device-desktop');
        body.classList.add(`device-${deviceType}`);
        document.documentElement.setAttribute('data-device', deviceType);
    },

    setActiveNav(activePage) {
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('bg-blue-900', 'text-white');
            link.classList.add('text-slate-300', 'hover:bg-blue-900/50');
        });

        const activeNav = document.getElementById(`nav-${activePage}`);
        if (activeNav) {
            activeNav.classList.remove('text-slate-300', 'hover:bg-blue-900/50');
            activeNav.classList.add('bg-blue-900', 'text-white');
        }
    },

    toggleSidebar(show = null) {
        const sidebar = document.getElementById('mainSidebar');
        const backdrop = document.getElementById('sidebarBackdrop');
        if (!sidebar) return;

        const isCurrentlyOpen = !sidebar.classList.contains('-translate-x-full');
        const shouldOpen = show !== null ? show : !isCurrentlyOpen;

        if (shouldOpen) {
            sidebar.classList.remove('-translate-x-full');
            backdrop?.classList.remove('hidden');
        } else {
            sidebar.classList.add('-translate-x-full');
            backdrop?.classList.add('hidden');
        }
    },

    showToast(message, type = 'info') {
        let toast = document.getElementById('globalToast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'globalToast';
            toast.className = 'fixed bottom-5 right-5 px-4 py-3 rounded-xl shadow-2xl z-50 text-xs font-bold transition-all duration-300 transform translate-y-20 opacity-0 flex items-center space-x-2 border';
            document.body.appendChild(toast);
        }

        const icons = {
            success: '<i class="fa-solid fa-circle-check text-base"></i>',
            error: '<i class="fa-solid fa-circle-exclamation text-base"></i>',
            info: '<i class="fa-solid fa-circle-info text-base"></i>',
            warning: '<i class="fa-solid fa-triangle-exclamation text-base"></i>'
        };

        const colors = {
            success: 'bg-green-800 text-white border-green-700 shadow-green-900/30',
            error: 'bg-red-800 text-white border-red-700 shadow-red-900/30',
            info: 'bg-blue-900 text-white border-blue-800 shadow-blue-950/30',
            warning: 'bg-amber-600 text-white border-amber-500 shadow-amber-900/30'
        };

        toast.className = `fixed bottom-5 right-5 px-4 py-3 rounded-xl shadow-2xl z-50 text-xs font-bold transition-all duration-300 transform flex items-center space-x-2 border ${colors[type] || colors.info}`;
        toast.innerHTML = `${icons[type] || icons.info} <span>${message}</span>`;

        setTimeout(() => toast.classList.remove('translate-y-20', 'opacity-0'), 10);
        setTimeout(() => toast.classList.add('translate-y-20', 'opacity-0'), 3500);
    },

    formatDateTime(isoString) {
        if (!isoString) return '-';
        const d = new Date(isoString);
        if (isNaN(d.getTime())) return '-';
        return d.toLocaleDateString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    },

    formatDate(dateStr) {
        if (!dateStr) return '-';
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return '-';
        return d.toLocaleDateString('vi-VN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    },

    getDeadlineStatus(dueDateStr, isCompleted = false) {
        if (isCompleted) {
            return {
                status: 'completed',
                isOverdue: false,
                isDueSoon: false,
                diffDays: 0,
                label: 'Đã hoàn thành',
                shortLabel: 'Đã hoàn thành',
                badgeClass: 'bg-green-100 text-green-800 border border-green-200 font-bold',
                icon: '<i class="fa-solid fa-check-circle text-green-600 mr-1"></i>'
            };
        }
        if (!dueDateStr) {
            return {
                status: 'none',
                isOverdue: false,
                isDueSoon: false,
                diffDays: 999,
                label: 'Không đặt hạn',
                shortLabel: 'Không đặt hạn',
                badgeClass: 'bg-slate-100 text-slate-500 border border-slate-200',
                icon: '<i class="fa-regular fa-calendar text-slate-400 mr-1"></i>'
            };
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const due = new Date(dueDateStr);
        due.setHours(0, 0, 0, 0);

        const diffTime = due.getTime() - today.getTime();
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
        const formattedDate = this.formatDate(dueDateStr);

        if (diffDays < 0) {
            return {
                status: 'overdue',
                isOverdue: true,
                isDueSoon: false,
                diffDays: diffDays,
                label: `🚨 Quá hạn ${Math.abs(diffDays)} ngày (${formattedDate})`,
                shortLabel: `🚨 Quá hạn ${Math.abs(diffDays)} ngày`,
                badgeClass: 'bg-red-100 text-red-800 border border-red-300 font-bold',
                icon: '<i class="fa-solid fa-circle-exclamation text-red-600 mr-1"></i>'
            };
        } else if (diffDays === 0) {
            return {
                status: 'today',
                isOverdue: false,
                isDueSoon: true,
                diffDays: 0,
                label: `⚡ Hết hạn hôm nay (${formattedDate})`,
                shortLabel: `⚡ Hạn hôm nay`,
                badgeClass: 'bg-amber-100 text-amber-900 border border-amber-300 font-bold',
                icon: '<i class="fa-solid fa-bolt text-amber-600 mr-1"></i>'
            };
        } else if (diffDays <= 2) {
            return {
                status: 'soon',
                isOverdue: false,
                isDueSoon: true,
                diffDays: diffDays,
                label: `⏳ Còn ${diffDays} ngày (${formattedDate})`,
                shortLabel: `⏳ Còn ${diffDays} ngày`,
                badgeClass: 'bg-amber-50 text-amber-800 border border-amber-200 font-semibold',
                icon: '<i class="fa-solid fa-hourglass-half text-amber-600 mr-1"></i>'
            };
        } else {
            return {
                status: 'ontrack',
                isOverdue: false,
                isDueSoon: false,
                diffDays: diffDays,
                label: `Hạn: ${formattedDate}`,
                shortLabel: `Hạn: ${formattedDate}`,
                badgeClass: 'bg-slate-100 text-slate-600 border border-slate-200',
                icon: '<i class="fa-regular fa-calendar text-slate-500 mr-1"></i>'
            };
        }
    },

    // ----------------------------------------------------
    // SYSTEM THEME, STATUS & PRIORITY METADATA CONFIG
    // ----------------------------------------------------
    DEFAULT_STATUS_CONFIG: [
        { code: 'CHUA_BAT_DAU', label: 'Chưa bắt đầu', color: '#8B96AC', bg: '#F1F0EB', tone: 'grey', order: 1 },
        { code: 'DANG_THUC_HIEN', label: 'Đang làm', color: '#0E7C7B', bg: '#E4F1F0', tone: 'teal', order: 2 },
        { code: 'CHO_DUYET', label: 'Chờ duyệt', color: '#C17817', bg: '#FBF0DF', tone: 'amber', order: 3 },
        { code: 'TRE_HAN', label: 'Quá hạn', color: '#B3261E', bg: '#FBE9E7', tone: 'red', order: 4 },
        { code: 'HOAN_THANH', label: 'Hoàn thành', color: '#3B8B6E', bg: '#E7F3EC', tone: 'green', order: 5 },
        { code: 'TAM_DUNG', label: 'Tạm dừng', color: '#6B5B95', bg: '#EFEBF6', tone: 'purple', order: 6 }
    ],

    DEFAULT_PRIORITY_CONFIG: [
        { code: 'KHAN_CAP', label: 'Khẩn cấp', color: '#B3261E', order: 1 },
        { code: 'CAO', label: 'Mức độ cao', color: '#C17817', order: 2 },
        { code: 'TRUNG_BINH', label: 'Trung bình', color: '#0E7C7B', order: 3 },
        { code: 'THAP', label: 'Mức độ thấp', color: '#8B96AC', order: 4 }
    ],

    getStatusConfig() {
        try {
            const raw = localStorage.getItem('hueic_status_config');
            if (raw) return JSON.parse(raw);
        } catch (e) {}
        return JSON.parse(JSON.stringify(this.DEFAULT_STATUS_CONFIG));
    },

    saveStatusConfig(cfg) {
        localStorage.setItem('hueic_status_config', JSON.stringify(cfg));
    },

    getPriorityConfig() {
        try {
            const raw = localStorage.getItem('hueic_priority_config');
            if (raw) return JSON.parse(raw);
        } catch (e) {}
        return JSON.parse(JSON.stringify(this.DEFAULT_PRIORITY_CONFIG));
    },

    savePriorityConfig(cfg) {
        localStorage.setItem('hueic_priority_config', JSON.stringify(cfg));
    },

    resetDefaultStatusPriorityConfig() {
        localStorage.removeItem('hueic_status_config');
        localStorage.removeItem('hueic_priority_config');
        return {
            statuses: JSON.parse(JSON.stringify(this.DEFAULT_STATUS_CONFIG)),
            priorities: JSON.parse(JSON.stringify(this.DEFAULT_PRIORITY_CONFIG))
        };
    },

    // ----------------------------------------------------
    // EYE-CARE VISUAL THEME ENGINE (SOFT-LIGHT & DARK MODE)
    // ----------------------------------------------------
    getTheme() {
        return localStorage.getItem('hueic_imp_theme') || 'soft-light';
    },

    setTheme(themeName) {
        localStorage.setItem('hueic_imp_theme', themeName);
        this.applyTheme(themeName);
    },

    applyTheme(theme = null) {
        const t = theme || this.getTheme();
        document.documentElement.setAttribute('data-theme', t);

        let styleEl = document.getElementById('hueic-theme-styles');
        if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = 'hueic-theme-styles';
            document.head.appendChild(styleEl);
        }

        if (t === 'dark') {
            styleEl.innerHTML = `
                /* ============================================================ */
                /* HIGH-CONTRAST MODERN DARK THEME (CHẾ ĐỘ TỐI TƯƠNG PHẢN CAO)  */
                /* ============================================================ */
                html[data-theme="dark"] body,
                html[data-theme="dark"] main,
                html[data-theme="dark"] .bg-slate-100 {
                    background-color: #0B0F19 !important;
                    color: #F8FAFC !important;
                }
                html[data-theme="dark"] header,
                html[data-theme="dark"] .bg-white {
                    background-color: #1E293B !important;
                    border-color: #334155 !important;
                    color: #F8FAFC !important;
                }
                html[data-theme="dark"] .bg-slate-50 {
                    background-color: #151F32 !important;
                    border-color: #334155 !important;
                }
                html[data-theme="dark"] .bg-slate-200 {
                    background-color: #334155 !important;
                }
                html[data-theme="dark"] .bg-indigo-50\\/80,
                html[data-theme="dark"] .bg-indigo-50\\/50,
                html[data-theme="dark"] .bg-indigo-50 {
                    background-color: #1E2238 !important;
                    border-color: #3730A3 !important;
                }

                /* TYPOGRAPHY (CHỮ SÁNG RÕ RÀNG, DỄ ĐỌC TUYỆT ĐỐI) */
                html[data-theme="dark"] h1,
                html[data-theme="dark"] h2,
                html[data-theme="dark"] h3,
                html[data-theme="dark"] h4,
                html[data-theme="dark"] .text-slate-900,
                html[data-theme="dark"] .text-slate-800,
                html[data-theme="dark"] .text-indigo-950 {
                    color: #FFFFFF !important;
                }
                html[data-theme="dark"] .text-slate-700,
                html[data-theme="dark"] .text-slate-600 {
                    color: #E2E8F0 !important;
                }
                html[data-theme="dark"] .text-slate-500,
                html[data-theme="dark"] .text-slate-400 {
                    color: #CBD5E1 !important;
                }
                html[data-theme="dark"] label {
                    color: #E2E8F0 !important;
                }

                /* FORM CONTROLS (INPUT / SELECT / TEXTAREA) */
                html[data-theme="dark"] select,
                html[data-theme="dark"] input:not([type="checkbox"]):not([type="radio"]):not([type="color"]),
                html[data-theme="dark"] textarea {
                    background-color: #0F172A !important;
                    border: 1px solid #475569 !important;
                    color: #FFFFFF !important;
                }
                html[data-theme="dark"] select:focus,
                html[data-theme="dark"] input:focus,
                html[data-theme="dark"] textarea:focus {
                    border-color: #60A5FA !important;
                    box-shadow: 0 0 0 3px rgba(96, 165, 250, 0.25) !important;
                    outline: none !important;
                }
                html[data-theme="dark"] input::placeholder,
                html[data-theme="dark"] textarea::placeholder {
                    color: #94A3B8 !important;
                }

                /* BORDERS & CARDS */
                html[data-theme="dark"] .border-slate-200,
                html[data-theme="dark"] .border-slate-100,
                html[data-theme="dark"] .border-slate-300 {
                    border-color: #334155 !important;
                }
                html[data-theme="dark"] .divide-slate-100 > * + *,
                html[data-theme="dark"] .divide-slate-200 > * + * {
                    border-color: #334155 !important;
                }

                /* TABLES */
                html[data-theme="dark"] thead,
                html[data-theme="dark"] th {
                    background-color: #0F172A !important;
                    color: #F1F5F9 !important;
                    border-color: #334155 !important;
                }
                html[data-theme="dark"] tbody tr {
                    border-color: #334155 !important;
                }
                html[data-theme="dark"] tbody tr:hover {
                    background-color: rgba(51, 65, 85, 0.4) !important;
                }
                html[data-theme="dark"] td {
                    color: #F8FAFC !important;
                }

                /* SHADOWS */
                html[data-theme="dark"] .shadow-xs,
                html[data-theme="dark"] .shadow-sm,
                html[data-theme="dark"] .shadow-md,
                html[data-theme="dark"] .shadow-lg,
                html[data-theme="dark"] .shadow-2xl {
                    box-shadow: 0 4px 12px -2px rgba(0, 0, 0, 0.7) !important;
                }
            `;
        } else {
            // Mặc định: Soft Light (Sáng Dịu Mắt)
            styleEl.innerHTML = `
                /* ============================================================ */
                /* EYE-CARE SOFT LIGHT THEME (CHẾ ĐỘ SÁNG DỊU MẮT - MẶC ĐỊNH)   */
                /* ============================================================ */
                html body,
                html main,
                html .bg-slate-100 {
                    background-color: #F4F6F8 !important;
                }
                html header,
                html .bg-white {
                    background-color: #FFFFFF !important;
                    border-color: #E2E8F0 !important;
                }
                html .text-slate-900,
                html .text-slate-800 {
                    color: #1E293B !important;
                }
                html .text-slate-700,
                html .text-slate-600 {
                    color: #334155 !important;
                }
                html .text-slate-500,
                html .text-slate-400 {
                    color: #64748B !important;
                }
                html .bg-slate-50 {
                    background-color: #F1F5F9 !important;
                }
                html .border-slate-200,
                html .border-slate-100 {
                    border-color: #E2E8F0 !important;
                }
                html select,
                html input:not([type="checkbox"]):not([type="radio"]):not([type="color"]),
                html textarea {
                    background-color: #FFFFFF !important;
                    border: 1px solid #CBD5E1 !important;
                    color: #1E293B !important;
                }
                html select:focus,
                html input:focus,
                html textarea:focus {
                    border-color: #3B82F6 !important;
                    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15) !important;
                    outline: none !important;
                }
            `;
        }
    }
};
