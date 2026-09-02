// Database Center Page Logic (database.html)
const DatabasePage = {
    stats: null,
    currentTab: 'stats', // 'stats' | 'import-export' | 'tables' | 'sql'
    selectedTable: 'departments',
    tableData: null,
    tablePage: 1,
    tableLimit: 25,
    importParsedData: null,
    isSmartMode: true, // Mặc định bật định dạng thông minh (Badge, Việt hóa, Tiến độ %, Ngày tháng)

    async init() {
        Common.init('database');
        
        // Kiểm tra quyền SuperAdmin
        const user = Common.getCurrentUser();
        if (user && user.role !== 'SUPERADMIN') {
            Common.showToast('Bạn cần quyền Quản Trị Viên để truy cập Trung Tâm Dữ Liệu.', 'error');
            setTimeout(() => { window.location.href = 'index.html'; }, 1500);
            return;
        }

        try {
            await this.loadDatabaseStats();
            this.switchTab('stats');
        } catch (e) {
            console.error('Lỗi khởi tạo Database Center:', e);
            Common.showToast('Không thể nạp thông tin CSDL', 'error');
        }
    },

    toggleSmartMode() {
        this.isSmartMode = !this.isSmartMode;
        const toggleBtn = document.getElementById('btnToggleSmartMode');
        if (toggleBtn) {
            toggleBtn.className = this.isSmartMode 
                ? 'px-3 py-1.5 bg-blue-800 text-white rounded-lg text-xs font-bold transition flex items-center space-x-1 shadow-xs'
                : 'px-3 py-1.5 bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition flex items-center space-x-1';
            toggleBtn.innerHTML = this.isSmartMode
                ? '<i class="fa-solid fa-wand-magic-sparkles text-amber-300"></i><span>Định Dạng Thông Minh: BẬT</span>'
                : '<i class="fa-solid fa-code"></i><span>Dữ Liệu Thô (Raw): BẬT</span>';
        }
        if (this.currentTab === 'tables') {
            this.renderTableInspector();
        }
    },

    formatSmartValue(columnName, val) {
        if (val === null || val === undefined) {
            return '<span class="text-slate-300 italic text-[11px]">NULL</span>';
        }
        if (!this.isSmartMode) {
            return String(val);
        }

        const strVal = String(val).trim();

        // 1. Task Statuses
        const statusMap = {
            'CHUA_BAT_DAU': '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-300"><span class="w-1.5 h-1.5 rounded-full bg-slate-400 mr-1.5"></span>Chưa bắt đầu</span>',
            'DANG_THUC_HIEN': '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-800 border border-blue-200"><span class="w-1.5 h-1.5 rounded-full bg-blue-600 mr-1.5 animate-pulse"></span>Đang thực hiện</span>',
            'CHO_DUYET': '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200"><span class="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5"></span>Chờ nghiệm thu</span>',
            'HOAN_THANH': '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200"><i class="fa-solid fa-check mr-1 text-[9.5px] text-emerald-600"></i>Đã hoàn thành</span>',
            'TAM_DUNG': '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-purple-50 text-purple-800 border border-purple-200"><span class="w-1.5 h-1.5 rounded-full bg-purple-500 mr-1.5"></span>Tạm dừng</span>',
            'TU_CHOI': '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-800 border border-rose-200"><i class="fa-solid fa-rotate-left mr-1 text-[9.5px]"></i>Trả lại</span>',
            'HUY_BO': '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-50 text-red-800 border border-red-200"><i class="fa-solid fa-ban mr-1 text-[9.5px]"></i>Hủy bỏ</span>'
        };

        // 2. Roles
        const roleMap = {
            'SUPERADMIN': '<span class="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-purple-100 text-purple-900 border border-purple-200"><i class="fa-solid fa-crown mr-1 text-[9px] text-purple-600"></i>1. Nhóm Quản Trị</span>',
            'BGH': '<span class="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-indigo-100 text-indigo-900 border border-indigo-200"><i class="fa-solid fa-building-columns mr-1 text-[9px] text-indigo-600"></i>2. BGH</span>',
            'DEPT_HEAD': '<span class="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-blue-100 text-blue-900 border border-blue-200"><i class="fa-solid fa-user-tie mr-1 text-[9.5px]"></i>3. Quản Lý</span>',
            'DEPT_VICE': '<span class="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-blue-50 text-blue-800 border border-blue-200"><i class="fa-solid fa-briefcase mr-1 text-[9.5px]"></i>3. Quản Lý (Phó)</span>',
            'STAFF': '<span class="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200"><i class="fa-solid fa-user mr-1 text-[9.5px]"></i>4. Nhân Viên</span>'
        };

        // 3. Priorities
        const priorityMap = {
            'KHAN_CAP': '<span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-black bg-red-100 text-red-800 border border-red-300">🔥 Hỏa tốc</span>',
            'CAO': '<span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">⚡ Cao</span>',
            'TRUNG_BINH': '<span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200">🔵 Trung bình</span>',
            'THAP': '<span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200">⚪ Thấp</span>'
        };

        // 4. Department Types
        const typeMap = {
            'BGH': '<span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-indigo-50 text-indigo-800 border border-indigo-200">🏛️ BGH</span>',
            'FACULTY': '<span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-blue-50 text-blue-800 border border-blue-200">🎓 Khoa Đào tạo</span>',
            'DEPARTMENT': '<span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">🏢 Phòng Chức năng</span>',
            'CENTER': '<span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-purple-50 text-purple-800 border border-purple-200">🏛️ Trung tâm</span>',
            'SECTION': '<span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">👥 Tổ / Ban</span>',
            'WORKSHOP': '<span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-orange-50 text-orange-800 border border-orange-200">⚙️ Xưởng / Lab</span>'
        };

        // 5. Booleans
        if (strVal === 'True' || strVal === 'true') {
            return '<span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10.5px] font-bold bg-emerald-100 text-emerald-800"><i class="fa-solid fa-circle-check mr-1 text-[9px]"></i>Có / Active</span>';
        }
        if (strVal === 'False' || strVal === 'false') {
            return '<span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10.5px] font-bold bg-slate-100 text-slate-500"><i class="fa-solid fa-circle-xmark mr-1 text-[9px]"></i>Không / Tắt</span>';
        }

        if (statusMap[strVal]) return statusMap[strVal];
        if (roleMap[strVal]) return roleMap[strVal];
        if (priorityMap[strVal]) return priorityMap[strVal];
        if (typeMap[strVal]) return typeMap[strVal];

        // Progress percentage format
        if (columnName && (columnName.includes('progress') || columnName.includes('percent'))) {
            const num = parseFloat(strVal);
            if (!isNaN(num)) {
                const color = num === 100 ? 'bg-emerald-500' : num >= 50 ? 'bg-blue-500' : 'bg-amber-500';
                return `
                    <div class="flex items-center space-x-2">
                        <div class="w-12 bg-slate-200 rounded-full h-2 overflow-hidden">
                            <div class="${color} h-2 rounded-full" style="width: ${num}%"></div>
                        </div>
                        <span class="font-bold text-slate-800 font-mono text-[11px]">${num}%</span>
                    </div>
                `;
            }
        }

        // Date formatting (ISO strings)
        if (columnName && (columnName.includes('_at') || columnName.includes('_date') || columnName === 'created_at') && strVal.includes('T')) {
            try {
                const d = new Date(strVal);
                if (!isNaN(d.getTime())) {
                    const day = String(d.getDate()).padStart(2, '0');
                    const month = String(d.getMonth() + 1).padStart(2, '0');
                    const year = d.getFullYear();
                    const hours = String(d.getHours()).padStart(2, '0');
                    const minutes = String(d.getMinutes()).padStart(2, '0');
                    return `<span class="font-mono text-slate-700 text-[11px]">${hours}:${minutes} ${day}/${month}/${year}</span>`;
                }
            } catch (_) {}
        }

        return String(val);
    },

    switchTab(tabId) {
        this.currentTab = tabId;

        document.querySelectorAll('.db-subnav').forEach(btn => {
            btn.classList.remove('bg-white', 'text-blue-900', 'shadow-xs');
            btn.classList.add('text-slate-600');
        });
        const activeBtn = document.getElementById(`subnav-${tabId}`);
        if (activeBtn) {
            activeBtn.classList.remove('text-slate-600');
            activeBtn.classList.add('bg-white', 'text-blue-900', 'shadow-xs');
        }

        document.querySelectorAll('.db-subpane').forEach(pane => pane.classList.add('hidden'));
        const activePane = document.getElementById(`subpane-${tabId}`);
        if (activePane) activePane.classList.remove('hidden');

        if (tabId === 'stats') this.renderStatsView();
        if (tabId === 'tables') this.loadTableData(this.selectedTable, 1);
    },

    // 1. STATS & HEALTH
    async loadDatabaseStats() {
        this.stats = await API.getDatabaseStats();
        this.renderStatsView();
    },

    renderStatsView() {
        if (!this.stats) return;

        // KPI metrics
        const sizeEl = document.getElementById('statDbSize');
        if (sizeEl) sizeEl.innerText = this.stats.database_size || 'N/A';

        const totalRowsEl = document.getElementById('statTotalRows');
        if (totalRowsEl) totalRowsEl.innerText = (this.stats.total_rows || 0).toLocaleString();

        const totalTablesEl = document.getElementById('statTotalTables');
        if (totalTablesEl) totalTablesEl.innerText = this.stats.total_tables || '5';

        const pgVersionEl = document.getElementById('statPgVersion');
        if (pgVersionEl) pgVersionEl.innerText = this.stats.pg_version || 'PostgreSQL 16';

        // Table breakdown cards
        const container = document.getElementById('tablesGridContainer');
        if (container && Array.isArray(this.stats.tables)) {
            container.innerHTML = this.stats.tables.map(t => `
                <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-xs hover:border-blue-300 transition flex flex-col justify-between">
                    <div>
                        <div class="flex items-center justify-between mb-2">
                            <span class="font-mono text-xs font-bold text-blue-900 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                                ${t.name}
                            </span>
                            <span class="text-xs font-black text-slate-800 bg-slate-100 px-2 py-0.5 rounded-full font-mono">
                                ${(t.row_count || 0).toLocaleString()} bản ghi
                            </span>
                        </div>
                        <h4 class="font-bold text-slate-900 text-sm mb-1">${t.display_name}</h4>
                        <p class="text-xs text-slate-500 leading-snug mb-3">${t.description}</p>
                    </div>

                    <div class="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                        <span class="text-[11px] text-slate-400 font-mono">${t.columns.length} cột trường</span>
                        <div class="flex items-center space-x-1.5">
                            <button onclick="DatabasePage.viewTableDirect('${t.name}')" class="px-2.5 py-1 bg-blue-50 hover:bg-blue-800 hover:text-white text-blue-700 font-bold rounded-lg transition flex items-center space-x-1">
                                <i class="fa-solid fa-table"></i>
                                <span>Xem Dữ Liệu</span>
                            </button>
                        </div>
                    </div>
                </div>
            `).join('');
        }
    },

    async handleOptimizeDatabase() {
        const btn = document.getElementById('btnOptimizeDb');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin mr-1"></i> Đang tối ưu...`;
        }

        try {
            const res = await API.optimizeDatabase();
            Common.showToast(res.message || 'Tối ưu hóa CSDL hoàn tất!', 'success');
            await this.loadDatabaseStats();
        } catch (e) {
            Common.showToast('Lỗi tối ưu CSDL: ' + e.message, 'error');
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = `<i class="fa-solid fa-broom mr-1"></i> Dọn Dẹp &amp; Tối Ưu CSDL`;
            }
        }
    },

    viewTableDirect(tableName) {
        this.selectedTable = tableName;
        const select = document.getElementById('selectInspectorTable');
        if (select) select.value = tableName;
        this.switchTab('tables');
    },

    // 2. TABLE INSPECTOR
    async loadTableData(tableName, page = 1) {
        this.selectedTable = tableName;
        this.tablePage = page;
        const offset = (page - 1) * this.tableLimit;

        const tableContainer = document.getElementById('tableInspectorBody');
        if (tableContainer) {
            tableContainer.innerHTML = `<tr><td colspan="12" class="text-center py-8 text-slate-400 text-xs"><i class="fa-solid fa-circle-notch fa-spin mr-2"></i> Đang nạp dữ liệu bảng ${tableName}...</td></tr>`;
        }

        try {
            this.tableData = await API.getTableData(tableName, this.tableLimit, offset);
            this.renderTableInspector();
        } catch (e) {
            Common.showToast('Lỗi đọc bảng: ' + e.message, 'error');
            if (tableContainer) {
                tableContainer.innerHTML = `<tr><td colspan="12" class="text-center py-6 text-red-500 text-xs font-bold">Không thể tải dữ liệu bảng ${tableName}</td></tr>`;
            }
        }
    },

    renderTableInspector() {
        if (!this.tableData) return;

        const thead = document.getElementById('tableInspectorHeader');
        const tbody = document.getElementById('tableInspectorBody');
        const countLabel = document.getElementById('tableRowCountLabel');
        const pagination = document.getElementById('tablePagination');

        const { columns, rows, total, limit, offset } = this.tableData;

        if (countLabel) {
            countLabel.innerText = `Hiển thị ${rows.length} / ${total.toLocaleString()} bản ghi`;
        }

        // Render Thead
        if (thead) {
            thead.innerHTML = `
                <tr>
                    <th class="px-3 py-2.5 w-10 text-center font-mono">#</th>
                    ${columns.map(c => `
                        <th class="px-3 py-2.5 whitespace-nowrap text-slate-700">
                            <span class="font-bold font-mono text-xs">${c.name}</span>
                            <span class="text-[9.5px] text-slate-400 block font-normal">${c.type}</span>
                        </th>
                    `).join('')}
                </tr>
            `;
        }

        // Render Tbody
        if (tbody) {
            if (rows.length === 0) {
                tbody.innerHTML = `<tr><td colspan="${columns.length + 1}" class="text-center py-8 text-slate-400 text-xs">Bảng dữ liệu đang trống.</td></tr>`;
            } else {
                tbody.innerHTML = rows.map((r, rIdx) => `
                    <tr class="hover:bg-slate-50 border-b border-slate-100 text-xs">
                        <td class="px-3 py-2 text-center text-slate-400 font-mono">${offset + rIdx + 1}</td>
                        ${columns.map(c => {
                            const val = r[c.name];
                            return `
                                <td class="px-3 py-2 max-w-xs truncate ${c.name === 'id' ? 'font-mono font-bold text-blue-900' : 'text-slate-800'}" title="${val !== null && val !== undefined ? String(val).replace(/"/g, '&quot;') : 'NULL'}">
                                    ${this.formatSmartValue(c.name, val)}
                                </td>
                            `;
                        }).join('')}
                    </tr>
                `).join('');
            }
        }

        // Render Pagination
        if (pagination) {
            const totalPages = Math.ceil(total / limit) || 1;
            pagination.innerHTML = `
                <div class="flex items-center space-x-1.5 text-xs">
                    <button onclick="DatabasePage.loadTableData('${this.selectedTable}', ${this.tablePage - 1})" ${this.tablePage <= 1 ? 'disabled' : ''} 
                        class="px-2.5 py-1 border rounded bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-medium">
                        <i class="fa-solid fa-chevron-left"></i>
                    </button>
                    <span class="px-3 py-1 font-bold text-slate-700">Trang ${this.tablePage} / ${totalPages}</span>
                    <button onclick="DatabasePage.loadTableData('${this.selectedTable}', ${this.tablePage + 1})" ${this.tablePage >= totalPages ? 'disabled' : ''} 
                        class="px-2.5 py-1 border rounded bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-medium">
                        <i class="fa-solid fa-chevron-right"></i>
                    </button>
                </div>
            `;
        }
    },

    // 3. EXPORT & IMPORT
    async exportFullBackup() {
        const btn = document.getElementById('btnExportFullJson');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin mr-1"></i> Đang trích xuất...`;
        }

        try {
            const data = await API.exportFullDatabase();
            const jsonStr = JSON.stringify(data, null, 2);
            const blob = new Blob([jsonStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            const dateStr = new Date().toISOString().slice(0, 10);
            a.href = url;
            a.download = `HueIC_IMP_Database_Backup_${dateStr}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            Common.showToast('Đã tải về bản sao lưu toàn diện CSDL thành công!', 'success');
        } catch (e) {
            Common.showToast('Lỗi trích xuất CSDL: ' + e.message, 'error');
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = `<i class="fa-solid fa-download mr-1"></i> Tải Bản Sao Lưu Toàn Diện (Full JSON)`;
            }
        }
    },

    async exportTableCsv(tableName) {
        try {
            const res = await API.getTableData(tableName, 5000, 0);
            const { columns, rows } = res;
            if (!rows || rows.length === 0) {
                Common.showToast(`Bảng ${tableName} không có dữ liệu để xuất`, 'info');
                return;
            }

            const header = columns.map(c => `"${c.name}"`).join(',');
            const csvRows = rows.map(r => columns.map(c => {
                const val = r[c.name];
                return val !== null && val !== undefined ? `"${String(val).replace(/"/g, '""')}"` : '""';
            }).join(','));

            const csvContent = '\uFEFF' + [header, ...csvRows].join('\r\n');
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `HueIC_${tableName}_${new Date().toISOString().slice(0,10)}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            Common.showToast(`Đã xuất dữ liệu bảng ${tableName} thành công!`, 'success');
        } catch (e) {
            Common.showToast('Lỗi xuất bảng: ' + e.message, 'error');
        }
    },

    downloadSampleTemplate(type) {
        let content = '';
        let filename = '';

        if (type === 'users') {
            filename = 'Mau_Nhap_Can_Bo_HueIC.csv';
            content = '\uFEFF"username","full_name","email","department_code","role","position","password"\r\n' +
                      '"nguyen_van_a","ThS. Nguyễn Văn A","vana@hueic.edu.vn","CNTT","STAFF","Giảng viên bộ môn","HueIC@2026!"\r\n' +
                      '"tran_thi_b","TS. Trần Thị B","thib@hueic.edu.vn","HCTH","DEPT_HEAD","Trưởng phòng","HueIC@2026!"\r\n';
        } else if (type === 'departments') {
            filename = 'Mau_Nhap_Don_Vi_HueIC.csv';
            content = '\uFEFF"code","name","type","phone","email","description"\r\n' +
                      '"BM_PM","Bộ môn Công nghệ Phần mềm","SECTION","0234.3822130","cntt@hueic.edu.vn","Bộ môn trực thuộc Khoa CNTT"\r\n' +
                      '"BM_OTO","Bộ môn Kỹ thuật Ô tô","SECTION","0234.3822128","ckot@hueic.edu.vn","Bộ môn trực thuộc Khoa CKOT"\r\n';
        }

        const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },

    handleImportFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = e.target.result;
                const lines = text.split(/\r\n|\n/).filter(l => l.trim().length > 0);
                if (lines.length <= 1) {
                    Common.showToast('File không có đủ dòng dữ liệu', 'error');
                    return;
                }

                const headers = lines[0].replace(/"/g, '').split(',').map(h => h.trim());
                const records = [];

                for (let i = 1; i < lines.length; i++) {
                    const row = lines[i].split(',').map(v => v.replace(/^"|"$/g, '').trim());
                    const obj = {};
                    headers.forEach((h, idx) => {
                        obj[h] = row[idx] || '';
                    });
                    records.push(obj);
                }

                this.importParsedData = records;
                const previewEl = document.getElementById('importPreviewArea');
                const countEl = document.getElementById('importPreviewCount');
                if (previewEl) previewEl.classList.remove('hidden');
                if (countEl) countEl.innerText = `Đã đọc ${records.length} dòng dữ liệu hợp lệ`;

                const sampleList = document.getElementById('importSampleRows');
                if (sampleList) {
                    sampleList.innerHTML = records.slice(0, 3).map((r, i) => `
                        <div class="text-[11px] font-mono bg-slate-50 p-2 rounded border border-slate-200">
                            <strong>#${i+1}:</strong> ${JSON.stringify(r)}
                        </div>
                    `).join('');
                }
            } catch (err) {
                Common.showToast('Lỗi đọc file: ' + err.message, 'error');
            }
        };
        reader.readAsText(file);
    },

    async submitBulkImport() {
        if (!this.importParsedData || this.importParsedData.length === 0) {
            Common.showToast('Vui lòng chọn file dữ liệu trước', 'error');
            return;
        }

        const targetTable = document.getElementById('importTargetTable')?.value || 'users';
        const importMode = document.getElementById('importMode')?.value || 'upsert';

        const btn = document.getElementById('btnExecuteImport');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin mr-1"></i> Đang nạp...`;
        }

        try {
            const res = await API.bulkImportTable(targetTable, this.importParsedData, importMode);
            Common.showToast(`Đã nhập thành công ${res.imported_count} bản ghi vào bảng ${targetTable}!`, 'success');
            
            // Reset
            this.importParsedData = null;
            document.getElementById('importFileInput').value = '';
            document.getElementById('importPreviewArea')?.classList.add('hidden');
            await this.loadDatabaseStats();
        } catch (e) {
            Common.showToast('Lỗi nhập dữ liệu: ' + e.message, 'error');
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = `<i class="fa-solid fa-file-import mr-1"></i> Bắt Đầu Nhập Dữ Liệu`;
            }
        }
    },

    // 4. SQL QUERY STUDIO
    setSqlQuery(queryText) {
        const input = document.getElementById('sqlQueryInput');
        if (input) input.value = queryText;
    },

    async runSqlQuery() {
        const query = document.getElementById('sqlQueryInput')?.value.trim();
        if (!query) {
            Common.showToast('Vui lòng nhập câu lệnh SQL', 'warning');
            return;
        }

        const btn = document.getElementById('btnRunSql');
        const container = document.getElementById('sqlResultsContainer');
        const headerEl = document.getElementById('sqlResultsHeader');
        const bodyEl = document.getElementById('sqlResultsBody');
        const metaEl = document.getElementById('sqlResultsMeta');

        if (btn) {
            btn.disabled = true;
            btn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin mr-1"></i> Đang chạy...`;
        }

        try {
            const res = await API.executeSqlQuery(query);
            const { columns, rows, row_count, execution_time_ms } = res;

            if (container) container.classList.remove('hidden');
            if (metaEl) metaEl.innerText = `Tìm thấy ${row_count} dòng • Thời gian thực thi: ${execution_time_ms} ms`;

            if (headerEl) {
                headerEl.innerHTML = `
                    <tr>
                        <th class="px-3 py-2 text-center font-mono w-10">#</th>
                        ${columns.map(c => `<th class="px-3 py-2 font-mono font-bold text-slate-800 text-xs">${c}</th>`).join('')}
                    </tr>
                `;
            }

            if (bodyEl) {
                if (rows.length === 0) {
                    bodyEl.innerHTML = `<tr><td colspan="${columns.length + 1}" class="text-center py-6 text-slate-400 text-xs">Không có kết quả trả về.</td></tr>`;
                } else {
                    bodyEl.innerHTML = rows.map((r, idx) => `
                        <tr class="hover:bg-slate-50 border-b border-slate-100 text-xs">
                            <td class="px-3 py-2 text-center text-slate-400 font-mono">${idx + 1}</td>
                            ${columns.map(c => {
                                const val = r[c];
                                return `<td class="px-3 py-2 text-slate-800">${this.formatSmartValue(c, val)}</td>`;
                            }).join('')}
                        </tr>
                    `).join('');
                }
            }
            Common.showToast(`Truy vấn thành công (${row_count} dòng, ${execution_time_ms}ms)!`, 'success');
        } catch (e) {
            Common.showToast(e.message || 'Lỗi thực thi SQL', 'error');
            if (container) container.classList.remove('hidden');
            if (bodyEl) {
                bodyEl.innerHTML = `<tr><td colspan="12" class="text-center py-6 text-red-600 font-bold text-xs">Lỗi: ${e.message}</td></tr>`;
            }
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = `<i class="fa-solid fa-play mr-1"></i> Thực Thi (F5 / Run)`;
            }
        }
    }
};

window.DatabasePage = DatabasePage;
document.addEventListener('DOMContentLoaded', () => DatabasePage.init());
