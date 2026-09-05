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

        // 4. Áp dụng Phân Quyền Hiển Thị Module trên Sidebar & Chặn Truy Cập Trái Phép
        this.applyModulePermissions(activePage);

        // 5. Nạp Badge Cảnh báo số việc cần xử lý
        this.loadSidebarBadges();

        // 6. Khởi động Trung Tâm Thông Báo Điều Hành
        this.NotificationCenter.init();
    },

    hasPermission(permCode) {
        if (!this.currentUser) return false;
        const role = this.currentUser.role;
        if (role === 'SUPERADMIN') return true;

        const roleDefaults = {
            'SUPERADMIN': [
                "module:dashboard", "module:tasks", "module:calendar", "module:assets", "module:documents", "module:database", "module:settings",
                "scope:school", "scope:dept", "scope:personal",
                "task:dispatch_school", "task:dispatch_dept", "task:todo_personal", "task:edit", "task:progress",
                "task:approve_proposal", "task:approve_complete", "task:extend_deadline", "task:delete",
                "dept:manage", "user:manage", "workflow:manage", "perm:manage"
            ],
            'BGH': [
                "module:dashboard", "module:tasks", "module:calendar", "module:assets", "module:documents", "module:settings",
                "scope:school", "scope:dept", "scope:personal",
                "task:dispatch_school", "task:dispatch_dept", "task:todo_personal", "task:edit", "task:progress",
                "task:approve_proposal", "task:approve_complete", "task:extend_deadline", "task:delete",
                "dept:manage", "user:manage", "workflow:manage", "perm:manage"
            ],
            'DEPT_HEAD': [
                "module:tasks",
                "scope:dept", "scope:personal",
                "task:dispatch_dept", "task:todo_personal", "task:edit", "task:progress",
                "task:approve_proposal", "task:approve_complete", "task:extend_deadline"
            ],
            'DEPT_VICE': [
                "module:tasks",
                "scope:dept", "scope:personal",
                "task:dispatch_dept", "task:todo_personal", "task:edit", "task:progress",
                "task:approve_proposal", "task:approve_complete"
            ],
            'STAFF': [
                "module:tasks",
                "scope:personal",
                "task:todo_personal", "task:progress"
            ]
        };

        const base = roleDefaults[role] || roleDefaults['STAFF'];
        const userCustom = Array.isArray(this.currentUser.permissions) ? this.currentUser.permissions : [];
        const allPerms = new Set([...base, ...userCustom]);

        return allPerms.has(permCode);
    },

    applyModulePermissions(activePage = 'dashboard') {
        const u = this.currentUser;
        if (!u) return;

        // 1. Danh sách Module Sidebar Mapping
        const moduleMap = [
            { id: 'nav-dashboard', perm: 'module:dashboard' },
            { id: 'nav-tasks', perm: 'module:tasks' },
            { id: 'nav-calendar', perm: 'module:calendar' },
            { id: 'nav-assets', perm: 'module:assets' },
            { id: 'nav-documents', perm: 'module:documents' },
            { id: 'nav-database', perm: 'module:database' },
            { id: 'nav-settings', perm: 'module:settings' }
        ];

        const isQTDT = u.department && u.department.code === 'QTĐT';

        moduleMap.forEach(item => {
            const el = document.getElementById(item.id);
            if (!el) return;

            let hasAccess = this.hasPermission(item.perm);
            if (item.id === 'nav-assets' && isQTDT) hasAccess = true;
            if (item.id === 'nav-settings') {
                // Cho phép truy cập Settings nếu có module:settings hoặc có quyền quản trị bất kỳ
                hasAccess = this.hasPermission('module:settings') || this.hasPermission('dept:manage') || this.hasPermission('user:manage') || this.hasPermission('perm:manage') || this.hasPermission('workflow:manage');
            }

            if (!hasAccess) {
                el.classList.add('hidden');
            } else {
                el.classList.remove('hidden');
            }
        });

        // 2. Chặn truy cập trực tiếp bằng URL nếu không có quyền
        const pagePermissionGuards = {
            'dashboard': 'module:dashboard',
            'calendar': 'module:calendar',
            'database': 'module:database',
            'assets': 'module:assets',
            'documents': 'module:documents',
            'settings': 'module:settings'
        };

        if (pagePermissionGuards[activePage]) {
            const requiredPerm = pagePermissionGuards[activePage];
            let allowed = this.hasPermission(requiredPerm);
            if (activePage === 'assets' && isQTDT) allowed = true;
            if (activePage === 'settings') {
                allowed = this.hasPermission('module:settings') || this.hasPermission('dept:manage') || this.hasPermission('user:manage') || this.hasPermission('perm:manage') || this.hasPermission('workflow:manage');
            }

            if (!allowed) {
                alert('⛔ Bạn không có quyền truy cập vào phân hệ này. Hệ thống sẽ chuyển hướng bạn về Bảng công việc.');
                window.location.href = 'tasks.html';
            }
        }
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
            link.classList.remove('bg-blue-700', 'bg-blue-900', 'text-white', 'shadow-md', 'hover:bg-blue-900/50');
            link.classList.add('text-slate-300', 'hover:bg-slate-800');
        });

        const activeNav = document.getElementById(`nav-${activePage}`);
        if (activeNav) {
            activeNav.classList.remove('text-slate-300', 'hover:bg-slate-800');
            activeNav.classList.add('bg-blue-700', 'text-white', 'shadow-md');
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
                /* DEFAULT DARK THEME (STUDIO DARK: #101010 / #CCCCCC / #007ACC)*/
                /* ============================================================ */
                html[data-theme="dark"] body,
                html[data-theme="dark"] main,
                html[data-theme="dark"] .bg-slate-100 {
                    background-color: #101010 !important;
                    color: #CCCCCC !important;
                }
                html[data-theme="dark"] header,
                html[data-theme="dark"] .bg-white {
                    background-color: #1E1E1E !important;
                    border-color: #2D2D2D !important;
                    color: #CCCCCC !important;
                }
                html[data-theme="dark"] .bg-slate-50 {
                    background-color: #161616 !important;
                    border-color: #2D2D2D !important;
                }
                html[data-theme="dark"] .bg-slate-200 {
                    background-color: #2D2D2D !important;
                }
                html[data-theme="dark"] .bg-indigo-50\\/80,
                html[data-theme="dark"] .bg-indigo-50\\/50,
                html[data-theme="dark"] .bg-indigo-50 {
                    background-color: #181C28 !important;
                    border-color: #1E3A8A !important;
                }

                /* TYPOGRAPHY (FOREGROUND #CCCCCC, HEADINGS #FFFFFF) */
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
                    color: #CCCCCC !important;
                }
                html[data-theme="dark"] .text-slate-500,
                html[data-theme="dark"] .text-slate-400 {
                    color: #94A3B8 !important;
                }
                html[data-theme="dark"] label {
                    color: #CCCCCC !important;
                }

                /* FORM CONTROLS (INPUT / SELECT / TEXTAREA) */
                html[data-theme="dark"] select,
                html[data-theme="dark"] input:not([type="checkbox"]):not([type="radio"]):not([type="color"]),
                html[data-theme="dark"] textarea {
                    background-color: #161616 !important;
                    border: 1px solid #3E3E3E !important;
                    color: #FFFFFF !important;
                }
                html[data-theme="dark"] select:focus,
                html[data-theme="dark"] input:focus,
                html[data-theme="dark"] textarea:focus {
                    border-color: #007ACC !important;
                    box-shadow: 0 0 0 3px rgba(0, 122, 204, 0.3) !important;
                    outline: none !important;
                }
                html[data-theme="dark"] input::placeholder,
                html[data-theme="dark"] textarea::placeholder {
                    color: #71717A !important;
                }

                /* ACCENT BUTTONS & BADGES (#007ACC) */
                html[data-theme="dark"] .bg-blue-800,
                html[data-theme="dark"] .bg-blue-900 {
                    background-color: #007ACC !important;
                }
                html[data-theme="dark"] .bg-blue-800:hover,
                html[data-theme="dark"] .bg-blue-900:hover {
                    background-color: #0066AA !important;
                }
                html[data-theme="dark"] .text-blue-800,
                html[data-theme="dark"] .text-blue-700,
                html[data-theme="dark"] .text-blue-600 {
                    color: #38BDF8 !important;
                }
                html[data-theme="dark"] .border-blue-800,
                html[data-theme="dark"] .border-blue-700 {
                    border-color: #007ACC !important;
                }

                /* BORDERS & CARDS */
                html[data-theme="dark"] .border-slate-200,
                html[data-theme="dark"] .border-slate-100,
                html[data-theme="dark"] .border-slate-300 {
                    border-color: #2D2D2D !important;
                }
                html[data-theme="dark"] .divide-slate-100 > * + *,
                html[data-theme="dark"] .divide-slate-200 > * + * {
                    border-color: #2D2D2D !important;
                }

                /* TABLES */
                html[data-theme="dark"] thead,
                html[data-theme="dark"] th {
                    background-color: #161616 !important;
                    color: #FFFFFF !important;
                    border-color: #2D2D2D !important;
                }
                html[data-theme="dark"] tbody tr {
                    border-color: #2D2D2D !important;
                }
                html[data-theme="dark"] tbody tr:hover {
                    background-color: rgba(255, 255, 255, 0.04) !important;
                }
                html[data-theme="dark"] td {
                    color: #CCCCCC !important;
                }

                /* SHADOWS */
                html[data-theme="dark"] .shadow-xs,
                html[data-theme="dark"] .shadow-sm,
                html[data-theme="dark"] .shadow-md,
                html[data-theme="dark"] .shadow-lg,
                html[data-theme="dark"] .shadow-2xl {
                    box-shadow: 0 4px 16px -2px rgba(0, 0, 0, 0.8) !important;
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
    },

    // ----------------------------------------------------
    // TRUNG TÂM THÔNG BÁO ĐIỀU HÀNH THỜI GIAN THỰC (NOTIFICATION CENTER)
    // ----------------------------------------------------
    NotificationCenter: {
        items: [],
        unreadCount: 0,
        timer: null,

        init() {
            this.injectNotificationBell();
            this.fetch();
            if (this.timer) clearInterval(this.timer);
            this.timer = setInterval(() => this.fetch(), 20000);

            // Đóng menu khi click ra ngoài
            document.addEventListener('click', (e) => {
                const wrapper = document.getElementById('headerNotificationWrapper');
                const menu = document.getElementById('notifDropdownMenu');
                if (wrapper && menu && !wrapper.contains(e.target)) {
                    menu.classList.add('hidden');
                }
            });
        },

        injectNotificationBell() {
            if (document.getElementById('headerNotificationWrapper')) return;
            const headerUserName = document.getElementById('headerUserName');
            const targetContainer = headerUserName ? headerUserName.closest('.flex.items-center') : document.querySelector('header .flex.items-center.space-x-2');
            if (!targetContainer) return;

            const bellHtml = `
                <div class="relative inline-block text-left mr-2 sm:mr-3" id="headerNotificationWrapper">
                    <button type="button" onclick="Common.NotificationCenter.toggleDropdown()" 
                        class="relative p-2 text-slate-500 hover:text-blue-900 hover:bg-slate-100 rounded-full transition cursor-pointer" title="Thông báo hệ thống">
                        <i class="fa-regular fa-bell text-base sm:text-lg"></i>
                        <span id="notifBadge" class="hidden absolute top-0.5 right-0.5 min-w-[17px] h-[17px] bg-red-600 text-white text-[9.5px] font-black rounded-full flex items-center justify-center px-1 shadow-xs border-2 border-white animate-pulse">0</span>
                    </button>
                    <div id="notifDropdownMenu" class="hidden absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 animate-scale-in overflow-hidden flex flex-col max-h-[460px]">
                        <div class="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                            <div class="flex items-center space-x-2">
                                <i class="fa-solid fa-bell text-blue-800 text-xs"></i>
                                <span class="font-bold text-xs text-slate-800">Thông Báo Điều Hành</span>
                                <span id="notifUnreadBadge" class="text-[10px] bg-blue-100 text-blue-800 font-bold px-1.5 py-0.2 rounded-full">0 mới</span>
                            </div>
                            <button type="button" onclick="Common.NotificationCenter.markAllRead()" class="text-[11px] font-semibold text-blue-700 hover:underline cursor-pointer">
                                Đọc tất cả
                            </button>
                        </div>
                        <div id="notifListContainer" class="divide-y divide-slate-100 overflow-y-auto flex-1 text-xs">
                            <div class="p-6 text-center text-slate-400">Đang tải thông báo...</div>
                        </div>
                    </div>
                </div>
            `;
            targetContainer.insertAdjacentHTML('beforebegin', bellHtml);
        },

        async fetch() {
            try {
                if (!API.getToken()) return;
                const data = await API.getNotifications(25);
                this.items = data.items || [];
                this.unreadCount = data.unread_count || 0;
                this.renderBadge();
            } catch (err) {
                // Ignore token errors
            }
        },

        renderBadge() {
            const badge = document.getElementById('notifBadge');
            const unreadBadge = document.getElementById('notifUnreadBadge');
            if (badge) {
                if (this.unreadCount > 0) {
                    badge.innerText = this.unreadCount > 99 ? '99+' : this.unreadCount;
                    badge.classList.remove('hidden');
                } else {
                    badge.classList.add('hidden');
                }
            }
            if (unreadBadge) {
                unreadBadge.innerText = `${this.unreadCount} mới`;
            }
        },

        toggleDropdown() {
            const menu = document.getElementById('notifDropdownMenu');
            if (!menu) return;
            const isHidden = menu.classList.contains('hidden');
            if (isHidden) {
                this.renderList();
                menu.classList.remove('hidden');
            } else {
                menu.classList.add('hidden');
            }
        },

        renderList() {
            const container = document.getElementById('notifListContainer');
            if (!container) return;

            if (this.items.length === 0) {
                container.innerHTML = `
                    <div class="p-8 text-center space-y-2">
                        <i class="fa-regular fa-bell-slash text-2xl text-slate-300"></i>
                        <p class="text-xs text-slate-400">Không có thông báo mới</p>
                    </div>
                `;
                return;
            }

            const iconMap = {
                'PROPOSAL_APPROVED': { icon: '🎉', bg: 'bg-emerald-50 text-emerald-700' },
                'PROPOSAL_CHANGES_REQUESTED': { icon: '⚠️', bg: 'bg-amber-50 text-amber-700' },
                'PROPOSAL_REJECTED': { icon: '❌', bg: 'bg-rose-50 text-rose-700' },
                'PROPOSAL_RESUBMITTED': { icon: '🔄', bg: 'bg-blue-50 text-blue-700' },
                'ASSIGNMENT': { icon: '🎯', bg: 'bg-indigo-50 text-indigo-700' },
                'COLLABORATION_REQUEST': { icon: '🤝', bg: 'bg-purple-50 text-purple-700' },
                'COLLABORATION_ACCEPTED': { icon: '✅', bg: 'bg-green-50 text-green-700' }
            };

            container.innerHTML = this.items.map(item => {
                const conf = iconMap[item.type] || { icon: '📌', bg: 'bg-slate-50 text-slate-700' };
                const timeStr = Common.formatDateTime(item.created_at);
                const unreadClass = !item.is_read ? 'bg-blue-50/40 font-semibold' : 'bg-white opacity-80';

                return `
                    <div onclick="Common.NotificationCenter.handleClickNotification(${item.id}, ${item.task_id || 0})" 
                        class="p-3 hover:bg-slate-50 transition cursor-pointer flex items-start space-x-2.5 ${unreadClass}">
                        <div class="w-8 h-8 rounded-full ${conf.bg} flex items-center justify-center text-sm shrink-0 mt-0.5 font-bold shadow-2xs">
                            ${conf.icon}
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center justify-between gap-1">
                                <span class="font-bold text-slate-900 text-xs truncate">${item.title}</span>
                                <span class="text-[9.5px] text-slate-400 font-mono shrink-0">${timeStr}</span>
                            </div>
                            <p class="text-[11.5px] text-slate-600 line-clamp-2 mt-0.5 leading-snug">${item.message}</p>
                        </div>
                        ${!item.is_read ? '<span class="w-2 h-2 rounded-full bg-blue-600 shrink-0 mt-2"></span>' : ''}
                    </div>
                `;
            }).join('');
        },

        async handleClickNotification(notifId, taskId) {
            try {
                await API.markNotificationRead(notifId);
                const notif = this.items.find(n => n.id === notifId);
                if (notif) notif.is_read = true;
                if (this.unreadCount > 0) this.unreadCount--;
                this.renderBadge();
                this.renderList();

                const menu = document.getElementById('notifDropdownMenu');
                if (menu) menu.classList.add('hidden');

                if (taskId && taskId > 0) {
                    if (window.location.pathname.includes('tasks-list.html') || window.location.pathname.includes('tasks.html')) {
                        if (typeof TasksPage !== 'undefined' && TasksPage.openTaskDetail) {
                            TasksPage.openTaskDetail(taskId);
                        } else {
                            window.location.href = `tasks-list.html?task_id=${taskId}`;
                        }
                    } else {
                        window.location.href = `tasks-list.html?task_id=${taskId}`;
                    }
                }
            } catch (err) {
                console.error('Lỗi click notification:', err);
            }
        },

        async markAllRead() {
            try {
                await API.markAllNotificationsRead();
                this.items.forEach(n => n.is_read = true);
                this.unreadCount = 0;
                this.renderBadge();
                this.renderList();
                Common.showToast('Đã đánh dấu đã đọc tất cả thông báo', 'success');
            } catch (err) {
                Common.showToast('Không thể cập nhật thông báo', 'error');
            }
        }
    },

    // ----------------------------------------------------
    // CHUẨN HÓA BỘ THANG XẾP LOẠI TOÀN HỆ THỐNG (5 MỨC DUY NHẤT)
    // ----------------------------------------------------
    getRankInfo(score) {
        const s = typeof score === 'number' ? score : parseFloat(score || 0);
        if (s >= 110) {
            return { code: 'A+', label: 'A+ (Xuất sắc vượt mức)', badgeClass: 'bg-emerald-100 text-emerald-900 border border-emerald-300 font-black', color: '#059669' };
        } else if (s >= 95) {
            return { code: 'A', label: 'A (Xuất sắc)', badgeClass: 'bg-green-100 text-green-900 border border-green-300 font-bold', color: '#16a34a' };
        } else if (s >= 80) {
            return { code: 'B', label: 'B (Tốt - Đạt chuẩn)', badgeClass: 'bg-blue-100 text-blue-900 border border-blue-300 font-bold', color: '#2563eb' };
        } else if (s >= 50) {
            return { code: 'C', label: 'C (Cần cải thiện)', badgeClass: 'bg-amber-100 text-amber-900 border border-amber-300 font-bold', color: '#d97706' };
        } else {
            return { code: 'D', label: 'D (Chưa đạt chuẩn)', badgeClass: 'bg-rose-100 text-rose-900 border border-rose-300 font-bold', color: '#e11d48' };
        }
    }
};
