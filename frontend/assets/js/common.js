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
    }
};
