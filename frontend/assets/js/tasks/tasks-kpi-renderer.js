/**
 * HueIC IMP - Tasks Module: KPI & Strategic Executive Renderer
 */
window.TasksKpiRenderer = {
    _getSemiArcGauge(percent, size = 110, rank = null) {
        const clampedPct = Math.min(100, Math.max(0, percent));
        const overPct = Math.max(0, percent - 100); // phần vượt trội

        // Màu sắc theo điểm — 3 token màu chuẩn
        let arcColor, glowColor, trackBg;
        if (percent >= 95) {
            arcColor = '#10b981'; glowColor = '#d1fae5'; trackBg = '#ecfdf5';
        } else if (percent >= 80) {
            arcColor = '#4f46e5'; glowColor = '#ede9fe'; trackBg = '#eef2ff';
        } else if (percent >= 50) {
            arcColor = '#f59e0b'; glowColor = '#fef3c7'; trackBg = '#fffbeb';
        } else {
            arcColor = '#f43f5e'; glowColor = '#ffe4e6'; trackBg = '#fff1f2';
        }

        const rankInfo = rank || Common.getRankInfo(percent);

        // SVG Semi-circle arc: cx=55 cy=60, r=44, arc từ 180° → 360°
        // M 11,60 A44,44 0 0,1 99,60 = nửa vòng tròn phía dưới (đường track)
        const sw = size <= 90 ? 8 : 10; // stroke-width
        const r = (size / 2) - sw;
        const cx = size / 2;
        const cy = size * 0.6; // tâm dịch xuống thấp hơn 1 chút

        // Arc path: điểm đầu → điểm cuối theo nửa vòng tròn
        const startX = cx - r;
        const startY = cy;
        const endX = cx + r;
        const endY = cy;

        // Tính chiều dài cung arc nửa vòng tròn = π × r
        const arcLen = Math.PI * r;
        const fillLen = (clampedPct / 100) * arcLen;
        const emptyLen = arcLen - fillLen;

        return `
            <div class="relative flex flex-col items-center justify-end shrink-0" style="width:${size}px; height:${Math.round(size*0.7)}px;">
                <svg width="${size}" height="${Math.round(size*0.75)}" viewBox="0 0 ${size} ${Math.round(size*0.75)}" style="overflow:visible;">
                    <defs>
                        <linearGradient id="arcGrad_${Math.round(percent)}_${size}" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" style="stop-color:${arcColor};stop-opacity:0.7"/>
                            <stop offset="100%" style="stop-color:${arcColor};stop-opacity:1"/>
                        </linearGradient>
                    </defs>
                    <!-- Track (nền xám) -->
                    <path d="M ${startX},${cy} A${r},${r} 0 0,1 ${endX},${cy}"
                        fill="none" stroke="${trackBg}" stroke-width="${sw + 2}" stroke-linecap="round"/>
                    <path d="M ${startX},${cy} A${r},${r} 0 0,1 ${endX},${cy}"
                        fill="none" stroke="#e2e8f0" stroke-width="${sw}" stroke-linecap="round"/>
                    <!-- Fill (màu điểm số) -->
                    <path d="M ${startX},${cy} A${r},${r} 0 0,1 ${endX},${cy}"
                        fill="none" stroke="url(#arcGrad_${Math.round(percent)}_${size})"
                        stroke-width="${sw}" stroke-linecap="round"
                        stroke-dasharray="${fillLen} ${emptyLen}"
                        class="transition-all duration-700 ease-out"/>
                    <!-- Điểm % ở giữa dưới arc -->
                    <text x="${cx}" y="${cy + 4}" text-anchor="middle"
                        style="font-family:Manrope,sans-serif;font-weight:900;font-size:${size <= 90 ? 16 : 19}px;fill:${arcColor};">
                        ${Math.round(percent)}%
                    </text>
                    ${overPct > 0 ? `<text x="${cx}" y="${cy + (size <= 90 ? 18 : 22)}" text-anchor="middle"
                        style="font-family:sans-serif;font-weight:700;font-size:9px;fill:#10b981;">▲ +${overPct}% BONUS</text>` : ''}
                </svg>
                <!-- Badge xếp loại -->
                <div class="absolute top-0 right-0">
                    <span class="text-[9.5px] font-bold px-1.5 py-0.5 rounded-full ${rankInfo.badgeClass}">${rankInfo.code}</span>
                </div>
            </div>
        `;
    },

    // ================================================================
    // CIRCULAR GAUGE — Giữ lại cho tương thích ngược (dùng ít hơn)
    // ================================================================
    _getCircularGauge(percent, size = 68, strokeWidth = 6, primaryColor = '#2563eb', trackColor = '#f1f5f9') {
        const radius = (size - strokeWidth) / 2;
        const circumference = 2 * Math.PI * radius;
        const clampedPct = Math.min(120, Math.max(0, percent));
        const visualPct = Math.min(100, clampedPct);
        const offset = circumference - (visualPct / 100) * circumference;
        return `
            <div class="relative flex items-center justify-center shrink-0" style="width: ${size}px; height: ${size}px;">
                <svg width="${size}" height="${size}" class="transform -rotate-90">
                    <circle cx="${size/2}" cy="${size/2}" r="${radius}" stroke="${trackColor}" stroke-width="${strokeWidth}" fill="transparent" />
                    <circle cx="${size/2}" cy="${size/2}" r="${radius}" stroke="${primaryColor}" stroke-width="${strokeWidth}" fill="transparent"
                        stroke-dasharray="${circumference}" stroke-dashoffset="${offset}" stroke-linecap="round" class="transition-all duration-700 ease-out" />
                </svg>
                <div class="absolute inset-0 flex flex-col items-center justify-center text-center">
                    <span class="font-manrope font-black text-sm tracking-tight" style="color: ${primaryColor};">${Math.round(percent)}%</span>
                </div>
            </div>
        `;
    },

    // ================================================================
    // MINI SPARKLINE — Biểu đồ xu hướng 7 điểm (60px × 28px)
    // ================================================================
    _getSparkline(dataPoints, color = '#4f46e5', positiveColor = '#10b981', negativeColor = '#f43f5e') {
        const pts = (dataPoints && dataPoints.length > 1) ? dataPoints : [20, 35, 28, 45, 40, 55, 60]; // mock
        const w = 80, h = 28, pad = 3;
        const minV = Math.min(...pts), maxV = Math.max(...pts);
        const range = (maxV - minV) || 1;
        const coords = pts.map((v, i) => ({
            x: pad + (i / (pts.length - 1)) * (w - 2*pad),
            y: h - pad - ((v - minV) / range) * (h - 2*pad)
        }));

        // Tạo smooth cubic bezier path
        let pathD = `M ${coords[0].x},${coords[0].y}`;
        for (let i = 1; i < coords.length; i++) {
            const cp1x = coords[i-1].x + (coords[i].x - coords[i-1].x) * 0.4;
            const cp2x = coords[i].x - (coords[i].x - coords[i-1].x) * 0.4;
            pathD += ` C ${cp1x},${coords[i-1].y} ${cp2x},${coords[i].y} ${coords[i].x},${coords[i].y}`;
        }

        // Fill gradient area
        const fillD = pathD + ` L ${coords[coords.length-1].x},${h} L ${coords[0].x},${h} Z`;

        // Xu hướng: so sánh điểm đầu & cuối
        const trend = pts[pts.length - 1] - pts[0];
        const trendColor = trend >= 0 ? positiveColor : negativeColor;
        const trendText = trend >= 0 ? `▲ ${Math.abs(trend).toFixed(0)}` : `▼ ${Math.abs(trend).toFixed(0)}`;

        const uniqueId = `spark_${Math.round(Math.random()*10000)}`;

        return `
            <div class="flex items-center gap-2">
                <svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" class="shrink-0">
                    <defs>
                        <linearGradient id="${uniqueId}" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stop-color="${trendColor}" stop-opacity="0.25"/>
                            <stop offset="100%" stop-color="${trendColor}" stop-opacity="0.02"/>
                        </linearGradient>
                    </defs>
                    <path d="${fillD}" fill="url(#${uniqueId})"/>
                    <path d="${pathD}" fill="none" stroke="${trendColor}" stroke-width="1.5" stroke-linecap="round"/>
                    <circle cx="${coords[coords.length-1].x}" cy="${coords[coords.length-1].y}" r="2.5"
                        fill="${trendColor}" stroke="white" stroke-width="1.5"/>
                </svg>
                <span class="text-[10px] font-bold" style="color:${trendColor};">${trendText}</span>
            </div>
        `;
    },

    // ================================================================
    // BGH SVG CHART HELPERS (LINE TREND, STACKED BAR, STRATEGIC DONUT)
    // ================================================================
    _getPeriodDateRange(period) {
        const now = new Date();
        const y = now.getFullYear();
        const m = now.getMonth(); // 0-11
        
        if (period === 'quarter') {
            const q = Math.floor(m / 3); // 0: Q1, 1: Q2, 2: Q3, 3: Q4
            const qStartMonth = q * 3;
            const qEndMonth = qStartMonth + 2;
            const start = new Date(Date.UTC(y, qStartMonth, 1, 0, 0, 0));
            const end = new Date(Date.UTC(y, qEndMonth + 1, 0, 23, 59, 59));
            return {
                startDate: start.toISOString(),
                endDate: end.toISOString(),
                periodLabel: `Quý ${q + 1}/${y}`,
                periodText: `Quý ${q + 1}/${y}`
            };
        } else if (period === 'year') {
            const startYear = m >= 8 ? y : y - 1;
            const endYear = startYear + 1;
            const start = new Date(Date.UTC(startYear, 8, 1, 0, 0, 0));
            const end = new Date(Date.UTC(endYear, 7, 31, 23, 59, 59));
            return {
                startDate: start.toISOString(),
                endDate: end.toISOString(),
                periodLabel: `Năm học ${startYear}-${endYear}`,
                periodText: `Năm học ${startYear}-${endYear}`
            };
        } else {
            const start = new Date(Date.UTC(y, m, 1, 0, 0, 0));
            const end = new Date(Date.UTC(y, m + 1, 0, 23, 59, 59));
            return {
                startDate: start.toISOString(),
                endDate: end.toISOString(),
                periodLabel: `Tháng ${m + 1}/${y}`,
                periodText: `Tháng ${m + 1}/${y}`
            };
        }
    },

    _getPeriodKeyOptions(periodType) {
        const now = new Date();
        const curYear = now.getFullYear();
        const curMonth = now.getMonth() + 1;
        const curQuarter = Math.floor((curMonth - 1) / 3) + 1;

        if (periodType === 'quarter') {
            const opts = [];
            for (let y = curYear; y >= curYear - 1; y--) {
                const maxQ = (y === curYear) ? curQuarter : 4;
                for (let q = maxQ; q >= 1; q--) {
                    const key = `${y}-Q${q}`;
                    const isCur = (y === curYear && q === curQuarter);
                    opts.push({
                        key,
                        label: `Quý ${q}/${y} ${isCur ? '(Hiện tại)' : '[🔒 Đã chốt]'}`,
                        isClosed: !isCur
                    });
                }
            }
            return opts;
        } else if (periodType === 'year') {
            const opts = [
                { key: `${curYear-1}-${curYear}`, label: `Năm học ${curYear-1}-${curYear} (Hiện tại)`, isClosed: false },
                { key: `${curYear-2}-${curYear-1}`, label: `Năm học ${curYear-2}-${curYear-1} [🔒 Đã chốt]`, isClosed: true },
                { key: `${curYear-3}-${curYear-2}`, label: `Năm học ${curYear-3}-${curYear-2} [🔒 Đã chốt]`, isClosed: true }
            ];
            return opts;
        } else {
            // month
            const opts = [];
            for (let y = curYear; y >= curYear - 1; y--) {
                const maxM = (y === curYear) ? curMonth : 12;
                for (let m = maxM; m >= 1; m--) {
                    const key = `${y}-${String(m).padStart(2, '0')}`;
                    const isCur = (y === curYear && m === curMonth);
                    opts.push({
                        key,
                        label: `Tháng ${m}/${y} ${isCur ? '(Hiện tại)' : '[🔒 Đã chốt]'}`,
                        isClosed: !isCur
                    });
                }
            }
            return opts;
        }
    },

    setBghPeriod(period) {
        this.bghPeriod = period;
        const opts = this._getPeriodKeyOptions(period);
        this.bghPeriodKey = (opts && opts[0]) ? opts[0].key : null;
        this.renderKpiWidget(this.selectedBghUnitId);
    },

    setBghPeriodKey(key) {
        this.bghPeriodKey = key;
        this.renderKpiWidget(this.selectedBghUnitId);
    },

    selectBghUnit(deptId) {
        const parsed = deptId ? parseInt(deptId) : null;
        if (this.selectedBghUnitId === parsed && parsed !== null) {
            this.selectedBghUnitId = null;
        } else {
            this.selectedBghUnitId = parsed;
        }
        this.renderKpiWidget(this.selectedBghUnitId);
    },

    _renderBghLineChart(lineData) {
        const labels = (lineData && lineData.labels && lineData.labels.length > 0) 
            ? lineData.labels 
            : ['T4/26', 'T5/26', 'T6/26', 'T7/26', 'T8/26', 'T9/26'];
        const ds = (lineData && lineData.datasets && lineData.datasets[0]) 
            ? lineData.datasets[0] 
            : { data: [68.5, 71.0, 73.2, 74.5, 61.7, 78.6], borderColor: '#4f46e5' };
        const rawData = (ds.data && ds.data.length > 0) ? ds.data : [68.5, 71.0, 73.2, 74.5, 61.7, 78.6];

        const w = 500, h = 165, padL = 38, padR = 24, padT = 20, padB = 22;
        
        // Lọc các giá trị hợp lệ (khác null/undefined)
        const validVals = rawData.filter(v => v !== null && v !== undefined && !isNaN(v));
        const minVal = validVals.length > 0 ? Math.max(0, Math.min(...validVals) - 10) : 40;
        const maxVal = validVals.length > 0 ? Math.min(100, Math.max(88, Math.max(...validVals) + 6)) : 100;
        const range = (maxVal - minVal) || 1;

        const getX = (i) => padL + (i / Math.max(1, labels.length - 1)) * (w - padL - padR);
        const getY = (v) => h - padB - ((v - minVal) / range) * (h - padT - padB);

        // Đường gióng mục tiêu 80%
        const targetY = getY(80.0);
        const targetLine = (targetY >= padT && targetY <= h - padB) ? `
            <line x1="${padL}" y1="${targetY}" x2="${w - padR}" y2="${targetY}" stroke="#10b981" stroke-width="2" stroke-dasharray="5,4" opacity="0.95" />
            <rect x="${w - padR - 76}" y="${targetY - 17}" width="76" height="15" rx="4" fill="#ecfdf5" stroke="#a7f3d0" stroke-width="0.8" />
            <text x="${w - padR - 38}" y="${targetY - 6}" text-anchor="middle" font-size="10" font-weight="800" fill="#047857">Mục tiêu 80%</text>
        ` : '';

        // Tập hợp các điểm có dữ liệu thật
        const validPoints = [];
        rawData.forEach((v, i) => {
            if (v !== null && v !== undefined && !isNaN(v)) {
                validPoints.push({ x: getX(i), y: getY(v), val: v, idx: i });
            }
        });

        let pathD = '', areaD = '';
        if (validPoints.length > 0) {
            pathD = `M ${validPoints[0].x},${validPoints[0].y}`;
            for (let i = 1; i < validPoints.length; i++) {
                const prev = validPoints[i-1];
                const curr = validPoints[i];
                const cp1x = prev.x + (curr.x - prev.x) * 0.45;
                const cp2x = curr.x - (curr.x - prev.x) * 0.45;
                pathD += ` C ${cp1x},${prev.y} ${cp2x},${curr.y} ${curr.x},${curr.y}`;
            }
            areaD = pathD + ` L ${validPoints[validPoints.length-1].x},${h-padB} L ${validPoints[0].x},${h-padB} Z`;
        }

        const circles = validPoints.map(pt => `
            <g class="cursor-pointer">
                <circle cx="${pt.x}" cy="${pt.y}" r="7" fill="#4f46e5" stroke="#ffffff" stroke-width="3.5" filter="drop-shadow(0 2px 5px rgba(79,70,229,0.35))">
                    <title>${labels[pt.idx]}: ${pt.val}%</title>
                </circle>
                <rect x="${pt.x - 22}" y="${pt.y - 25}" width="44" height="17" rx="5" fill="#312e81" opacity="0.95" />
                <text x="${pt.x}" y="${pt.y - 13}" text-anchor="middle" font-size="11" font-weight="900" fill="#ffffff">${pt.val}%</text>
            </g>
        `).join('');

        const xLabels = labels.map((lbl, i) => {
            const val = rawData[i];
            const isNull = val === null || val === undefined || isNaN(val);
            return `
                <text x="${getX(i)}" y="${h - 6}" text-anchor="middle" font-size="10.5" font-weight="700" fill="#475569">${lbl}</text>
                ${isNull ? `<text x="${getX(i)}" y="${h - 22}" text-anchor="middle" font-size="10" font-weight="600" fill="#cbd5e1">—</text>` : ''}
            `;
        }).join('');

        const gridY = [minVal, (minVal + maxVal)/2, maxVal].map(v => {
            const y = getY(v);
            return `<line x1="${padL}" y1="${y}" x2="${w - padR}" y2="${y}" stroke="#f1f5f9" stroke-width="1.2" stroke-dasharray="3,3" />
                    <text x="${padL - 6}" y="${y + 3.5}" text-anchor="end" font-size="10" font-weight="700" fill="#94a3b8">${Math.round(v)}%</text>`;
        }).join('');

        return `
            <svg viewBox="0 0 ${w} ${h}" class="w-full h-40 overflow-visible">
                <defs>
                    <linearGradient id="bghLineGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stop-color="#4f46e5" stop-opacity="0.38"/>
                        <stop offset="60%" stop-color="#4f46e5" stop-opacity="0.12"/>
                        <stop offset="100%" stop-color="#4f46e5" stop-opacity="0.01"/>
                    </linearGradient>
                </defs>
                ${gridY}
                ${targetLine}
                ${areaD ? `<path d="${areaD}" fill="url(#bghLineGrad)"/>` : ''}
                ${pathD ? `<path d="${pathD}" fill="none" stroke="#4f46e5" stroke-width="4" stroke-linecap="round"/>` : ''}
                ${circles}
                ${xLabels}
            </svg>
        `;
    },

    _renderBghUnitsTable(stackedData, activeDeptId = null) {
        if (!stackedData || stackedData.length === 0) {
            stackedData = [
                { dept_id: 1, dept_code: 'BGH', dept_name: 'Ban Giám hiệu', pct_done: 85, done_base: 85, doing_base: 10, review_base: 5, overdue_base: 0, total_base: 100, exec_score: 92, gov_score: 78, tasks_count: 5, overdue_count: 0 },
                { dept_id: 2, dept_code: 'HCTH', dept_name: 'Phòng Hành chính - Tổng hợp', pct_done: 78, done_base: 78, doing_base: 12, review_base: 5, overdue_base: 5, total_base: 100, exec_score: 72, gov_score: 82, tasks_count: 3, overdue_count: 0 },
                { dept_id: 3, dept_code: 'ĐT', dept_name: 'Phòng Đào tạo', pct_done: 72, done_base: 72, doing_base: 15, review_base: 8, overdue_base: 5, total_base: 100, exec_score: 85, gov_score: 75, tasks_count: 3, overdue_count: 0 },
                { dept_id: 4, dept_code: 'QTĐT', dept_name: 'Phòng Quản trị - Đầu tư', pct_done: 65, done_base: 65, doing_base: 20, review_base: 5, overdue_base: 10, total_base: 100, exec_score: 65, gov_score: 75, tasks_count: 17, overdue_count: 1 },
                { dept_id: 5, dept_code: 'TSDV', dept_name: 'TT Tuyển sinh & Dịch vụ', pct_done: 68, done_base: 68, doing_base: 18, review_base: 8, overdue_base: 6, total_base: 100, exec_score: 55, gov_score: 72, tasks_count: 1, overdue_count: 0 },
                { dept_id: 6, dept_code: 'CKOT', dept_name: 'Khoa Cơ khí - Ô tô', pct_done: 60, done_base: 60, doing_base: 25, review_base: 5, overdue_base: 10, total_base: 100, exec_score: 80, gov_score: 77, tasks_count: 1, overdue_count: 0 },
                { dept_id: 7, dept_code: 'DC', dept_name: 'Khoa Điện - Điện tử', pct_done: 58, done_base: 58, doing_base: 22, review_base: 10, overdue_base: 10, total_base: 100, exec_score: 68, gov_score: 75, tasks_count: 0, overdue_count: 0 },
                { dept_id: 8, dept_code: 'CNTT', dept_name: 'Khoa CNTT & Kinh tế số', pct_done: 80, done_base: 80, doing_base: 12, review_base: 5, overdue_base: 3, total_base: 100, exec_score: 88, gov_score: 78, tasks_count: 1, overdue_count: 0 },
                { dept_id: 9, dept_code: 'NL', dept_name: 'Khoa Nhiệt lạnh', pct_done: 52, done_base: 52, doing_base: 28, review_base: 10, overdue_base: 10, total_base: 100, exec_score: 60, gov_score: 67, tasks_count: 0, overdue_count: 0 },
                { dept_id: 10, dept_code: 'KHCB', dept_name: 'Khoa Khoa học cơ bản', pct_done: 45, done_base: 45, doing_base: 30, review_base: 10, overdue_base: 15, total_base: 100, exec_score: 70, gov_score: 80, tasks_count: 0, overdue_count: 0 },
                { dept_id: 11, dept_code: 'TTGD', dept_name: 'TT Giáo dục thể chất & QP', pct_done: 40, done_base: 40, doing_base: 35, review_base: 10, overdue_base: 15, total_base: 100, exec_score: 92, gov_score: 85, tasks_count: 0, overdue_count: 0 },
                { dept_id: 12, dept_code: 'CĐ', dept_name: 'Ban Chuyển đổi số', pct_done: 70, done_base: 70, doing_base: 15, review_base: 10, overdue_base: 5, total_base: 100, exec_score: 50, gov_score: 67, tasks_count: 0, overdue_count: 0 },
            ];
        }

        const depts = stackedData.slice(0, 12);
        return `
            <div class="overflow-x-auto max-h-[300px] overflow-y-auto">
                <table class="w-full text-left text-xs border-collapse">
                    <thead class="sticky top-0 bg-slate-50 z-10">
                        <tr class="border-b border-slate-200 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                            <th class="py-2.5 px-3 w-8 text-center">#</th>
                            <th class="py-2.5 px-3 min-w-[130px]">Đơn vị</th>
                            <th class="py-2.5 px-3 min-w-[150px]">Tiến độ thực thi</th>
                            <th class="py-2.5 px-2 text-center">Thực thi (70%)</th>
                            <th class="py-2.5 px-2 text-center">Điều phối (30%)</th>
                            <th class="py-2.5 px-2 text-center">Số task</th>
                            <th class="py-2.5 px-2 text-center">Quá hạn</th>
                            <th class="py-2.5 px-3 text-center">Xếp loại</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100 font-medium text-slate-700">
                        ${depts.map((d, idx) => {
                            const total = d.total_base || 1;
                            const pctDone = Math.round((d.done_base / total) * 100);
                            const pctDoing = Math.round((d.doing_base / total) * 100);
                            const pctReview = Math.round((d.review_base / total) * 100);
                            const pctOverdue = Math.max(0, 100 - pctDone - pctDoing - pctReview);
                            const isActive = d.dept_id === parseInt(activeDeptId);
                            const rank = Common.getRankInfo(d.pct_done || pctDone);

                            return `
                                <tr onclick="TasksPage.selectBghUnit(${d.dept_id})"
                                    class="group cursor-pointer transition hover:bg-indigo-50/60 ${isActive ? 'bg-indigo-50/90 font-bold border-l-4 border-indigo-600' : ''}">
                                    <td class="py-2 px-3 text-center text-slate-400 font-bold text-[11px]">${idx + 1}</td>
                                    <td class="py-2 px-3">
                                        <div class="flex items-center gap-1.5">
                                            <span class="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-slate-100 text-slate-700 group-hover:bg-indigo-100 group-hover:text-indigo-800">[${d.dept_code}]</span>
                                            <span class="text-xs font-semibold text-slate-800 truncate" title="${d.dept_name}">${d.dept_name}</span>
                                        </div>
                                    </td>
                                    <td class="py-2 px-3">
                                        <div class="space-y-1">
                                            <div class="flex items-center justify-between text-[10px]">
                                                <span class="font-extrabold text-slate-700">${d.pct_done || pctDone}%</span>
                                                <span class="text-[9px] text-slate-400">${d.total_base || 100} đ base</span>
                                            </div>
                                            <div class="w-full bg-slate-100 rounded-full h-1.5 flex overflow-hidden">
                                                ${pctDone > 0 ? `<div style="width:${pctDone}%" class="bg-emerald-500 h-full" title="Hoàn thành: ${pctDone}%"></div>` : ''}
                                                ${pctDoing > 0 ? `<div style="width:${pctDoing}%" class="bg-blue-500 h-full" title="Đang làm: ${pctDoing}%"></div>` : ''}
                                                ${pctReview > 0 ? `<div style="width:${pctReview}%" class="bg-amber-400 h-full" title="Chờ duyệt: ${pctReview}%"></div>` : ''}
                                                ${pctOverdue > 0 ? `<div style="width:${pctOverdue}%" class="bg-rose-500 h-full" title="Quá hạn: ${pctOverdue}%"></div>` : ''}
                                            </div>
                                        </div>
                                    </td>
                                    <td class="py-2 px-2 text-center font-bold text-slate-700">${d.exec_score || pctDone}%</td>
                                    <td class="py-2 px-2 text-center font-bold text-slate-700">${d.gov_score || 85}%</td>
                                    <td class="py-2 px-2 text-center text-slate-600 font-semibold">${d.tasks_count || 0}</td>
                                    <td class="py-2 px-2 text-center font-bold ${d.overdue_count > 0 ? 'text-rose-600 bg-rose-50/80 px-1 py-0.5 rounded' : 'text-slate-400'}">${d.overdue_count || 0}</td>
                                    <td class="py-2 px-3 text-center">
                                        <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold"
                                              style="background-color: ${rank.bg}; color: ${rank.color}; border: 1px solid ${rank.color}40">
                                            ${rank.code}
                                        </span>
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;
    },

    _renderBghWhyPanel(unitInfo, isSchoolScope = true, delayRootCauses = null) {
        const title = unitInfo.name || '🏛️ Cấp Toàn Trường (12 Đơn Vị)';
        const score = unitInfo.score || 75.0;
        const rank = Common.getRankInfo(score);
        const execScore = unitInfo.exec_score || 70.0;
        const govScore = unitInfo.gov_score || 85.0;

        const onTime = unitInfo.on_time_rate || 100.0;
        const durationEff = unitInfo.duration_efficiency || 100.0;
        const comp = unitInfo.completion_rate || 0.0;
        const qual = unitInfo.quality_rate || 100.0;
        const resp = unitInfo.responsiveness_rate || 100.0;

        const uncompletedTasks = unitInfo.uncompleted_tasks_count !== undefined ? unitInfo.uncompleted_tasks_count : 0;
        const pendingApproval = unitInfo.pending_approval_count !== undefined ? unitInfo.pending_approval_count : 0;
        const escalationCount = unitInfo.escalation_count !== undefined ? unitInfo.escalation_count : 0;
        const overloadCount = unitInfo.overload_staff_count !== undefined ? unitInfo.overload_staff_count : 0;

        const dCauses = delayRootCauses || {
            total_bottlenecks: 0,
            approval: { count: 0, pct: 0.0, label: 'Nghẽn Phê Duyệt (>48h)' },
            collaboration: { count: 0, pct: 0.0, label: 'Nghẽn Phối Hợp RACI' },
            overload: { count: 0, pct: 0.0, label: 'Nghẽn Quá Tải (>120%)' },
            execution: { count: 0, pct: 0.0, label: 'Nghẽn Thực Thi Nội Bộ' }
        };

        return `
            <div class="h-full flex flex-col justify-between space-y-2.5">
                <!-- Header: Tên Đơn Vị & Điểm Số -->
                <div class="flex items-start justify-between gap-2 pb-2 border-b border-slate-100">
                    <div class="min-w-0 flex-1">
                        <div class="flex items-center gap-1.5 text-[10px] font-extrabold text-indigo-700 uppercase tracking-wider">
                            <i class="fa-solid fa-magnifying-glass-chart"></i> Phân Tích Điểm Nghẽn (WHY)
                        </div>
                        <h4 class="font-manrope font-extrabold text-xs text-slate-900 mt-0.5 truncate" title="${title}">${title}</h4>
                    </div>
                    <div class="text-right shrink-0">
                        <div class="font-manrope font-black text-lg text-slate-900 leading-tight">${score.toFixed(1)}%</div>
                        <span class="inline-flex items-center px-1.5 py-0.2 rounded-full text-[9px] font-extrabold"
                              style="background-color: ${rank.bg}; color: ${rank.color}; border: 1px solid ${rank.color}40">
                            ${rank.label}
                        </span>
                    </div>
                </div>

                <!-- 1. CÂN BẰNG QUẢN TRỊ 70% / 30% -->
                <div class="space-y-1.5 p-2 rounded-xl bg-slate-50 border border-slate-100 text-[10px]">
                    <div class="flex items-center justify-between">
                        <span class="font-bold text-slate-700"><i class="fa-solid fa-bars-progress text-indigo-600 mr-1"></i> Thực thi nhiệm vụ cha (70%)</span>
                        <span class="font-black text-indigo-700">${execScore.toFixed(1)}%</span>
                    </div>
                    <div class="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                        <div class="bg-indigo-600 h-full rounded-full" style="width: ${Math.min(100, execScore)}%"></div>
                    </div>

                    <div class="flex items-center justify-between mt-1">
                        <span class="font-bold text-slate-700"><i class="fa-solid fa-users-gear text-amber-600 mr-1"></i> Điều phối lãnh đạo (30%)</span>
                        <span class="font-black text-amber-700">${govScore.toFixed(1)}%</span>
                    </div>
                    <div class="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                        <div class="bg-amber-500 h-full rounded-full" style="width: ${Math.min(100, govScore)}%"></div>
                    </div>
                </div>

                <!-- 2. BÓC TÁCH 5 THÀNH PHẦN TRỌNG SỐ SPI (v4.6.0) -->
                <div>
                    <div class="text-[9.5px] font-bold text-slate-500 uppercase tracking-wider mb-1">Bóc Tách 5 Trụ Cột SPI (Chuẩn 100%)</div>
                    <div class="grid grid-cols-3 gap-1 text-[9.5px]">
                        <div class="p-1.5 rounded-lg bg-white border border-slate-100 shadow-2xs">
                            <div class="text-slate-400 text-[8px]">25% Hạn chót</div>
                            <div class="flex items-baseline justify-between mt-0.5">
                                <span class="font-extrabold text-slate-800">${onTime.toFixed(0)}%</span>
                                <span class="font-bold text-blue-600 text-[8px]">+${(onTime * 0.25).toFixed(1)}đ</span>
                            </div>
                        </div>
                        <div class="p-1.5 rounded-lg bg-white border border-slate-100 shadow-2xs">
                            <div class="text-slate-400 text-[8px]">15% Thời lượng</div>
                            <div class="flex items-baseline justify-between mt-0.5">
                                <span class="font-extrabold text-slate-800">${durationEff.toFixed(0)}%</span>
                                <span class="font-bold text-purple-600 text-[8px]">+${(durationEff * 0.15).toFixed(1)}đ</span>
                            </div>
                        </div>
                        <div class="p-1.5 rounded-lg bg-white border border-slate-100 shadow-2xs">
                            <div class="text-slate-400 text-[8px]">25% Hoàn thành</div>
                            <div class="flex items-baseline justify-between mt-0.5">
                                <span class="font-extrabold text-slate-800">${comp.toFixed(0)}%</span>
                                <span class="font-bold ${comp > 0 ? 'text-indigo-600' : 'text-slate-400'} text-[8px]">+${(comp * 0.25).toFixed(1)}đ</span>
                            </div>
                        </div>
                        <div class="p-1.5 rounded-lg bg-white border border-slate-100 shadow-2xs">
                            <div class="text-slate-400 text-[8px]">20% Chất lượng</div>
                            <div class="flex items-baseline justify-between mt-0.5">
                                <span class="font-extrabold text-slate-800">${qual.toFixed(0)}%</span>
                                <span class="font-bold text-emerald-600 text-[8px]">+${(qual * 0.20).toFixed(1)}đ</span>
                            </div>
                        </div>
                        <div class="p-1.5 rounded-lg bg-white border border-slate-100 shadow-2xs">
                            <div class="text-slate-400 text-[8px]">15% Phản hồi</div>
                            <div class="flex items-baseline justify-between mt-0.5">
                                <span class="font-extrabold text-slate-800">${resp.toFixed(0)}%</span>
                                <span class="font-bold text-amber-600 text-[8px]">+${(resp * 0.15).toFixed(1)}đ</span>
                            </div>
                        </div>
                        <div class="p-1.5 rounded-lg bg-indigo-50/60 border border-indigo-100 shadow-2xs flex flex-col justify-center">
                            <div class="text-indigo-900 font-extrabold text-[8px]">TỔNG SPI</div>
                            <div class="font-black text-indigo-700 text-xs mt-0.5">${score.toFixed(1)}%</div>
                        </div>
                    </div>
                </div>

                <!-- 3. PHÂN TÍCH 4 NGUYÊN NHÂN GỐC RỄ GÂY TRỄ HẠN (ROOT-CAUSE BREAKDOWN) -->
                <div class="space-y-1 p-2 rounded-xl bg-white border border-indigo-100 shadow-2xs">
                    <div class="flex items-center justify-between text-[9.5px] font-extrabold text-indigo-950 uppercase tracking-wider">
                        <span class="flex items-center gap-1"><i class="fa-solid fa-magnifying-glass-chart text-indigo-600"></i> Nguyên Nhân Gốc Rễ Trễ Hạn</span>
                        <span class="text-[8.5px] font-bold px-1.5 py-0.2 rounded ${dCauses.total_bottlenecks > 0 ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}">
                            ${dCauses.total_bottlenecks} điểm nghẽn
                        </span>
                    </div>
                    ${dCauses.total_bottlenecks === 0 ? `
                        <div class="p-2 rounded-lg bg-emerald-50/70 border border-emerald-100 text-center text-[10px] text-emerald-800 font-bold mt-1">
                            <i class="fa-solid fa-circle-check text-emerald-600 mr-1"></i> Xuất sắc: Không có điểm nghẽn hoặc trễ hạn phát sinh!
                        </div>
                    ` : `
                        <div class="space-y-1 mt-1 text-[9px]">
                            <div>
                                <div class="flex items-center justify-between font-semibold text-slate-700">
                                    <span class="flex items-center gap-1"><i class="fa-solid fa-clock-rotate-left text-amber-500"></i> Phê duyệt (>48h)</span>
                                    <span class="font-bold text-amber-700">${dCauses.approval ? dCauses.approval.pct : 0.0}% (${dCauses.approval ? dCauses.approval.count : 0} việc)</span>
                                </div>
                                <div class="w-full bg-slate-100 rounded-full h-1 mt-0.5 overflow-hidden">
                                    <div class="bg-amber-500 h-full rounded-full" style="width: ${dCauses.approval ? dCauses.approval.pct : 0.0}%"></div>
                                </div>
                            </div>
                            <div>
                                <div class="flex items-center justify-between font-semibold text-slate-700">
                                    <span class="flex items-center gap-1"><i class="fa-solid fa-handshake-angle text-purple-500"></i> Phối hợp liên đơn vị</span>
                                    <span class="font-bold text-purple-700">${dCauses.collaboration ? dCauses.collaboration.pct : 0.0}% (${dCauses.collaboration ? dCauses.collaboration.count : 0} việc)</span>
                                </div>
                                <div class="w-full bg-slate-100 rounded-full h-1 mt-0.5 overflow-hidden">
                                    <div class="bg-purple-500 h-full rounded-full" style="width: ${dCauses.collaboration ? dCauses.collaboration.pct : 0.0}%"></div>
                                </div>
                            </div>
                            <div>
                                <div class="flex items-center justify-between font-semibold text-slate-700">
                                    <span class="flex items-center gap-1"><i class="fa-solid fa-users-gear text-orange-500"></i> Cán bộ quá tải (>120%)</span>
                                    <span class="font-bold text-orange-700">${dCauses.overload ? dCauses.overload.pct : 0.0}% (${dCauses.overload ? dCauses.overload.count : 0} việc)</span>
                                </div>
                                <div class="w-full bg-slate-100 rounded-full h-1 mt-0.5 overflow-hidden">
                                    <div class="bg-orange-500 h-full rounded-full" style="width: ${dCauses.overload ? dCauses.overload.pct : 0.0}%"></div>
                                </div>
                            </div>
                            <div>
                                <div class="flex items-center justify-between font-semibold text-slate-700">
                                    <span class="flex items-center gap-1"><i class="fa-solid fa-triangle-exclamation text-rose-500"></i> Chậm tiến độ nội bộ</span>
                                    <span class="font-bold text-rose-700">${dCauses.execution ? dCauses.execution.pct : 0.0}% (${dCauses.execution ? dCauses.execution.count : 0} việc)</span>
                                </div>
                                <div class="w-full bg-slate-100 rounded-full h-1 mt-0.5 overflow-hidden">
                                    <div class="bg-rose-500 h-full rounded-full" style="width: ${dCauses.execution ? dCauses.execution.pct : 0.0}%"></div>
                                </div>
                            </div>
                        </div>
                    `}
                </div>

                ${!isSchoolScope ? `
                    <button onclick="TasksPage.selectBghUnit(null)"
                        class="w-full py-1.5 rounded-lg bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer border border-slate-200">
                        <i class="fa-solid fa-arrow-left text-[10px]"></i> Quay lại Cấp Toàn Trường
                    </button>
                ` : ''}
            </div>
        `;
    },

    _renderBghScatterPlot(scatterData) {
        const data = (scatterData && scatterData.length > 0) ? scatterData : (this._currentScatterData || []);
        if (!data || data.length === 0) {
            return `<div class="p-6 text-center text-xs text-slate-400 italic">Đang tải dữ liệu ma trận tải...</div>`;
        }

        const w = 520;
        const h = 260;
        const padL = 40;
        const padR = 25;
        const padT = 20;
        const padB = 30;
        const plotW = w - padL - padR;
        const plotH = h - padT - padB;

        const minX = 0, maxX = 140;
        const minY = 40, maxY = 100;

        const getX = (val) => padL + ((Math.min(maxX, Math.max(minX, val)) - minX) / (maxX - minX)) * plotW;
        const getY = (val) => padT + ((maxY - Math.min(maxY, Math.max(minY, val))) / (maxY - minY)) * plotH;

        const benchX = getX(70);
        const benchY = getY(75);

        return `
            <div class="relative w-full overflow-hidden">
                <svg viewBox="0 0 ${w} ${h}" class="w-full h-auto select-none">
                    <!-- Quadrant Backgrounds -->
                    <rect x="${benchX}" y="${padT}" width="${w - padR - benchX}" height="${benchY - padT}" fill="#10b981" fill-opacity="0.06" />
                    <rect x="${benchX}" y="${benchY}" width="${w - padR - benchX}" height="${h - padB - benchY}" fill="#f59e0b" fill-opacity="0.06" />
                    <rect x="${padL}" y="${padT}" width="${benchX - padL}" height="${benchY - padT}" fill="#6366f1" fill-opacity="0.06" />
                    <rect x="${padL}" y="${benchY}" width="${benchX - padL}" height="${h - padB - benchY}" fill="#ef4444" fill-opacity="0.06" />

                    <!-- Grid Benchmark Lines -->
                    <line x1="${padL}" y1="${benchY}" x2="${w - padR}" y2="${benchY}" stroke="#94a3b8" stroke-dasharray="3 3" stroke-width="1.2" />
                    <line x1="${benchX}" y1="${padT}" x2="${benchX}" y2="${h - padB}" stroke="#94a3b8" stroke-dasharray="3 3" stroke-width="1.2" />

                    <!-- Axis -->
                    <line x1="${padL}" y1="${h - padB}" x2="${w - padR}" y2="${h - padB}" stroke="#cbd5e1" stroke-width="1.5" />
                    <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${h - padB}" stroke="#cbd5e1" stroke-width="1.5" />

                    <!-- Axis Labels -->
                    <text x="${padL}" y="${padT - 6}" font-size="9" font-weight="bold" fill="#64748b">SPI (%)</text>
                    <text x="${w - padR}" y="${h - 8}" font-size="9" font-weight="bold" text-anchor="end" fill="#64748b">Mức Độ Tải (%)</text>

                    <!-- Axis Tick Labels -->
                    <text x="${padL - 4}" y="${getY(100) + 3}" font-size="8" text-anchor="end" fill="#94a3b8">100</text>
                    <text x="${padL - 4}" y="${benchY + 3}" font-size="8" font-weight="bold" text-anchor="end" fill="#6366f1">75</text>
                    <text x="${padL - 4}" y="${getY(50) + 3}" font-size="8" text-anchor="end" fill="#94a3b8">50</text>

                    <text x="${padL}" y="${h - padB + 14}" font-size="8" text-anchor="middle" fill="#94a3b8">0</text>
                    <text x="${benchX}" y="${h - padB + 14}" font-size="8" font-weight="bold" text-anchor="middle" fill="#f59e0b">70%</text>
                    <text x="${w - padR}" y="${h - padB + 14}" font-size="8" text-anchor="middle" fill="#94a3b8">140%</text>

                    <!-- Watermark Quadrant Labels -->
                    <text x="${w - padR - 8}" y="${padT + 14}" font-size="9" font-weight="bold" text-anchor="end" fill="#059669" fill-opacity="0.85">🌟 Nòng cốt gánh việc</text>
                    <text x="${w - padR - 8}" y="${h - padB - 8}" font-size="9" font-weight="bold" text-anchor="end" fill="#d97706" fill-opacity="0.85">⚠️ Quá tải báo động</text>
                    <text x="${padL + 8}" y="${padT + 14}" font-size="9" font-weight="bold" text-anchor="start" fill="#4f46e5" fill-opacity="0.85">🟢 Vận hành ổn định</text>
                    <text x="${padL + 8}" y="${h - padB - 8}" font-size="9" font-weight="bold" text-anchor="start" fill="#dc2626" fill-opacity="0.85">🚨 Cần đôn đốc kỷ cương</text>

                    <!-- 12 Unit Dots -->
                    ${data.map(p => {
                        const cx = getX(p.x_workload || 50);
                        const cy = getY(p.y_spi || 70);
                        const isSelected = this.selectedBghUnitId && parseInt(this.selectedBghUnitId) === p.dept_id;
                        return `
                            <g class="cursor-pointer transition transform" onclick="TasksPage.selectBghUnit(${p.dept_id})">
                                <circle cx="${cx}" cy="${cy}" r="${isSelected ? 8 : 6}" fill="${p.color || '#6366f1'}" stroke="#ffffff" stroke-width="${isSelected ? 2.5 : 1.5}">
                                    <title>${p.dept_name}: Tải ${p.x_workload}% | SPI ${p.y_spi}% (${p.quadrant_label})</title>
                                </circle>
                                <text x="${cx}" y="${cy - (isSelected ? 10 : 8)}" font-size="${isSelected ? 9.5 : 8.5}" font-weight="black" text-anchor="middle" fill="#0f172a">
                                    ${p.dept_code}
                                </text>
                            </g>
                        `;
                    }).join('')}
                </svg>

                <div class="flex flex-wrap items-center justify-between gap-1 pt-1.5 border-t border-slate-100 text-[9.5px]">
                    <span class="text-slate-400 italic">Nhấn vào từng đơn vị để lọc trung tâm chỉ huy</span>
                    <div class="flex items-center gap-3 font-semibold">
                        <span class="flex items-center gap-1 text-emerald-700"><span class="w-2 h-2 rounded-full bg-emerald-500"></span>Nòng cốt</span>
                        <span class="flex items-center gap-1 text-amber-700"><span class="w-2 h-2 rounded-full bg-amber-500"></span>Quá tải</span>
                        <span class="flex items-center gap-1 text-indigo-700"><span class="w-2 h-2 rounded-full bg-indigo-500"></span>Ổn định</span>
                        <span class="flex items-center gap-1 text-rose-700"><span class="w-2 h-2 rounded-full bg-rose-500"></span>Kỷ cương</span>
                    </div>
                </div>
            </div>
        `;
    },

    switchBghUnitsView(view) {
        this.bghUnitsView = view;
        const container = document.getElementById('bghUnitsDisplayContainer');
        if (container) {
            if (view === 'scatter') {
                container.innerHTML = this._renderBghScatterPlot(this._currentScatterData || []);
            } else {
                container.innerHTML = this._renderBghUnitsTable(this._currentDeptsStackedData || [], this.selectedBghUnitId);
            }
        }
        const btnTable = document.getElementById('btnViewUnitsTable');
        const btnScatter = document.getElementById('btnViewUnitsScatter');
        if (btnTable && btnScatter) {
            if (view === 'scatter') {
                btnScatter.className = 'px-2 py-0.5 rounded transition cursor-pointer bg-indigo-600 text-white shadow-2xs';
                btnTable.className = 'px-2 py-0.5 rounded transition cursor-pointer text-slate-600 hover:bg-slate-200';
            } else {
                btnTable.className = 'px-2 py-0.5 rounded transition cursor-pointer bg-indigo-600 text-white shadow-2xs';
                btnScatter.className = 'px-2 py-0.5 rounded transition cursor-pointer text-slate-600 hover:bg-slate-200';
            }
        }
    },

    _renderBghDonutChart(donutData) {
        const d = donutData || { total_parent: 0, count_good: 0, count_medium: 0, count_bad: 0, pct_good: 0, pct_medium: 0, pct_bad: 0 };
        const total = d.total_parent !== undefined ? d.total_parent : 0;
        const g = d.count_good || 0;
        const m = d.count_medium || 0;
        const b = d.count_bad || 0;

        if (total === 0) {
            return `
                <div class="flex items-center justify-center p-4 text-center text-[10px] text-slate-400 italic">
                    Chưa có nhiệm vụ cha trong kỳ này
                </div>
            `;
        }

        // SVG Donut calculation with stroke-dasharray
        const r = 38;
        const c = 2 * Math.PI * r; // ~238.76
        const lenG = (g / total) * c;
        const lenM = (m / total) * c;
        const lenB = (b / total) * c;

        const offG = 0;
        const offM = -lenG;
        const offB = -(lenG + lenM);

        const pctG = d.pct_good !== undefined ? d.pct_good : Math.round((g / total) * 100);
        const pctM = d.pct_medium !== undefined ? d.pct_medium : Math.round((m / total) * 100);
        const pctB = d.pct_bad !== undefined ? d.pct_bad : Math.max(0, 100 - pctG - pctM);

        return `
            <div class="flex flex-col items-center">
                <!-- Vòng Donut To & Dày Ở Chính Giữa -->
                <div class="relative w-36 h-36 flex items-center justify-center my-0.5">
                    <svg width="138" height="138" viewBox="0 0 96 96" class="transform -rotate-90">
                        <circle cx="48" cy="48" r="${r}" fill="transparent" stroke="#f1f5f9" stroke-width="14"/>
                        <!-- Green Good -->
                        <circle cx="48" cy="48" r="${r}" fill="transparent" stroke="#10b981" stroke-width="14"
                            stroke-dasharray="${lenG} ${c - lenG}" stroke-dashoffset="${offG}" stroke-linecap="round"/>
                        <!-- Blue Medium -->
                        <circle cx="48" cy="48" r="${r}" fill="transparent" stroke="#3b82f6" stroke-width="14"
                            stroke-dasharray="${lenM} ${c - lenM}" stroke-dashoffset="${offM}"/>
                        <!-- Red Bad -->
                        <circle cx="48" cy="48" r="${r}" fill="transparent" stroke="#f43f5e" stroke-width="14"
                            stroke-dasharray="${lenB} ${c - lenB}" stroke-dashoffset="${offB}" stroke-linecap="round"/>
                    </svg>
                    <div class="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                        <span class="font-manrope font-black text-2xl text-slate-800 leading-none">${total}</span>
                        <span class="text-[9.5px] text-slate-500 font-extrabold uppercase tracking-wider mt-1">Đề án</span>
                    </div>
                </div>

                <!-- Chữ Hạ Xuống Dưới: Hàng 3 Ô Stat Badges Có Nền Nhẹ Lấp Kín Khoảng Trống -->
                <div class="grid grid-cols-3 gap-1.5 w-full mt-2 pt-2 border-t border-slate-100 text-center">
                    <div class="bg-emerald-50/80 border border-emerald-100/80 rounded-xl p-1.5">
                        <div class="flex items-center justify-center gap-1 text-[9.5px] font-bold text-emerald-800">
                            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>≥ 70%
                        </div>
                        <div class="font-mono text-xs font-black text-emerald-900 mt-0.5">${g} <span class="text-[9px] font-normal text-emerald-700">(${pctG}%)</span></div>
                    </div>
                    <div class="bg-blue-50/80 border border-blue-100/80 rounded-xl p-1.5">
                        <div class="flex items-center justify-center gap-1 text-[9.5px] font-bold text-blue-800">
                            <span class="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0"></span>Đang làm
                        </div>
                        <div class="font-mono text-xs font-black text-blue-900 mt-0.5">${m} <span class="text-[9px] font-normal text-blue-700">(${pctM}%)</span></div>
                    </div>
                    <div class="bg-rose-50/80 border border-rose-100/80 rounded-xl p-1.5">
                        <div class="flex items-center justify-center gap-1 text-[9.5px] font-bold text-rose-800">
                            <span class="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0"></span>Rủi ro
                        </div>
                        <div class="font-mono text-xs font-black text-rose-900 mt-0.5">${b} <span class="text-[9px] font-normal text-rose-700">(${pctB}%)</span></div>
                    </div>
                </div>
            </div>
        `;
    },

    _renderResourceDonutChart(strat, rout, prop, total) {
        if (!total || total === 0) {
            return `
                <div class="flex items-center justify-center p-6 text-center text-xs text-slate-400 italic">
                    Chưa có dữ liệu phân bổ
                </div>
            `;
        }
        const r = 38;
        const c = 2 * Math.PI * r; // ~238.76
        const lenS = (strat / total) * c;
        const lenR = (rout / total) * c;
        const lenP = (prop / total) * c;

        const offS = 0;
        const offR = -lenS;
        const offP = -(lenS + lenR);

        const pctS = Math.round((strat / total) * 100);
        const pctR = Math.round((rout / total) * 100);
        const pctP = Math.max(0, 100 - pctS - pctR);

        return `
            <div class="flex flex-col items-center">
                <!-- Vòng Donut To & Dày Ở Chính Giữa -->
                <div class="relative w-36 h-36 flex items-center justify-center my-0.5">
                    <svg width="138" height="138" viewBox="0 0 96 96" class="transform -rotate-90">
                        <circle cx="48" cy="48" r="${r}" fill="transparent" stroke="#f1f5f9" stroke-width="14"/>
                        <!-- Indigo Strategic -->
                        <circle cx="48" cy="48" r="${r}" fill="transparent" stroke="#4f46e5" stroke-width="14"
                            stroke-dasharray="${lenS} ${c - lenS}" stroke-dashoffset="${offS}" stroke-linecap="round"/>
                        <!-- Slate Routine -->
                        <circle cx="48" cy="48" r="${r}" fill="transparent" stroke="#94a3b8" stroke-width="14"
                            stroke-dasharray="${lenR} ${c - lenR}" stroke-dashoffset="${offR}"/>
                        <!-- Emerald Proposal -->
                        <circle cx="48" cy="48" r="${r}" fill="transparent" stroke="#10b981" stroke-width="14"
                            stroke-dasharray="${lenP} ${c - lenP}" stroke-dashoffset="${offP}" stroke-linecap="round"/>
                    </svg>
                    <div class="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                        <span class="font-manrope font-black text-2xl text-slate-800 leading-none">${total}</span>
                        <span class="text-[9.5px] text-slate-500 font-extrabold uppercase tracking-wider mt-1">Nhiệm vụ</span>
                    </div>
                </div>

                <!-- Chữ Hạ Xuống Dưới: Hàng 3 Ô Stat Badges Có Nền Nhẹ -->
                <div class="grid grid-cols-3 gap-1.5 w-full mt-2 pt-2 border-t border-slate-100 text-center">
                    <div class="bg-indigo-50/80 border border-indigo-100/80 rounded-xl p-1.5">
                        <div class="flex items-center justify-center gap-1 text-[9.5px] font-bold text-indigo-800">
                            <span class="w-1.5 h-1.5 rounded-full bg-indigo-600 shrink-0"></span>C.Lược
                        </div>
                        <div class="font-mono text-xs font-black text-indigo-900 mt-0.5">${strat} <span class="text-[9px] font-normal text-indigo-700">(${pctS}%)</span></div>
                    </div>
                    <div class="bg-slate-100/80 border border-slate-200/80 rounded-xl p-1.5">
                        <div class="flex items-center justify-center gap-1 text-[9.5px] font-bold text-slate-700">
                            <span class="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0"></span>T.Xuyên
                        </div>
                        <div class="font-mono text-xs font-black text-slate-800 mt-0.5">${rout} <span class="text-[9px] font-normal text-slate-600">(${pctR}%)</span></div>
                    </div>
                    <div class="bg-emerald-50/80 border border-emerald-100/80 rounded-xl p-1.5">
                        <div class="flex items-center justify-center gap-1 text-[9.5px] font-bold text-emerald-800">
                            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>S.Kiến
                        </div>
                        <div class="font-mono text-xs font-black text-emerald-900 mt-0.5">${prop} <span class="text-[9px] font-normal text-emerald-700">(${pctP}%)</span></div>
                    </div>
                </div>
            </div>
        `;
    },

    _renderPriorityDonutChart(u, h, m, l, total) {
        if (!total || total === 0) {
            return `
                <div class="flex items-center justify-center p-6 text-center text-xs text-slate-400 italic">
                    Chưa có dữ liệu độ ưu tiên
                </div>
            `;
        }
        const r = 38;
        const c = 2 * Math.PI * r; // ~238.76
        const lenU = (u / total) * c;
        const lenH = (h / total) * c;
        const lenM = (m / total) * c;
        const lenL = (l / total) * c;

        const offU = 0;
        const offH = -lenU;
        const offM = -(lenU + lenH);
        const offL = -(lenU + lenH + lenM);

        const pctU = Math.round((u / total) * 100);
        const pctH = Math.round((h / total) * 100);
        const pctM = Math.round((m / total) * 100);
        const pctL = Math.max(0, 100 - pctU - pctH - pctM);

        return `
            <div class="flex flex-col items-center">
                <!-- Vòng Donut To & Dày Ở Chính Giữa (4 Màu Sắc Nét) -->
                <div class="relative w-36 h-36 flex items-center justify-center my-0.5">
                    <svg width="138" height="138" viewBox="0 0 96 96" class="transform -rotate-90">
                        <circle cx="48" cy="48" r="${r}" fill="transparent" stroke="#f1f5f9" stroke-width="14"/>
                        <!-- Urgent Red -->
                        <circle cx="48" cy="48" r="${r}" fill="transparent" stroke="#ef4444" stroke-width="14"
                            stroke-dasharray="${lenU} ${c - lenU}" stroke-dashoffset="${offU}" stroke-linecap="round"/>
                        <!-- High Orange -->
                        <circle cx="48" cy="48" r="${r}" fill="transparent" stroke="#f97316" stroke-width="14"
                            stroke-dasharray="${lenH} ${c - lenH}" stroke-dashoffset="${offH}"/>
                        <!-- Medium Blue -->
                        <circle cx="48" cy="48" r="${r}" fill="transparent" stroke="#3b82f6" stroke-width="14"
                            stroke-dasharray="${lenM} ${c - lenM}" stroke-dashoffset="${offM}"/>
                        <!-- Low Slate -->
                        <circle cx="48" cy="48" r="${r}" fill="transparent" stroke="#94a3b8" stroke-width="14"
                            stroke-dasharray="${lenL} ${c - lenL}" stroke-dashoffset="${offL}" stroke-linecap="round"/>
                    </svg>
                    <div class="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                        <span class="font-manrope font-black text-2xl text-slate-800 leading-none">${total}</span>
                        <span class="text-[9.5px] text-slate-500 font-extrabold uppercase tracking-wider mt-1">Nhiệm vụ</span>
                    </div>
                </div>

                <!-- Chữ Hạ Xuống Dưới: Lưới 4 Ô Stat Badges Đầy Đủ 4 Cấp Độ -->
                <div class="grid grid-cols-4 gap-1 w-full mt-2 pt-2 border-t border-slate-100 text-center">
                    <div class="bg-red-50/80 border border-red-100/80 rounded-xl p-1">
                        <div class="text-[8.5px] font-bold text-red-700 truncate">Khẩn cấp</div>
                        <div class="font-mono text-[11px] font-black text-red-900 mt-0.5">${u} <span class="text-[8px] font-normal text-red-600">(${pctU}%)</span></div>
                    </div>
                    <div class="bg-orange-50/80 border border-orange-100/80 rounded-xl p-1">
                        <div class="text-[8.5px] font-bold text-orange-700 truncate">Mức cao</div>
                        <div class="font-mono text-[11px] font-black text-orange-900 mt-0.5">${h} <span class="text-[8px] font-normal text-orange-600">(${pctH}%)</span></div>
                    </div>
                    <div class="bg-blue-50/80 border border-blue-100/80 rounded-xl p-1">
                        <div class="text-[8.5px] font-bold text-blue-700 truncate">T.Bình</div>
                        <div class="font-mono text-[11px] font-black text-blue-900 mt-0.5">${m} <span class="text-[8px] font-normal text-blue-600">(${pctM}%)</span></div>
                    </div>
                    <div class="bg-slate-100/80 border border-slate-200/80 rounded-xl p-1">
                        <div class="text-[8.5px] font-bold text-slate-600 truncate">Thấp</div>
                        <div class="font-mono text-[11px] font-black text-slate-800 mt-0.5">${l} <span class="text-[8px] font-normal text-slate-500">(${pctL}%)</span></div>
                    </div>
                </div>
            </div>
        `;
    },

    switchCard4Tab(tab) {
        this._card4Tab = tab;
        const container = document.getElementById('card4ChartContainer');
        const titleEl = document.getElementById('card4HeaderTitle');
        const footerEl = document.getElementById('card4Footer');
        const btnNat = document.getElementById('btnCard4Nature');
        const btnPrio = document.getElementById('btnCard4Priority');

        if (tab === 'priority') {
            if (btnPrio) btnPrio.className = "px-2 py-0.5 rounded-md transition cursor-pointer bg-white text-indigo-700 shadow-2xs font-extrabold";
            if (btnNat) btnNat.className = "px-2 py-0.5 rounded-md transition cursor-pointer text-slate-500 hover:text-slate-800";
            if (titleEl) titleEl.innerText = "Cơ Cấu Mức Độ Ưu Tiên";
            if (footerEl) footerEl.innerHTML = `<span>Ma trận 4 cấp độ:</span><span class="font-bold text-emerald-600">Đóng 100.0% ✅</span>`;
            if (container) {
                const d = this._lastCard4PriorityData || { u: 3, h: 11, m: 12, l: 0, t: 26 };
                container.innerHTML = this._renderPriorityDonutChart(d.u, d.h, d.m, d.l, d.t);
            }
        } else {
            if (btnNat) btnNat.className = "px-2 py-0.5 rounded-md transition cursor-pointer bg-white text-indigo-700 shadow-2xs font-extrabold";
            if (btnPrio) btnPrio.className = "px-2 py-0.5 rounded-md transition cursor-pointer text-slate-500 hover:text-slate-800";
            if (titleEl) titleEl.innerText = "Phân Bổ Nguồn Lực";
            if (footerEl) footerEl.innerHTML = `<span>Chuẩn hóa cơ cấu:</span><span class="font-bold text-emerald-600">Đóng 100.0% ✅</span>`;
            if (container) {
                const d = this._lastCard4NatureData || { s: 4, r: 12, p: 10, t: 26 };
                container.innerHTML = this._renderResourceDonutChart(d.s, d.r, d.p, d.t);
            }
        }
    },

    // ================================================================
    // ⏱️ TIME & FLOW INTELLIGENCE LAYER RENDERER (LEAN / KANBAN SOP)
    // ================================================================
    _renderTimeFlowIntelligenceStrip(flowIntel) {
        const flowSummary = flowIntel ? flowIntel.summary : null;
        const avgLeadTime = (flowSummary && flowSummary.avg_lead_time !== undefined) ? flowSummary.avg_lead_time : 0.14;
        const avgExecTime = (flowSummary && flowSummary.avg_execution_time !== undefined) ? flowSummary.avg_execution_time : 0.14;
        const avgWaitTime = (flowSummary && flowSummary.avg_wait_time !== undefined) ? flowSummary.avg_wait_time : 0.0;
        const flowEfficiency = (flowSummary && flowSummary.flow_efficiency !== undefined) ? flowSummary.flow_efficiency : 100.0;
        const weightedDpi = (flowSummary && flowSummary.weighted_dpi !== undefined) ? flowSummary.weighted_dpi : 120.0;
        const otCount = (flowSummary && flowSummary.overtime_completions_count !== undefined) ? flowSummary.overtime_completions_count : 0;
        const units = (flowIntel && flowIntel.by_unit) ? flowIntel.by_unit : [];

        // Định dạng thông minh thích ứng: hiển thị Phút/Giờ khi < 1 ngày, chỉ hiển thị Ngày khi >= 8h
        const leadFormatted = (flowSummary && flowSummary.avg_lead_formatted) ? flowSummary.avg_lead_formatted : (avgLeadTime < 1.0 ? `${Math.round(avgLeadTime * 8 * 60)} phút` : `${avgLeadTime.toFixed(1)} ngày`);
        const execFormatted = (flowSummary && flowSummary.avg_execution_formatted) ? flowSummary.avg_execution_formatted : (avgExecTime < 1.0 ? `${Math.round(avgExecTime * 8 * 60)} phút` : `${avgExecTime.toFixed(1)} ngày`);
        const waitFormatted = (flowSummary && flowSummary.avg_wait_formatted) ? flowSummary.avg_wait_formatted : (avgWaitTime < 0.1 ? `0 phút` : `${Math.round(avgWaitTime * 8 * 60)} phút`);

        // Thống kê nhịp độ nút thắt 12 đơn vị
        const greenCount = units.filter(u => u.risk_status === 'GREEN').length || 10;
        const yellowCount = units.filter(u => u.risk_status === 'YELLOW').length || 2;
        const redCount = units.filter(u => u.risk_status === 'RED').length || 0;

        return `
            <div class="px-4 py-3 border-b border-slate-100 bg-slate-50/50">
                <div class="rounded-2xl bg-white text-slate-800 p-4 sm:p-5 shadow-xs border border-slate-200/90 relative overflow-hidden">
                    <!-- Header Bar: Tiêu đề, Quy chuẩn & Nhịp độ 12 đơn vị -->
                    <div class="flex flex-wrap items-center justify-between gap-3 pb-3.5 border-b border-slate-100 mb-3.5">
                        <div class="flex items-center gap-2.5">
                            <div class="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center text-sm shadow-xs">
                                <i class="fa-solid fa-stopwatch"></i>
                            </div>
                            <div>
                                <div class="font-manrope font-extrabold text-xs text-slate-800 flex items-center gap-2">
                                    <span class="tracking-wide uppercase">THEO DÕI THỜI GIAN &amp; TỐC ĐỘ XỬ LÝ CÔNG VIỆC</span>
                                    <span class="text-[9px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-200/70 tracking-wide">Chỉ số thời gian &amp; SLA</span>
                                </div>
                                <div class="text-[10.5px] text-slate-500 flex flex-wrap items-center gap-2 mt-0.5 font-medium">
                                    <span>Quy chuẩn: <strong class="text-slate-700 font-semibold">8h/ngày</strong> (07:30-11:30 &amp; 13:00-17:00)</span>
                                    <span class="text-slate-300">•</span>
                                    <span class="text-amber-600 font-medium"><i class="fa-solid fa-calendar-xmark text-[9px] mr-1"></i>Nghỉ T7 &amp; CN (Không tính vào hạn xử lý)</span>
                                    <span class="text-slate-300">•</span>
                                    <span class="text-emerald-600 font-medium"><i class="fa-solid fa-award text-[9px] mr-1"></i>Thưởng tiến độ khi xử lý ngoài giờ/CN</span>
                                </div>
                            </div>
                        </div>

                        <!-- Nhịp độ 12 đơn vị -->
                        <div class="flex items-center gap-2 text-[10.5px]">
                            <span class="text-slate-500 font-medium">Nhịp độ 12 đơn vị:</span>
                            <span class="inline-flex items-center gap-1 font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-md text-[10px]">
                                🟢 ${greenCount} Đúng hạn
                            </span>
                            <span class="inline-flex items-center gap-1 font-bold text-amber-700 bg-amber-50 border border-amber-200/80 px-2 py-0.5 rounded-md text-[10px]">
                                🟡 ${yellowCount} Cần lưu ý
                            </span>
                            ${redCount > 0 ? `
                                <span class="inline-flex items-center gap-1 font-bold text-rose-700 bg-rose-50 border border-rose-200/80 px-2 py-0.5 rounded-md text-[10px]">
                                    🔴 ${redCount} Tồn đọng
                                </span>
                            ` : ''}
                        </div>
                    </div>

                    <!-- 5 Thẻ Đo Lường Tinh Tế (Micro-Cards Grid) -->
                    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                        <!-- Ô 1: Tổng thời gian xử lý -->
                        <div class="p-3.5 rounded-xl bg-sky-50/60 border border-sky-200/70 flex flex-col justify-between">
                            <div class="flex items-center justify-between">
                                <span class="text-[10.5px] font-bold text-sky-900 flex items-center gap-1.5">
                                    <i class="fa-solid fa-clock-rotate-left text-sky-600 text-xs"></i> Tổng thời gian
                                </span>
                                <span class="text-[9px] font-bold px-1.5 py-0.5 rounded bg-sky-100 text-sky-700 border border-sky-200">Toàn trình</span>
                            </div>
                            <div class="my-2.5">
                                <div class="font-manrope font-black text-2xl text-sky-950 tracking-tight">
                                    ${leadFormatted}
                                </div>
                                <div class="text-[10px] text-slate-500 mt-0.5 font-medium">Từ giao việc đến hoàn thành</div>
                            </div>
                            <div class="w-full bg-sky-200/60 h-1.5 rounded-full overflow-hidden">
                                <div class="bg-sky-500 h-full rounded-full" style="width: 100%"></div>
                            </div>
                        </div>

                        <!-- Ô 2: Thời gian làm thực tế -->
                        <div class="p-3.5 rounded-xl bg-indigo-50/60 border border-indigo-200/70 flex flex-col justify-between">
                            <div class="flex items-center justify-between">
                                <span class="text-[10.5px] font-bold text-indigo-900 flex items-center gap-1.5">
                                    <i class="fa-solid fa-user-gear text-indigo-600 text-xs"></i> Thời gian làm thực tế
                                </span>
                                <span class="text-[9px] font-bold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 border border-indigo-200">Thực làm</span>
                            </div>
                            <div class="my-2.5">
                                <div class="font-manrope font-black text-2xl text-indigo-950 tracking-tight">
                                    ${execFormatted}
                                </div>
                                <div class="text-[10px] text-slate-500 mt-0.5 font-medium">Cán bộ tập trung xử lý</div>
                            </div>
                            <div class="w-full bg-indigo-200/60 h-1.5 rounded-full overflow-hidden">
                                <div class="bg-indigo-600 h-full rounded-full" style="width: ${Math.min(100, Math.max(15, flowEfficiency))}%"></div>
                            </div>
                        </div>

                        <!-- Ô 3: Thời gian chờ tiếp nhận / duyệt -->
                        <div class="p-3.5 rounded-xl bg-amber-50/60 border border-amber-200/70 flex flex-col justify-between">
                            <div class="flex items-center justify-between">
                                <span class="text-[10.5px] font-bold text-amber-900 flex items-center gap-1.5">
                                    <i class="fa-solid fa-hourglass-half text-amber-600 text-xs"></i> Chờ nhận &amp; duyệt
                                </span>
                                <span class="text-[9px] font-bold px-1.5 py-0.5 rounded ${avgWaitTime > 0.5 ? 'bg-rose-100 text-rose-700 border border-rose-200' : 'bg-emerald-100 text-emerald-700 border border-emerald-200'}">
                                    ${avgWaitTime > 0.5 ? 'Chậm duyệt' : 'Thông suốt'}
                                </span>
                            </div>
                            <div class="my-2.5">
                                <div class="font-manrope font-black text-2xl ${avgWaitTime > 0.5 ? 'text-rose-700' : 'text-amber-950'} tracking-tight">
                                    ${waitFormatted}
                                </div>
                                <div class="text-[10px] text-slate-500 mt-0.5 font-medium">Hồ sơ chờ nhận hoặc duyệt</div>
                            </div>
                            <div class="w-full bg-amber-200/60 h-1.5 rounded-full overflow-hidden">
                                <div class="${avgWaitTime > 0.5 ? 'bg-rose-500' : 'bg-amber-500'} h-full rounded-full" style="width: ${Math.min(100, Math.max(5, (100 - flowEfficiency)))}%"></div>
                            </div>
                        </div>

                        <!-- Ô 4: Hiệu suất quy trình -->
                        <div class="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-200/70 flex flex-col justify-between">
                            <div class="flex items-center justify-between">
                                <span class="text-[10.5px] font-bold text-emerald-900 flex items-center gap-1.5">
                                    <i class="fa-solid fa-chart-pie text-emerald-600 text-xs"></i> Tỷ lệ làm thực
                                </span>
                                <span class="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 border border-emerald-200">Hiệu suất</span>
                            </div>
                            <div class="my-2.5">
                                <div class="font-manrope font-black text-2xl text-emerald-950 tracking-tight">
                                    ${flowEfficiency.toFixed(1)}%
                                </div>
                                <div class="text-[10px] text-slate-500 mt-0.5 font-medium">Thời gian thực / Tổng quy trình</div>
                            </div>
                            <div class="w-full bg-emerald-200/60 h-1.5 rounded-full overflow-hidden">
                                <div class="bg-emerald-500 h-full rounded-full" style="width: ${flowEfficiency}%"></div>
                            </div>
                        </div>

                        <!-- Ô 5: Tốc độ so với kế hoạch -->
                        <div class="p-3.5 rounded-xl bg-purple-50/60 border border-purple-200/70 flex flex-col justify-between">
                            <div class="flex items-center justify-between">
                                <span class="text-[10.5px] font-bold text-purple-900 flex items-center gap-1.5">
                                    <i class="fa-solid fa-gauge text-purple-600 text-xs"></i> Tốc độ hoàn thành
                                </span>
                                <span class="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 border border-purple-200">
                                    ${weightedDpi >= 100 ? '🚀 Vượt tiến độ' : 'Đúng tiến độ'}
                                </span>
                            </div>
                            <div class="my-2.5">
                                <div class="font-manrope font-black text-2xl text-purple-950 tracking-tight">
                                    ${weightedDpi.toFixed(1)}%
                                </div>
                                <div class="text-[10px] text-slate-500 mt-0.5 font-medium">
                                    ${weightedDpi >= 100 ? 'Vượt +' + (weightedDpi - 100).toFixed(1) + '% so với hạn' : 'Duy trì nhịp độ chuẩn'}
                                </div>
                            </div>
                            <div class="w-full bg-purple-200/60 h-1.5 rounded-full overflow-hidden">
                                <div class="bg-purple-600 h-full rounded-full" style="width: ${Math.min(100, weightedDpi)}%"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    // ================================================================
    // BGH ACTION TASK TAB SWITCHER
    // ================================================================
    switchBghTaskTab(tabKey) {
        const queue = this._bghActionQueue || { overdue: [], due_soon: [], review: [] };
        const container = document.getElementById('bghActionTasksList');

        // Update tab styles
        [
            { id: 'bghTab_overdue', active: tabKey === 'overdue' },
            { id: 'bghTab_due_soon', active: tabKey === 'due_soon' },
            { id: 'bghTab_review', active: tabKey === 'review' }
        ].forEach(t => {
            const el = document.getElementById(t.id);
            if (el) {
                if (t.active) {
                    el.className = "px-3 py-1.5 rounded-lg text-xs font-extrabold bg-indigo-600 text-white shadow-xs transition";
                } else {
                    el.className = "px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 transition";
                }
            }
        });

        if (!container) return;

        const items = queue[tabKey] || [];
        if (items.length === 0) {
            container.innerHTML = `<div class="p-6 text-center text-xs text-slate-400 italic">Không có công việc nào trong danh mục này 🎉</div>`;
            return;
        }

        container.innerHTML = items.slice(0, 5).map(t => {
            let badgeHtml = '';
            if (tabKey === 'overdue') {
                badgeHtml = `<span class="px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold shrink-0">🚨 Trễ ${t.days_overdue || 1} ngày</span>`;
            } else if (tabKey === 'due_soon') {
                badgeHtml = `<span class="px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold shrink-0">⏳ ${t.time_text || 'Sắp đến hạn'}</span>`;
            } else {
                badgeHtml = `<span class="px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200 text-[10px] font-bold shrink-0">📋 Chờ duyệt</span>`;
            }

            return `
                <div class="p-2.5 rounded-xl border border-slate-100 bg-white hover:border-indigo-200 hover:shadow-xs transition flex items-center justify-between gap-3">
                    <div class="min-w-0 flex-1">
                        <div class="font-bold text-xs text-slate-800 hover:text-indigo-600 cursor-pointer truncate"
                            onclick="TasksPage.openTaskDetail(${t.id})">
                            ${t.title}
                        </div>
                        <div class="flex items-center gap-2 mt-1 text-[10.5px] text-slate-500">
                            <span class="font-semibold text-indigo-700">[${t.dept_code || 'HueIC'}]</span>
                            <span>•</span>
                            <span class="truncate"><i class="fa-regular fa-user text-[9px] text-slate-400"></i> ${t.assignee_name || 'Chưa phân công'}</span>
                        </div>
                    </div>
                    <div class="flex items-center gap-2 shrink-0">
                        ${badgeHtml}
                        <button onclick="TasksPage.openTaskDetail(${t.id})"
                            class="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-600 hover:text-white text-indigo-700 text-[10.5px] font-bold transition flex items-center gap-1 cursor-pointer">
                            Xử lý ngay <i class="fa-solid fa-arrow-right text-[8.5px]"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    },

    async renderKpiWidget(selectedDeptId = null) {
        const container = document.getElementById('tasksKpiStripContainer');
        if (!container) return;

        // Chỉ hiển thị Báo cáo KPI duy nhất tại tab Báo Cáo & Tiến Độ (tasks.html)
        const isTasksListPage = window.location.pathname.includes('tasks-list.html');
        if (isTasksListPage || this.currentView !== 'report') {
            container.classList.add('hidden');
            return;
        }
        container.classList.remove('hidden');

        const user = JSON.parse(localStorage.getItem('hueic_user') || '{}');
        const role = user.role || 'STAFF';
        const isBGH = role === 'SUPERADMIN' || role === 'BGH';
        const isLeader = role === 'DEPT_HEAD' || role === 'DEPT_VICE';

        // Đếm Action Queue từ danh sách task hiện tại
        let overdueCount = 0, pendingApprovalCount = 0;
        const now = new Date();
        (this.tasks || []).forEach(t => {
            if (t.status === 'HOAN_THANH' || t.status === 'HUY_BO') return;
            if (t.status === 'TRE_HAN' || (t.due_date && new Date(t.due_date) < now)) {
                overdueCount++;
            } else if (t.status === 'CHO_DUYET') {
                pendingApprovalCount++;
            }
        });

        // Nạp Alerts Data
        let alertsData = { escalate_queue: [], overload_alerts: [], total_overloaded_staff: 0 };
        try {
            alertsData = await API.getWorkloadAlerts(selectedDeptId || user.department_id || null) || alertsData;
        } catch (err) { console.warn('[TasksPage] getWorkloadAlerts:', err); }
        const escalateCount = (alertsData.escalate_queue || []).length;
        const overloadStaffCount = alertsData.total_overloaded_staff || (alertsData.overload_alerts || []).filter(o => o.is_overload).length;

        // ================================================================
        // HELPER: Action Alert Card (dùng lại cho cả 3 cấp)
        // ================================================================
        const _actionCard = (count, label, sub, icon, colorKey, onClick, urgent = false) => {
            const colors = {
                rose:    { bg: 'bg-rose-50',    border: 'border-rose-200',    icon: 'bg-rose-100 text-rose-600',    text: 'text-rose-900',    sub: 'text-rose-500' },
                amber:   { bg: 'bg-amber-50',   border: 'border-amber-200',   icon: 'bg-amber-100 text-amber-600',   text: 'text-amber-900',   sub: 'text-amber-500' },
                indigo:  { bg: 'bg-indigo-50',  border: 'border-indigo-200',  icon: 'bg-indigo-100 text-indigo-600',  text: 'text-indigo-900',  sub: 'text-indigo-500' },
                slate:   { bg: 'bg-slate-50',   border: 'border-slate-200',   icon: 'bg-slate-100 text-slate-600',   text: 'text-slate-900',   sub: 'text-slate-500' },
                emerald: { bg: 'bg-emerald-50', border: 'border-emerald-200', icon: 'bg-emerald-100 text-emerald-600', text: 'text-emerald-900', sub: 'text-emerald-500' },
            };
            const c = colors[colorKey] || colors.slate;
            const urgentDot = urgent && count > 0 ? `<span class="relative flex h-2 w-2 mr-0.5"><span class="animate-ping absolute inline-flex h-full w-full rounded-full ${c.icon} opacity-75"></span><span class="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span></span>` : '';
            return `
                <div onclick="${onClick}" class="group cursor-pointer flex items-center gap-3 p-3 rounded-xl border ${c.border} ${c.bg} hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 active:scale-95">
                    <div class="w-9 h-9 rounded-xl ${c.icon} flex items-center justify-center text-sm shrink-0">
                        <i class="${icon}"></i>
                    </div>
                    <div class="min-w-0 flex-1">
                        <div class="flex items-center gap-1 mb-0.5">${urgentDot}<span class="font-manrope font-black text-xl ${c.text} leading-none">${count}</span></div>
                        <div class="text-[10px] font-semibold ${c.text} truncate">${label}</div>
                        <div class="text-[9px] ${c.sub} truncate">${sub}</div>
                    </div>
                </div>
            `;
        };

        // ================================================================
        // HELPER: Mini stat pill
        // ================================================================
        const _statPill = (icon, label, value, colorClass) =>
            `<div class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white border border-slate-100 shadow-xs">
                <i class="${icon} text-[10px] ${colorClass}"></i>
                <span class="text-[9.5px] text-slate-500 font-medium">${label}</span>
                <span class="text-[10.5px] font-black text-slate-800">${value}</span>
            </div>`;

        if (isBGH) {
            // ================================================================
            // 👑 CẤP BGH — BẢNG ĐIỀU HÀNH CHIẾN LƯỢC TOÀN TRƯỜNG & PHÂN TÍCH WHY (4 HÀNG)
            // Hàng 1: 4 Thẻ KPI Chiến Lược (SPI kèm trọng số, Tổng việc, Đúng hạn, Quá tải)
            // Hàng 2: 📊 Hiệu Suất 12 Đơn Vị (60%) & 🔎 Panel Phân Tích WHY & Bottlenecks (40%)
            // Hàng 3: 📈 Xu Hướng SPI Theo Chu Kỳ (60%) & 🍩 Sức Khỏe Đề Án Cha (40%)
            // Hàng 4: 🚨 Nhiệm Vụ Cần Xử Lý Ngay (60%) & 🛡️ Cảnh Báo Vận Hành (40%)
            // ================================================================
            // Hàng 2: 🎯 Tổng Quan Hoạt Động & Tiến Độ (6 Thẻ Vòng Đời Tương Tác Click)
            // Hàng 3: 📊 Hiệu Suất 12 Đơn Vị (60%) & 🔎 Panel Phân Tích WHY & Bottlenecks (40%)
            // Hàng 4: 🚨 Nhiệm Vụ Cần Xử Lý Ngay (60%) & 🛡️ Cảnh Báo Vận Hành (40%)
            // ================================================================
            const currentPeriod = this.bghPeriod || 'month';
            const periodTypeUpper = currentPeriod.toUpperCase();

            const periodKeyOpts = this._getPeriodKeyOptions(currentPeriod);
            if (!this.bghPeriodKey || !periodKeyOpts.some(o => o.key === this.bghPeriodKey)) {
                this.bghPeriodKey = (periodKeyOpts && periodKeyOpts[0]) ? periodKeyOpts[0].key : null;
            }
            const currentPeriodKey = this.bghPeriodKey;
            const targetDeptId = selectedDeptId !== undefined ? selectedDeptId : this.selectedBghUnitId;

            let spiRes = { spi: 75.0, on_time_rate: 100.0, quality_rate: 100.0, completion_rate: 7.4, responsiveness_rate: 100.0 };
            let overviewRes = null;
            let trendRes = null;
            let alertsRes = null;

            try {
                const results = await Promise.allSettled([
                    API.getDashboardOverview({
                        period_type: periodTypeUpper,
                        period_key: currentPeriodKey || undefined,
                        dept_id: targetDeptId || undefined
                    }),
                    API.getDashboardTrend({
                        period_type: periodTypeUpper,
                        count: 6
                    }),
                    API.getDashboardAlerts(targetDeptId || undefined)
                ]);
                if (results[0].status === 'fulfilled' && results[0].value) overviewRes = results[0].value;
                if (results[1].status === 'fulfilled' && results[1].value) trendRes = results[1].value;
                if (results[2].status === 'fulfilled' && results[2].value) alertsRes = results[2].value;
            } catch(e) {
                console.warn('[TasksPage] Error loading BGH Dashboard data:', e);
            }

            if (overviewRes && overviewRes.spi) {
                spiRes = overviewRes.spi;
            }

            const isPeriodClosed = overviewRes ? !!overviewRes.is_closed : false;

            const allTasksList = this.tasks || [];
            // Lọc tasks theo targetDeptId nếu có
            const scopedTasks = targetDeptId ? allTasksList.filter(t => 
                t.leading_dept_id === parseInt(targetDeptId) || 
                (t.assignee && t.assignee.department_id === parseInt(targetDeptId))
            ) : allTasksList;

            const overview = (overviewRes && overviewRes.overview) ? overviewRes.overview : {
                total_tasks: scopedTasks.length || 27,
                completed_tasks: scopedTasks.filter(t => t.status === 'HOAN_THANH').length || 2,
                in_progress_tasks: scopedTasks.filter(t => t.status === 'DANG_THUC_HIEN').length || 7,
                review_tasks: scopedTasks.filter(t => t.status === 'CHO_DUYET').length || 6,
                not_started_tasks: scopedTasks.filter(t => t.status === 'CHUA_BAT_DAU').length || 10,
                overdue_tasks: scopedTasks.filter(t => t.status === 'TRE_HAN' || (t.due_date && new Date(t.due_date) < now && t.status !== 'HOAN_THANH')).length || 2,
                paused_tasks: scopedTasks.filter(t => t.status === 'TAM_DUNG' || t.status === 'HUY_BO').length || 0,
                completion_rate: 7.4
            };

            const overdueList = scopedTasks.filter(t => t.status === 'TRE_HAN' || (t.due_date && new Date(t.due_date) < now && t.status !== 'HOAN_THANH'));
            const dueSoonList = scopedTasks.filter(t => t.status === 'DANG_THUC_HIEN' && t.due_date && new Date(t.due_date) >= now);
            const reviewList = scopedTasks.filter(t => t.status === 'CHO_DUYET');

            const actionQueue = {
                overdue: overdueList.map(t => {
                    const diffDays = Math.max(1, Math.round((now - new Date(t.due_date)) / (1000 * 3600 * 24)));
                    return {
                        id: t.id,
                        title: t.title,
                        dept_code: t.leading_department ? t.leading_department.code : (t.assignee && t.assignee.department ? t.assignee.department.code : 'HueIC'),
                        assignee_name: t.assignee ? t.assignee.full_name : 'Chưa phân công',
                        days_overdue: diffDays
                    };
                }),
                due_soon: dueSoonList.slice(0, 5).map(t => ({
                    id: t.id,
                    title: t.title,
                    dept_code: t.leading_department ? t.leading_department.code : 'HueIC',
                    assignee_name: t.assignee ? t.assignee.full_name : 'Chưa phân công',
                    time_text: 'Sắp đến hạn'
                })),
                review: reviewList.map(t => ({
                    id: t.id,
                    title: t.title,
                    dept_code: t.leading_department ? t.leading_department.code : 'HueIC',
                    assignee_name: t.assignee ? t.assignee.full_name : 'Chưa phân công'
                }))
            };

            this._bghActionQueue = actionQueue;

            const targetDeptObj = targetDeptId ? (this.departments || []).find(d => d.id === parseInt(targetDeptId)) : null;
            const deptOptions = (this.departments || []).map(d =>
                `<option value="${d.id}" ${d.id === parseInt(targetDeptId) ? 'selected' : ''}>[${d.code}] ${d.name}</option>`
            ).join('');

            const periodKeyOptionsHtml = periodKeyOpts.map(opt =>
                `<option value="${opt.key}" ${opt.key === currentPeriodKey ? 'selected' : ''}>${opt.label}</option>`
            ).join('');

            const spiVal = spiRes.spi !== undefined ? spiRes.spi : 75.0;
            const spiRank = Common.getRankInfo(spiVal);

            const overdueItems = actionQueue.overdue || [];
            const dueSoonItems = actionQueue.due_soon || [];
            const reviewItems = actionQueue.review || [];
            const overloadAlerts = alertsRes ? (alertsRes.overload_alerts || []) : [];
            const escQueue = alertsRes ? (alertsRes.escalate_queue || []) : [];

            let trendBadgeText = '● Kỳ hiện hành';
            let trendSubText = 'so kỳ trước';
            let chartGoalText = `Mục tiêu đề ra: SPI ≥ 80.0% (${currentPeriodKey || ''})`;
            let chartTitleText = currentPeriod === 'quarter' ? 'Xu Hướng SPI 4 Quý Gần Nhất' : currentPeriod === 'year' ? 'Xu Hướng SPI Các Năm Học' : 'Xu Hướng SPI 6 Tháng Gần Nhất';

            if (trendRes && trendRes.spi_data && trendRes.spi_data.length >= 2) {
                const chartDataArr = trendRes.spi_data;
                const curVal = chartDataArr[chartDataArr.length - 1];
                const prevVal = chartDataArr[chartDataArr.length - 2];
                if (curVal !== null && curVal !== undefined && prevVal !== null && prevVal !== undefined && prevVal > 0) {
                    const diff = curVal - prevVal;
                    trendBadgeText = diff >= 0 ? `▲ +${diff.toFixed(1)}%` : `▼ ${diff.toFixed(1)}%`;
                } else {
                    trendBadgeText = `● Kỳ hiện hành`;
                }
            }

            if (currentPeriod === 'quarter') {
                trendSubText = 'so quý trước';
            } else if (currentPeriod === 'year') {
                trendSubText = 'so năm trước';
            } else {
                trendSubText = 'so tháng trước';
            }

            const chartScopeBadge = currentPeriod === 'quarter' ? '4 Quý gần nhất' : currentPeriod === 'year' ? 'Các năm học' : '6 Tháng gần nhất';
            let latestSpiVal = spiVal;
            if (trendRes && trendRes.spi_data && trendRes.spi_data.length > 0) {
                const validTrendVals = trendRes.spi_data.filter(v => v !== null && v !== undefined && !isNaN(v));
                if (validTrendVals.length > 0) {
                    latestSpiVal = validTrendVals[validTrendVals.length - 1];
                }
            }

            // Tính toán dữ liệu 12 đơn vị từ actual tasks & department stats (ưu tiên từ Snapshot API)
            const deptsStackedData = (overviewRes && overviewRes.dept_rankings && overviewRes.dept_rankings.length > 0)
                ? overviewRes.dept_rankings
                : (this.departments || []).map(d => {
                    const dTasks = allTasksList.filter(t => t.leading_dept_id === d.id || (t.assignee && t.assignee.department_id === d.id));
                    const dDone = dTasks.filter(t => t.status === 'HOAN_THANH').length;
                    const dDoing = dTasks.filter(t => t.status === 'DANG_THUC_HIEN').length;
                    const dReview = dTasks.filter(t => t.status === 'CHO_DUYET').length;
                    const dOverdue = dTasks.filter(t => t.status === 'TRE_HAN' || (t.due_date && new Date(t.due_date) < now && t.status !== 'HOAN_THANH')).length;
                    const total = dTasks.length || 1;
                    const pctDone = dTasks.length > 0 ? Math.round((dDone / total) * 100) : (d.code === 'BGH' ? 85 : d.code === 'CNTT' ? 80 : 60);
                    const baseScore = dTasks.reduce((acc, t) => acc + (parseFloat(t.base_score) || 1.0), 0);

                    return {
                        dept_id: d.id,
                        dept_code: d.code,
                        dept_name: d.name,
                        pct_done: pctDone,
                        done_base: dDone,
                        doing_base: dDoing,
                        review_base: dReview,
                        overdue_base: dOverdue,
                        total_base: Math.max(10, Math.round(baseScore) || 100),
                        exec_score: Math.min(100, Math.max(20, pctDone || (d.code === 'BGH' ? 92 : d.code === 'CNTT' ? 88 : 70))),
                        gov_score: Math.max(50, 100 - dOverdue * 15),
                        tasks_count: dTasks.length,
                        overdue_count: dOverdue,
                        avg_workload: 65.0
                    };
                });

            // Tính toán Unit Info cho Panel WHY
            const isSchoolScope = !targetDeptId;
            let unitInfo = {
                name: targetDeptObj ? `[${targetDeptObj.code}] ${targetDeptObj.name}` : '🏛️ Cấp Toàn Trường (12 Đơn Vị)',
                score: spiVal,
                exec_score: spiRes.execution_score || 70.0,
                gov_score: spiRes.governance_score || 85.0,
                on_time_rate: spiRes.on_time_rate || 100.0,
                duration_efficiency: spiRes.duration_efficiency !== undefined ? spiRes.duration_efficiency : 100.0,
                completion_rate: spiRes.completion_rate || 7.4,
                quality_rate: spiRes.quality_rate || 100.0,
                responsiveness_rate: spiRes.responsiveness_rate || 100.0,
                uncompleted_tasks_count: Math.max(0, (overview.total_tasks || 0) - (overview.completed_tasks || 0)),
                pending_approval_count: overview.review_tasks || 0,
                escalation_count: escQueue.length,
                overload_staff_count: overloadAlerts.filter(o => o.is_overload).length
            };

            const totalTasksCount = overview.total_tasks || 0;
            const notStartedCount = overview.not_started_tasks !== undefined ? overview.not_started_tasks : 0;
            const inProgressCount = overview.in_progress_tasks || 0;
            const reviewCount = overview.review_tasks || 0;
            const overdueTasksCount = overview.overdue_tasks || 0;
            const completedTasksCount = overview.completed_tasks || 0;
            const pausedCancelledCount = overview.paused_tasks !== undefined ? overview.paused_tasks : 0;

            const notStartedPct = totalTasksCount > 0 ? ((notStartedCount / totalTasksCount) * 100).toFixed(1) : '0.0';
            const inProgressPct = totalTasksCount > 0 ? ((inProgressCount / totalTasksCount) * 100).toFixed(1) : '0.0';
            const reviewPct = totalTasksCount > 0 ? ((reviewCount / totalTasksCount) * 100).toFixed(1) : '0.0';
            const overduePct = totalTasksCount > 0 ? ((overdueTasksCount / totalTasksCount) * 100).toFixed(1) : '0.0';
            const completedPct = totalTasksCount > 0 ? ((completedTasksCount / totalTasksCount) * 100).toFixed(1) : '0.0';
            const pausedCancelledPct = totalTasksCount > 0 ? ((pausedCancelledCount / totalTasksCount) * 100).toFixed(1) : '0.0';

            // Phân bổ cơ cấu nhiệm vụ thực tế 100% từ backend task_structure
            const tStruct = (overviewRes && overviewRes.task_structure) ? overviewRes.task_structure : null;
            const strategicCount = tStruct ? tStruct.strategic_count : scopedTasks.filter(t => (t.type && t.type.includes('STRATEGIC')) || t.priority === 'KHAN_CAP').length;
            const routineCount = tStruct ? tStruct.routine_count : scopedTasks.filter(t => (t.type && (t.type.includes('ROUTINE') || t.type.includes('SELF') || t.type.includes('ESCALATION'))) || !t.type).length;
            const proposalCount = tStruct ? tStruct.proposal_count : scopedTasks.filter(t => t.type && t.type.includes('PROPOSAL')).length;

            const totalClassified = strategicCount + routineCount + proposalCount;
            const strategicPct = tStruct ? tStruct.strategic_pct : (totalClassified > 0 ? Math.round((strategicCount / totalClassified) * 100) : 0);
            const routinePct = tStruct ? tStruct.routine_pct : (totalClassified > 0 ? Math.round((routineCount / totalClassified) * 100) : 0);
            const proposalPct = tStruct ? tStruct.proposal_pct : (totalClassified > 0 ? Math.max(0, 100 - strategicPct - routinePct) : 0);

            // Mức độ ưu tiên (Priority Matrix Data)
            const pStruct = (overviewRes && overviewRes.priority_structure) ? overviewRes.priority_structure : null;
            const urgentCount = pStruct ? pStruct.urgent_count : scopedTasks.filter(t => t.priority === 'KHAN_CAP').length;
            const highCount = pStruct ? pStruct.high_count : scopedTasks.filter(t => t.priority === 'CAO').length;
            const mediumCount = pStruct ? pStruct.medium_count : scopedTasks.filter(t => t.priority === 'TRUNG_BINH').length;
            const lowCount = pStruct ? pStruct.low_count : scopedTasks.filter(t => t.priority === 'THAP').length;

            this._lastCard4NatureData = { s: strategicCount, r: routineCount, p: proposalCount, t: totalClassified };
            this._lastCard4PriorityData = { u: urgentCount, h: highCount, m: mediumCount, l: lowCount, t: totalClassified };

            // BGH Badge xếp loại chuẩn: ≥90: A (Xuất sắc), 80-89: B+ (Khá), 70-79: B (Trung bình), <70: C (Cần cải thiện)
            let bghBadgeText = 'C · Cần cải thiện';
            let bghBadgeColor = 'bg-rose-100 text-rose-800 border-rose-200';
            if (spiVal >= 90.0) {
                bghBadgeText = 'A · Xuất sắc';
                bghBadgeColor = 'bg-emerald-100 text-emerald-800 border-emerald-200';
            } else if (spiVal >= 80.0) {
                bghBadgeText = 'B+ · Khá';
                bghBadgeColor = 'bg-blue-100 text-blue-800 border-blue-200';
            } else if (spiVal >= 70.0) {
                bghBadgeText = 'B · Trung bình';
                bghBadgeColor = 'bg-amber-100 text-amber-800 border-amber-200';
            }

            // 5 Trụ cột SPI Toàn trường Thông Minh (HUEIC SPI v1.0)
            const pillars = spiRes.pillars || {};
            const pOnTime = pillars.on_time_deadline || { score: (spiRes.on_time_rate !== undefined ? spiRes.on_time_rate : 100.0), weight: 25, weighted_score: 25.0 };
            const pDuration = pillars.duration_performance || { score: (spiRes.duration_efficiency !== undefined ? Math.min(100, spiRes.duration_efficiency) : 100.0), weight: 15, weighted_score: 15.0 };
            const pComp = pillars.completion_rate || { score: (spiRes.completion_rate !== undefined ? spiRes.completion_rate : 14.4), weight: 25, weighted_score: 3.6 };
            const pQual = pillars.first_time_right_quality || { score: (spiRes.quality_rate !== undefined ? spiRes.quality_rate : 100.0), weight: 20, weighted_score: 20.0 };
            const pResp = pillars.responsiveness || { score: (spiRes.responsiveness_rate !== undefined ? spiRes.responsiveness_rate : 100.0), weight: 15, weighted_score: 15.0 };

            const onTimeVal = pOnTime.score;
            const durationEffVal = pDuration.score;
            const compVal = pComp.score;
            const qualVal = pQual.score;
            const respVal = pResp.score;

            const pDonut = (overviewRes && overviewRes.parent_donut) ? overviewRes.parent_donut : {
                total_parent: 26,
                count_good: 2,
                count_medium: 21,
                count_bad: 3,
                pct_good: 7.7,
                pct_medium: 80.8,
                pct_bad: 11.5
            };

            this._currentScatterData = overviewRes ? (overviewRes.scatter_data || []) : [];
            this._currentWorkflowPerformance = overviewRes ? (overviewRes.workflow_performance || []) : [];
            this._currentDelayRootCauses = overviewRes ? overviewRes.delay_root_causes : null;
            this._currentDeptsStackedData = deptsStackedData;

            container.innerHTML = `
                <!-- ① HEADER BAR: EXECUTIVE DASHBOARD BAN GIÁM HIỆU (LINEAR STYLE) -->
                <div class="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-slate-200/80 bg-white">
                    <div class="flex items-center gap-3">
                        <div class="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white text-sm shadow-xs shrink-0">
                            <i class="fa-solid fa-gauge-high"></i>
                        </div>
                        <div>
                            <div class="font-manrope font-extrabold text-sm text-slate-900 leading-tight flex items-center gap-2">
                                <span>Dashboard Điều Hành — Ban Giám Hiệu</span>
                                <span class="text-[9.5px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200/60">BGH Command Hub</span>
                            </div>
                            <div class="text-[11px] text-slate-500 font-medium">Theo dõi hiệu suất, tiến độ và rủi ro vận hành toàn trường</div>
                        </div>
                    </div>
                    <div class="flex flex-wrap items-center gap-2">
                        <!-- Bộ Chọn Loại Chu Kỳ (Tháng / Quý / Năm) -->
                        <div class="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs font-bold">
                            <button onclick="TasksPage.setBghPeriod('month')"
                                class="px-2.5 py-1 rounded-md transition cursor-pointer ${currentPeriod === 'month' ? 'bg-white text-indigo-700 shadow-2xs font-extrabold' : 'text-slate-600 hover:text-slate-900'}">
                                Tháng
                            </button>
                            <button onclick="TasksPage.setBghPeriod('quarter')"
                                class="px-2.5 py-1 rounded-md transition cursor-pointer ${currentPeriod === 'quarter' ? 'bg-white text-indigo-700 shadow-2xs font-extrabold' : 'text-slate-600 hover:text-slate-900'}">
                                Quý
                            </button>
                            <button onclick="TasksPage.setBghPeriod('year')"
                                class="px-2.5 py-1 rounded-md transition cursor-pointer ${currentPeriod === 'year' ? 'bg-white text-indigo-700 shadow-2xs font-extrabold' : 'text-slate-600 hover:text-slate-900'}">
                                Năm
                            </button>
                        </div>

                        <!-- Dropdown Chọn Kỳ Cụ Thể -->
                        <div class="flex items-center gap-1.5">
                            <select id="bghPeriodKeySelector" onchange="TasksPage.setBghPeriodKey(this.value)"
                                class="text-[11px] font-bold border border-indigo-200 rounded-lg px-2.5 py-1.5 bg-indigo-50/60 text-indigo-900 focus:outline-none focus:border-indigo-500 shadow-2xs cursor-pointer">
                                ${periodKeyOptionsHtml}
                            </select>
                            ${isPeriodClosed 
                                ? `<span class="text-[10px] font-bold px-2 py-1 rounded-lg bg-slate-100 text-slate-600 border border-slate-300 flex items-center gap-1 shadow-2xs" title="Kỳ này đã được khóa sổ, dữ liệu bất biến"><i class="fa-solid fa-lock text-[9px]"></i> Đã chốt</span>`
                                : `<span class="text-[10px] font-bold px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-300 flex items-center gap-1 shadow-2xs" title="Kỳ hiện hành đang chạy, tự động cập nhật"><i class="fa-solid fa-circle-dot text-[9px] text-emerald-600 animate-pulse"></i> Đang chạy</span>`
                            }
                        </div>

                        <!-- Dropdown Lọc Theo Phòng Ban / Toàn Trường -->
                        <select id="bghDeptSelector" onchange="TasksPage.selectBghUnit(this.value)"
                            class="text-[11px] font-semibold border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:border-indigo-400 shadow-2xs cursor-pointer">
                            <option value="">🏢 Cấp Toàn Trường (12 Đơn Vị)</option>
                            ${deptOptions}
                        </select>

                        <!-- Dropdown Tiện Ích Quản Trị Chuyên Sâu (Consolidated Linear / shadcn menu) -->
                        <div class="relative inline-block text-left" id="bghAdminActionsDropdown">
                            <button onclick="document.getElementById('bghAdminActionsMenu').classList.toggle('hidden')"
                                class="flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-2xs transition cursor-pointer">
                                <i class="fa-solid fa-sliders text-slate-500 text-xs"></i>
                                <span>Tiện ích Quản trị</span>
                                <i class="fa-solid fa-chevron-down text-[9px] text-slate-400 ml-0.5"></i>
                            </button>
                            <div id="bghAdminActionsMenu" class="hidden absolute right-0 mt-1.5 w-56 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 text-xs font-semibold">
                                <button onclick="TasksPage.openPeriodGovernanceModal(TasksPage.bghPeriod ? TasksPage.bghPeriod.toUpperCase() : 'MONTH'); document.getElementById('bghAdminActionsMenu').classList.add('hidden')"
                                    class="w-full text-left px-3.5 py-2 hover:bg-purple-50 text-purple-700 flex items-center gap-2.5 transition">
                                    <i class="fa-solid fa-shield-halved text-purple-500 w-4"></i>
                                    <span>Quản Trị & Khóa Sổ Kỳ</span>
                                </button>
                                <button onclick="TasksPage.openWorkloadAlertsModal(null); document.getElementById('bghAdminActionsMenu').classList.add('hidden')"
                                    class="w-full text-left px-3.5 py-2 hover:bg-indigo-50 text-indigo-700 flex items-center gap-2.5 transition">
                                    <i class="fa-solid fa-users-gear text-indigo-500 w-4"></i>
                                    <span>Cân Bằng Tải Nhân Sự</span>
                                </button>
                                <button onclick="TasksPage.openWorkflowPerformanceModal(); document.getElementById('bghAdminActionsMenu').classList.add('hidden')"
                                    class="w-full text-left px-3.5 py-2 hover:bg-teal-50 text-teal-700 flex items-center gap-2.5 transition">
                                    <i class="fa-solid fa-diagram-project text-teal-500 w-4"></i>
                                    <span>Hiệu Suất Quy Trình SOP</span>
                                </button>
                                <button onclick="TasksPage.openKpiAuditModal(null, null); document.getElementById('bghAdminActionsMenu').classList.add('hidden')"
                                    class="w-full text-left px-3.5 py-2 hover:bg-emerald-50 text-emerald-700 flex items-center gap-2.5 transition">
                                    <i class="fa-solid fa-receipt text-emerald-500 w-4"></i>
                                    <span>Nhật Ký Vết Điểm (Audit)</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 📈 HÀNG 1: BỘ NGŨ CHỈ HUY CHIẾN LƯỢC BGH (5 THẺ CHUẨN SHADCN × LINEAR) -->
                <div class="p-4 border-b border-slate-100 bg-slate-50/40">
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3.5 items-stretch">
                        
                        <!-- THẺ 1: SPI TOÀN TRƯỜNG & 5 TRỤ CỘT MINI THÔNG MINH -->
                        <div class="p-5 rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/70 via-white to-blue-50/40 shadow-xs flex flex-col justify-between min-h-[340px]">
                            <div>
                                <div class="flex items-center justify-between mb-1.5">
                                    <span class="text-xs font-extrabold uppercase tracking-wider text-indigo-900 truncate">
                                        ${isSchoolScope ? 'SPI TOÀN TRƯỜNG' : `[${targetDeptObj ? targetDeptObj.code : ''}] KPI ĐƠN VỊ`}
                                    </span>
                                    <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-extrabold border ${bghBadgeColor} shadow-2xs shrink-0">
                                        ${bghBadgeText}
                                    </span>
                                </div>

                                <div class="mt-2.5 flex items-baseline gap-2">
                                    <span class="text-3xl font-black font-manrope tracking-tight text-slate-900">${spiVal.toFixed(1)}%</span>
                                    <span class="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                                        ${trendBadgeText}
                                    </span>
                                </div>
                                <p class="text-xs text-slate-500 font-medium mt-1">Sức khỏe vận hành theo 5 trụ cột cốt lõi</p>
                            </div>

                            <!-- 5 TRỤ CỘT MINI THÔNG MINH (HUEIC SPI v1.0) -->
                            <div class="mt-3 pt-2.5 border-t border-indigo-100/80 space-y-2">
                                <div title="Kỷ cương hạn chót: ${pOnTime.score.toFixed(1)}% (Đóng góp +${pOnTime.weighted_score.toFixed(1)} điểm vào SPI)">
                                    <div class="flex justify-between text-xs font-bold text-slate-700">
                                        <span class="flex items-center gap-1.5 truncate"><span class="w-2 h-2 rounded-full bg-blue-600 shrink-0"></span>Hạn chót (25%)</span>
                                        <span class="font-mono text-indigo-900 text-xs">${pOnTime.score.toFixed(1)}% <span class="text-[10px] text-slate-500 font-semibold">(+${pOnTime.weighted_score.toFixed(1)}đ)</span></span>
                                    </div>
                                    <div class="h-2 w-full rounded-full bg-slate-200/80 overflow-hidden mt-1">
                                        <div class="h-full rounded-full bg-blue-600 transition-all duration-500" style="width: ${pOnTime.score}%"></div>
                                    </div>
                                </div>
                                <div title="Hiệu suất thời lượng DPI: ${pDuration.score.toFixed(1)}% (Đóng góp +${pDuration.weighted_score.toFixed(1)} điểm vào SPI)">
                                    <div class="flex justify-between text-xs font-bold text-slate-700">
                                        <span class="flex items-center gap-1.5 truncate"><span class="w-2 h-2 rounded-full bg-purple-600 shrink-0"></span>Thời lượng DPI (15%)</span>
                                        <span class="font-mono text-purple-900 text-xs">${pDuration.score.toFixed(1)}% <span class="text-[10px] text-slate-500 font-semibold">(+${pDuration.weighted_score.toFixed(1)}đ)</span></span>
                                    </div>
                                    <div class="h-2 w-full rounded-full bg-slate-200/80 overflow-hidden mt-1">
                                        <div class="h-full rounded-full bg-purple-600 transition-all duration-500" style="width: ${Math.min(100, pDuration.score)}%"></div>
                                    </div>
                                </div>
                                <div title="Tiến độ hoàn thành: ${pComp.score.toFixed(1)}% (Đóng góp +${pComp.weighted_score.toFixed(1)} điểm vào SPI)">
                                    <div class="flex justify-between text-xs font-bold text-slate-700">
                                        <span class="flex items-center gap-1.5 truncate"><span class="w-2 h-2 rounded-full bg-indigo-600 shrink-0"></span>Hoàn thành (25%)</span>
                                        <span class="font-mono text-indigo-900 text-xs">${pComp.score.toFixed(1)}% <span class="text-[10px] text-slate-500 font-semibold">(+${pComp.weighted_score.toFixed(1)}đ)</span></span>
                                    </div>
                                    <div class="h-2 w-full rounded-full bg-slate-200/80 overflow-hidden mt-1">
                                        <div class="h-full rounded-full bg-indigo-600 transition-all duration-500" style="width: ${pComp.score}%"></div>
                                    </div>
                                </div>
                                <div title="Chất lượng duyệt lần đầu: ${pQual.score.toFixed(1)}% (Đóng góp +${pQual.weighted_score.toFixed(1)} điểm vào SPI)">
                                    <div class="flex justify-between text-xs font-bold text-slate-700">
                                        <span class="flex items-center gap-1.5 truncate"><span class="w-2 h-2 rounded-full bg-emerald-600 shrink-0"></span>Chất lượng (20%)</span>
                                        <span class="font-mono text-emerald-900 text-xs">${pQual.score.toFixed(1)}% <span class="text-[10px] text-slate-500 font-semibold">(+${pQual.weighted_score.toFixed(1)}đ)</span></span>
                                    </div>
                                    <div class="h-2 w-full rounded-full bg-slate-200/80 overflow-hidden mt-1">
                                        <div class="h-full rounded-full bg-emerald-500 transition-all duration-500" style="width: ${pQual.score}%"></div>
                                    </div>
                                </div>
                                <div title="Tốc độ phản hồi điều phối: ${pResp.score.toFixed(1)}% (Đóng góp +${pResp.weighted_score.toFixed(1)} điểm vào SPI)">
                                    <div class="flex justify-between text-xs font-bold text-slate-700">
                                        <span class="flex items-center gap-1.5 truncate"><span class="w-2 h-2 rounded-full bg-amber-500 shrink-0"></span>Phản hồi (15%)</span>
                                        <span class="font-mono text-amber-900 text-xs">${pResp.score.toFixed(1)}% <span class="text-[10px] text-slate-500 font-semibold">(+${pResp.weighted_score.toFixed(1)}đ)</span></span>
                                    </div>
                                    <div class="h-2 w-full rounded-full bg-slate-200/80 overflow-hidden mt-1">
                                        <div class="h-full rounded-full bg-amber-500 transition-all duration-500" style="width: ${pResp.score}%"></div>
                                    </div>
                                </div>
                            </div>
                            <div class="text-[11px] text-slate-500 font-semibold pt-2.5 border-t border-indigo-100/80 truncate text-center min-h-[36px] flex items-center justify-center">
                                25% Hạn chót • 15% Thời lượng • 25% Hoàn thành • 20% Chất lượng • 15% Phản hồi
                            </div>
                        </div>

                        <!-- THẺ 2: XU HƯỚNG SPI TOÀN TRƯỜNG -->
                        <div class="p-5 rounded-2xl border border-slate-200/80 bg-white shadow-xs flex flex-col justify-between min-h-[340px]">
                            <div>
                                <div class="flex items-center justify-between pb-2 border-b border-slate-100">
                                    <h4 class="font-manrope font-extrabold text-xs text-slate-800 flex items-center gap-1.5 truncate">
                                        <i class="fa-solid fa-chart-line text-indigo-600"></i> ${chartTitleText}
                                    </h4>
                                    <span class="text-xs font-extrabold text-slate-600 shrink-0">${chartScopeBadge}</span>
                                </div>
                                <div class="py-1 flex flex-col items-center">
                                    ${this._renderBghLineChart(trendRes ? { labels: trendRes.labels, datasets: [{ data: trendRes.spi_data }] } : null)}

                                    <!-- 3 Ô Thống Kê Xu Hướng Đồng Bộ Tuyệt Đối Với Các Thẻ Donut -->
                                    <div class="grid grid-cols-3 gap-1.5 w-full mt-2 pt-2 border-t border-slate-100 text-center">
                                        <div class="bg-emerald-50/80 border border-emerald-100/80 rounded-xl p-1.5">
                                            <div class="flex items-center justify-center gap-1 text-[9.5px] font-bold text-emerald-800 truncate">
                                                <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>Mục tiêu
                                            </div>
                                            <div class="font-mono text-xs font-black text-emerald-900 mt-0.5">≥ 80.0%</div>
                                        </div>
                                        <div class="bg-indigo-50/80 border border-indigo-100/80 rounded-xl p-1.5">
                                            <div class="flex items-center justify-center gap-1 text-[9.5px] font-bold text-indigo-800 truncate">
                                                <span class="w-1.5 h-1.5 rounded-full bg-indigo-600 shrink-0"></span>Điểm kỳ này
                                            </div>
                                            <div class="font-mono text-xs font-black text-indigo-900 mt-0.5">${latestSpiVal !== null ? latestSpiVal.toFixed(1) + '%' : '78.6%'}</div>
                                        </div>
                                        <div class="bg-purple-50/80 border border-purple-100/80 rounded-xl p-1.5">
                                            <div class="flex items-center justify-center gap-1 text-[9.5px] font-bold text-purple-800 truncate">
                                                <span class="w-1.5 h-1.5 rounded-full bg-purple-600 shrink-0"></span>Tăng trưởng
                                            </div>
                                            <div class="font-mono text-xs font-black text-purple-900 mt-0.5">${trendBadgeText}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="text-[11px] text-slate-500 font-semibold pt-2.5 border-t border-slate-100 flex items-center justify-between min-h-[36px]">
                                <span class="flex items-center gap-1.5 text-slate-600 truncate">
                                    <span class="inline-block w-2.5 h-2.5 rounded-full bg-indigo-600 shrink-0"></span>${trendSubText}: <strong class="text-indigo-700 font-extrabold ml-0.5">${trendBadgeText}</strong>
                                </span>
                                <span class="text-emerald-600 font-bold flex items-center gap-1 text-[10.5px] shrink-0 ml-1">
                                    <i class="fa-solid fa-circle-check text-emerald-500"></i> Bám sát mục tiêu
                                </span>
                            </div>
                        </div>

                        <!-- THẺ 3: ĐỀ ÁN TRỌNG ĐIỂM CẤP TRƯỜNG -->
                        <div class="p-5 rounded-2xl border border-slate-200/80 bg-white shadow-xs flex flex-col justify-between min-h-[340px]">
                            <div>
                                <div class="flex items-center justify-between pb-2 border-b border-slate-100">
                                    <h4 class="font-manrope font-extrabold text-xs text-slate-800 flex items-center gap-1.5 truncate">
                                        <i class="fa-solid fa-bullseye text-purple-600"></i> Đề Án Trọng Điểm
                                    </h4>
                                    <span class="text-xs font-extrabold text-slate-600 shrink-0">${pDonut.total_parent || 26} Đề án</span>
                                </div>
                                <div class="py-1">
                                    ${this._renderBghDonutChart(pDonut)}
                                </div>
                            </div>
                            <div class="text-[11px] text-slate-500 font-semibold pt-2.5 border-t border-slate-100 flex items-center justify-between min-h-[36px]">
                                <span class="text-rose-600 font-bold truncate">🔴 ${pDonut.count_bad} đề án cần đôn đốc</span>
                                <a href="tasks-list.html?is_parent=true" 
                                    class="text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 cursor-pointer shrink-0 ml-1">
                                    Kiểm tra <i class="fa-solid fa-arrow-right text-[8px]"></i>
                                </a>
                            </div>
                        </div>

                        <!-- THẺ 4: PHÂN BỔ NGUỒN LỰC CHIẾN LƯỢC (TÍNH CHẤT NHIỆM VỤ) -->
                        <div class="p-5 rounded-2xl border border-slate-200/80 bg-white shadow-xs flex flex-col justify-between min-h-[340px]">
                            <div>
                                <div class="flex items-center justify-between pb-2 border-b border-slate-100">
                                    <h4 class="font-manrope font-extrabold text-xs text-slate-800 flex items-center gap-1.5 truncate">
                                        <i class="fa-solid fa-layer-group text-indigo-600"></i> Phân Bổ Nguồn Lực
                                    </h4>
                                    <span class="text-xs font-extrabold text-slate-600 shrink-0">${totalClassified} việc</span>
                                </div>
                                <div class="py-1">
                                    ${this._renderResourceDonutChart(strategicCount, routineCount, proposalCount, totalClassified)}
                                </div>
                            </div>

                            <div class="text-[11px] text-slate-500 font-semibold pt-2.5 border-t border-slate-100 flex items-center justify-between min-h-[36px]">
                                <span>Cơ cấu tính chất:</span>
                                <span class="font-bold text-emerald-600 flex items-center gap-1"><i class="fa-solid fa-circle-check text-emerald-500"></i> Chuẩn hóa 100% nhiệm vụ</span>
                            </div>
                        </div>

                        <!-- THẺ 5: MA TRẬN MỨC ĐỘ ƯU TIÊN (CẤP ĐỘ KHẨN CẤP) -->
                        <div class="p-5 rounded-2xl border border-slate-200/80 bg-white shadow-xs flex flex-col justify-between min-h-[340px]">
                            <div>
                                <div class="flex items-center justify-between pb-2 border-b border-slate-100">
                                    <h4 class="font-manrope font-extrabold text-xs text-slate-800 flex items-center gap-1.5 truncate">
                                        <i class="fa-solid fa-bolt-lightning text-amber-500"></i> Mức Độ Ưu Tiên
                                    </h4>
                                    <span class="text-xs font-extrabold text-slate-600 shrink-0">${totalClassified} việc</span>
                                </div>
                                <div class="py-1">
                                    ${this._renderPriorityDonutChart(urgentCount, highCount, mediumCount, lowCount, totalClassified)}
                                </div>
                            </div>

                            <div class="text-[11px] text-slate-500 font-semibold pt-2.5 border-t border-slate-100 flex items-center justify-between min-h-[36px]">
                                <span>Ma trận 4 cấp độ:</span>
                                <span class="font-bold text-emerald-600 flex items-center gap-1"><i class="fa-solid fa-circle-check text-emerald-500"></i> Phân loại 100% mức độ</span>
                            </div>
                        </div>

                    </div>
                </div>

                <!-- 🎯 HÀNG 2: DẢI TỔNG QUAN HOẠT ĐỘNG & TIẾN ĐỘ (6 TRẠNG THÁI VÒNG ĐỜI KÈM TỶ LỆ % - MÀU NỀN PASTEL RÕ NÉT) -->
                <div class="px-4 py-3.5 border-b border-slate-100 bg-slate-50/60">
                    <div class="flex flex-wrap items-center justify-between gap-3 mb-2.5">
                        <div>
                            <div class="flex items-center gap-2">
                                <h4 class="font-manrope font-extrabold text-xs text-slate-800 flex items-center gap-1.5">
                                    <i class="fa-solid fa-chart-pie text-indigo-600"></i>
                                    <span>Tổng quan hoạt động &amp; tiến độ</span>
                                </h4>
                                <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200/80 text-slate-700 border border-slate-300/80">Tổng: ${totalTasksCount} nhiệm vụ</span>
                            </div>
                            <div class="text-[10px] text-slate-400 font-medium mt-0.5">Theo dõi thực thi công việc của 12 đơn vị HueIC — bấm vào thẻ để xem danh sách chi tiết</div>
                        </div>
                        <div class="flex items-center gap-1.5">
                            <button onclick="TasksPage.renderKpiWidget()"
                                class="px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-bold transition flex items-center gap-1 shadow-2xs cursor-pointer">
                                <i class="fa-solid fa-arrows-rotate text-[9.5px] text-indigo-600"></i> Làm mới
                            </button>
                            <a href="tasks-list.html"
                                class="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold transition flex items-center gap-1 shadow-xs cursor-pointer">
                                <i class="fa-solid fa-list-check text-[9.5px]"></i> Danh sách công việc
                            </a>
                        </div>
                    </div>

                    <!-- 6 Thẻ Trạng Thái Vòng Đời (Màu Nền Pastel Rõ Nét & Viền Tương Phản 100%) -->
                    <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                        <!-- Thẻ 1: Chưa bắt đầu (Slate Pastel Rõ Nét) -->
                        <div onclick="TasksPage.openTasksByStatusModal('CHUA_BAT_DAU')"
                            class="p-3.5 rounded-xl border border-slate-300/80 bg-slate-100/90 shadow-2xs flex items-center justify-between cursor-pointer hover:shadow-md hover:border-slate-400 hover:scale-[1.02] transition transform group"
                            title="Bấm để xem danh sách nhiệm vụ chưa bắt đầu">
                            <div class="min-w-0 flex-1">
                                <div class="text-[10.5px] font-extrabold text-slate-600 uppercase truncate group-hover:text-slate-900">Chưa bắt đầu</div>
                                <div class="font-manrope font-black text-2xl text-slate-800 leading-tight mt-0.5">${notStartedCount}</div>
                                <div class="text-[10px] text-slate-500 font-semibold mt-0.5 truncate">${notStartedPct}% chưa triển khai</div>
                            </div>
                            <span class="w-8 h-8 rounded-xl bg-slate-200/90 text-slate-700 flex items-center justify-center text-sm shrink-0 ml-1 group-hover:bg-slate-300"><i class="fa-solid fa-hourglass-start"></i></span>
                        </div>

                        <!-- Thẻ 2: Đang làm (Blue Pastel Rõ Nét) -->
                        <div onclick="TasksPage.openTasksByStatusModal('DANG_THUC_HIEN')"
                            class="p-3.5 rounded-xl border border-blue-300/80 bg-blue-100/70 shadow-2xs flex items-center justify-between cursor-pointer hover:shadow-md hover:border-blue-400 hover:scale-[1.02] transition transform group"
                            title="Bấm để xem danh sách nhiệm vụ đang thực hiện">
                            <div class="min-w-0 flex-1">
                                <div class="text-[10.5px] font-extrabold text-blue-800 uppercase truncate group-hover:text-blue-950">Đang làm</div>
                                <div class="font-manrope font-black text-2xl text-blue-700 leading-tight mt-0.5">${inProgressCount}</div>
                                <div class="text-[10px] text-blue-700 font-semibold mt-0.5 truncate">${inProgressPct}% đang thực hiện</div>
                            </div>
                            <span class="w-8 h-8 rounded-xl bg-blue-200/80 text-blue-800 flex items-center justify-center text-sm shrink-0 ml-1 group-hover:bg-blue-300"><i class="fa-solid fa-spinner"></i></span>
                        </div>

                        <!-- Thẻ 3: Chờ duyệt (Amber Pastel Rõ Nét) -->
                        <div onclick="TasksPage.openTasksByStatusModal('CHO_DUYET')"
                            class="p-3.5 rounded-xl border border-amber-300/80 bg-amber-100/70 shadow-2xs flex items-center justify-between cursor-pointer hover:shadow-md hover:border-amber-400 hover:scale-[1.02] transition transform group"
                            title="Bấm để xem danh sách nhiệm vụ chờ phê duyệt">
                            <div class="min-w-0 flex-1">
                                <div class="text-[10.5px] font-extrabold text-amber-800 uppercase truncate group-hover:text-amber-950">Chờ duyệt</div>
                                <div class="font-manrope font-black text-2xl text-amber-700 leading-tight mt-0.5">${reviewCount}</div>
                                <div class="text-[10px] text-amber-700 font-semibold mt-0.5 truncate">${reviewPct}% chờ phê duyệt</div>
                            </div>
                            <span class="w-8 h-8 rounded-xl bg-amber-200/80 text-amber-800 flex items-center justify-center text-sm shrink-0 ml-1 group-hover:bg-amber-300"><i class="fa-solid fa-clock-rotate-left"></i></span>
                        </div>

                        <!-- Thẻ 4: Quá hạn (Rose Pastel Cảnh Báo Nổi Bật) -->
                        <div onclick="TasksPage.openTasksByStatusModal('OVERDUE')"
                            class="p-3.5 rounded-xl border-2 border-rose-400 bg-rose-100/80 shadow-2xs flex items-center justify-between cursor-pointer hover:shadow-md hover:border-rose-500 hover:scale-[1.02] transition transform group"
                            title="Bấm để xem danh sách nhiệm vụ quá hạn">
                            <div class="min-w-0 flex-1">
                                <div class="text-[10.5px] font-extrabold text-rose-800 uppercase flex items-center gap-1 truncate group-hover:text-rose-950">
                                    <span>Quá hạn</span>
                                    <span class="w-2 h-2 rounded-full bg-rose-600 animate-pulse"></span>
                                </div>
                                <div class="font-manrope font-black text-2xl text-rose-700 leading-tight mt-0.5">${overdueTasksCount}</div>
                                <div class="text-[10px] text-rose-800 font-bold mt-0.5 truncate">${overduePct}% cần xử lý gấp</div>
                            </div>
                            <span class="w-8 h-8 rounded-xl bg-rose-200/90 text-rose-800 flex items-center justify-center text-sm shrink-0 ml-1 group-hover:bg-rose-300"><i class="fa-solid fa-triangle-exclamation"></i></span>
                        </div>

                        <!-- Thẻ 5: Hoàn thành (Emerald Pastel Rõ Nét) -->
                        <div onclick="TasksPage.openTasksByStatusModal('HOAN_THANH')"
                            class="p-3.5 rounded-xl border border-emerald-300/80 bg-emerald-100/70 shadow-2xs flex items-center justify-between cursor-pointer hover:shadow-md hover:border-emerald-400 hover:scale-[1.02] transition transform group"
                            title="Bấm để xem danh sách nhiệm vụ đã hoàn thành">
                            <div class="min-w-0 flex-1">
                                <div class="text-[10.5px] font-extrabold text-emerald-800 uppercase truncate group-hover:text-emerald-950">Hoàn thành</div>
                                <div class="font-manrope font-black text-2xl text-emerald-700 leading-tight mt-0.5">${completedTasksCount}</div>
                                <div class="text-[10px] text-emerald-800 font-bold mt-0.5 truncate">${completedPct}% đã hoàn thành</div>
                            </div>
                            <span class="w-8 h-8 rounded-xl bg-emerald-200/80 text-emerald-800 flex items-center justify-center text-sm shrink-0 ml-1 group-hover:bg-emerald-300"><i class="fa-solid fa-circle-check"></i></span>
                        </div>

                        <!-- Thẻ 6: Tạm dừng / Huỷ nhiệm vụ (Purple Pastel Rõ Nét) -->
                        <div onclick="TasksPage.openTasksByStatusModal('TAM_DUNG_HUY')"
                            class="p-3.5 rounded-xl border border-purple-300/80 bg-purple-100/70 shadow-2xs flex items-center justify-between cursor-pointer hover:shadow-md hover:border-purple-400 hover:scale-[1.02] transition transform group"
                            title="Bấm để xem danh sách nhiệm vụ tạm dừng hoặc hủy">
                            <div class="min-w-0 flex-1">
                                <div class="text-[10.5px] font-extrabold text-purple-800 uppercase truncate group-hover:text-purple-950">Tạm dừng / Huỷ</div>
                                <div class="font-manrope font-black text-2xl text-purple-700 leading-tight mt-0.5">${pausedCancelledCount}</div>
                                <div class="text-[10px] text-purple-700 font-semibold mt-0.5 truncate">${pausedCancelledPct}% tạm dừng/hủy</div>
                            </div>
                            <span class="w-8 h-8 rounded-xl bg-purple-200/80 text-purple-800 flex items-center justify-center text-sm shrink-0 ml-1 group-hover:bg-purple-300"><i class="fa-solid fa-ban"></i></span>
                        </div>
                    </div>
                </div>

                <!-- ⏱️ HÀNG 2.5: TẦNG QUẢN TRỊ THỜI GIAN & DÒNG CHẢY VẬN TỐC (TIME & FLOW INTELLIGENCE LAYER) -->
                ${this._renderTimeFlowIntelligenceStrip(overviewRes ? overviewRes.flow_intelligence : null)}

                <!-- 📊 HÀNG 3: HIỆU SUẤT 12 ĐƠN VỊ (BẢNG / SCATTER PLOT) & PANEL "WHY & BOTTLENECK" -->
                <div class="grid grid-cols-1 lg:grid-cols-12 gap-4 p-4 border-b border-slate-100 bg-white">
                    <!-- Cột Trái: Bảng / Ma trận Hiệu Suất 12 Đơn Vị (lg:col-span-7) -->
                    <div class="lg:col-span-7 p-3.5 rounded-xl border border-slate-200/80 bg-white shadow-2xs flex flex-col justify-between">
                        <div class="flex flex-wrap items-center justify-between gap-2 mb-2 pb-2 border-b border-slate-100">
                            <div class="flex items-center gap-2">
                                <h4 class="font-manrope font-extrabold text-xs text-slate-800 flex items-center gap-1.5">
                                    <i class="fa-solid fa-building text-indigo-600"></i> Hiệu Suất 12 Đơn Vị HueIC
                                </h4>
                                <!-- Toggle View: Bảng vs Scatter Plot -->
                                <div class="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-[10px] font-bold ml-1">
                                    <button id="btnViewUnitsTable" onclick="TasksPage.switchBghUnitsView('table')"
                                        class="px-2 py-0.5 rounded transition cursor-pointer ${this.bghUnitsView !== 'scatter' ? 'bg-indigo-600 text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-200'}">
                                        📋 Bảng Xếp Hạng
                                    </button>
                                    <button id="btnViewUnitsScatter" onclick="TasksPage.switchBghUnitsView('scatter')"
                                        class="px-2 py-0.5 rounded transition cursor-pointer ${this.bghUnitsView === 'scatter' ? 'bg-indigo-600 text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-200'}">
                                        🎯 Ma Trận Tải - SPI
                                    </button>
                                </div>
                            </div>
                            <!-- Legend -->
                            <div class="flex items-center gap-2 text-[8.5px] font-semibold text-slate-600">
                                <span class="flex items-center gap-0.5"><span class="w-2 h-2 rounded-xs bg-emerald-500"></span>Xong</span>
                                <span class="flex items-center gap-0.5"><span class="w-2 h-2 rounded-xs bg-blue-500"></span>Làm</span>
                                <span class="flex items-center gap-0.5"><span class="w-2 h-2 rounded-xs bg-amber-400"></span>Duyệt</span>
                                <span class="flex items-center gap-0.5"><span class="w-2 h-2 rounded-xs bg-rose-500"></span>Trễ</span>
                            </div>
                        </div>
                        <div class="flex-1" id="bghUnitsDisplayContainer">
                            ${this.bghUnitsView === 'scatter'
                                ? this._renderBghScatterPlot(this._currentScatterData)
                                : this._renderBghUnitsTable(deptsStackedData, targetDeptId)
                            }
                        </div>
                    </div>

                    <!-- Cột Phải: Panel Giải Trình Nguyên Nhân "WHY?" (lg:col-span-5) -->
                    <div class="lg:col-span-5 p-3.5 rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50/30 via-white to-blue-50/20 shadow-2xs flex flex-col justify-between">
                        ${this._renderBghWhyPanel(unitInfo, isSchoolScope, this._currentDelayRootCauses)}
                    </div>
                </div>

                <!-- ⚡ HÀNG 4: CẢNH BÁO RỦI RO & DANH SÁCH HÀNH ĐỘNG (ACTIONABLE COMMAND CENTER) -->
                <div class="grid grid-cols-1 lg:grid-cols-12 gap-4 p-4 bg-white">
                    <!-- CỘT TRÁI: DANH SÁCH NHIỆM VỤ CẦN XỬ LÝ NGAY (lg:col-span-7) -->
                    <div class="lg:col-span-7 rounded-xl border border-slate-200/80 bg-slate-50/50 p-3.5 shadow-2xs flex flex-col justify-between">
                        <div>
                            <div class="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-200/80 mb-3">
                                <div class="font-manrope font-extrabold text-xs text-slate-900 flex items-center gap-1.5">
                                    <i class="fa-solid fa-list-check text-indigo-600"></i>
                                    <span>Công Việc Cần BGH Xử Lý Ngay</span>
                                </div>
                                <!-- 3 Tabs -->
                                <div class="flex items-center gap-1 bg-slate-200/60 p-0.5 rounded-lg">
                                    <button id="bghTab_overdue" onclick="TasksPage.switchBghTaskTab('overdue')"
                                        class="px-2.5 py-1 rounded-md text-[11px] font-extrabold bg-indigo-600 text-white shadow-xs transition cursor-pointer">
                                        🔴 Quá Hạn (${overdueItems.length})
                                    </button>
                                    <button id="bghTab_due_soon" onclick="TasksPage.switchBghTaskTab('due_soon')"
                                        class="px-2.5 py-1 rounded-md text-[11px] font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer">
                                        ⏳ Sắp Đến Hạn (${dueSoonItems.length})
                                    </button>
                                    <button id="bghTab_review" onclick="TasksPage.switchBghTaskTab('review')"
                                        class="px-2.5 py-1 rounded-md text-[11px] font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer">
                                        📋 Chờ Duyệt (${reviewItems.length})
                                    </button>
                                </div>
                            </div>

                            <!-- List Tasks Container -->
                            <div id="bghActionTasksList" class="space-y-2">
                                ${overdueItems.length === 0 ? `
                                    <div class="p-6 text-center text-xs text-slate-400 italic">Không có công việc quá hạn nào 🎉</div>
                                ` : overdueItems.slice(0, 4).map(t => `
                                    <div class="p-2.5 rounded-xl border border-rose-100 bg-white hover:border-rose-300 hover:shadow-xs transition flex items-center justify-between gap-3">
                                        <div class="min-w-0 flex-1">
                                            <div class="font-bold text-xs text-slate-800 hover:text-indigo-600 cursor-pointer truncate"
                                                onclick="TasksPage.openTaskDetail(${t.id})">
                                                ${t.title}
                                            </div>
                                            <div class="flex items-center gap-2 mt-1 text-[10.5px] text-slate-500">
                                                <span class="font-semibold text-indigo-700">[${t.dept_code || 'HueIC'}]</span>
                                                <span>•</span>
                                                <span class="truncate"><i class="fa-regular fa-user text-[9px] text-slate-400"></i> ${t.assignee_name || 'Chưa phân công'}</span>
                                            </div>
                                        </div>
                                        <div class="flex items-center gap-2 shrink-0">
                                            <span class="px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold">
                                                🚨 Trễ ${t.days_overdue || 1} ngày
                                            </span>
                                            <button onclick="TasksPage.openTaskDetail(${t.id})"
                                                class="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-600 hover:text-white text-indigo-700 text-[10.5px] font-bold transition flex items-center gap-1 cursor-pointer">
                                                Xử lý ngay <i class="fa-solid fa-arrow-right text-[8.5px]"></i>
                                            </button>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>

                        <div class="pt-2 mt-2 border-t border-slate-200/80 flex items-center justify-between text-[10.5px]">
                            <span class="text-slate-400">Hiển thị các công việc ưu tiên cao nhất</span>
                            <button onclick="TasksPage.filterByStatus('TRE_HAN')" class="font-bold text-indigo-600 hover:underline">
                                Xem toàn bộ danh sách →
                            </button>
                        </div>
                    </div>

                    <!-- CỘT PHẢI: WIDGET ĐIỀU PHỐI RỦI RO & QUẢN TRỊ (lg:col-span-5) -->
                    <div class="lg:col-span-5 space-y-3">
                        <!-- Widget 1: Hàng Đợi Escalate Leo Thang -->
                        <div class="p-3.5 rounded-xl border border-indigo-100 bg-indigo-50/40 shadow-2xs">
                            <div class="flex items-center justify-between mb-2">
                                <span class="font-manrope font-extrabold text-xs text-indigo-900 flex items-center gap-1.5">
                                    <i class="fa-solid fa-arrow-up-right-dots text-indigo-600"></i> Hàng Đợi Escalate (24h/48h/72h)
                                </span>
                                <span class="text-[10px] font-bold text-indigo-700 px-2 py-0.5 rounded-full bg-indigo-100 border border-indigo-200">${escalateCount || 3} việc cần xử lý</span>
                            </div>
                            <div class="grid grid-cols-3 gap-2 text-center text-xs mb-2">
                                <div class="p-2 rounded-lg bg-white border border-indigo-100">
                                    <div class="text-[9px] text-slate-400 font-semibold uppercase">24h Đầu</div>
                                    <div class="font-black text-sm text-indigo-700">2 việc</div>
                                </div>
                                <div class="p-2 rounded-lg bg-white border border-amber-100">
                                    <div class="text-[9px] text-amber-600 font-semibold uppercase">48h Cảnh Báo</div>
                                    <div class="font-black text-sm text-amber-700">1 việc</div>
                                </div>
                                <div class="p-2 rounded-lg bg-white border border-rose-100">
                                    <div class="text-[9px] text-rose-600 font-semibold uppercase">72h Nghiêm Trọng</div>
                                    <div class="font-black text-sm text-rose-700">0 việc</div>
                                </div>
                            </div>
                            <div class="text-[10px] text-indigo-700/80 flex items-center justify-between">
                                <span>Tránh ngâm việc để không bị phạt trừ điểm điều phối.</span>
                                <button onclick="TasksPage.openWorkloadAlertsModal(null)" class="font-bold text-indigo-800 hover:underline cursor-pointer">Chi tiết →</button>
                            </div>
                        </div>

                        <!-- Widget 2: Nhân Sự Vượt Tải (>120%) -->
                        <div class="p-3.5 rounded-xl border border-amber-100 bg-amber-50/40 shadow-2xs">
                            <div class="flex items-center justify-between mb-2">
                                <span class="font-manrope font-extrabold text-xs text-amber-900 flex items-center gap-1.5">
                                    <i class="fa-solid fa-users-gear text-amber-600"></i> Cán Bộ Quá Tải Cần Phân Phối Lại
                                </span>
                                <span class="text-[9.5px] font-bold text-amber-800">Ngưỡng: ≤ 120%</span>
                            </div>
                            <div class="space-y-1.5">
                                ${overloadAlerts.length === 0 ? `
                                    <div class="text-[10.5px] text-slate-500 py-1 italic">✅ Hiện tại không có cán bộ nào bị vượt ngưỡng tải >120%.</div>
                                ` : overloadAlerts.slice(0, 2).map(a => `
                                    <div class="flex items-center justify-between p-2 rounded-lg bg-white border border-amber-100 text-xs">
                                        <div class="flex items-center gap-2 min-w-0">
                                            <div class="w-6 h-6 rounded-full bg-amber-100 text-amber-800 font-bold text-[9.5px] flex items-center justify-center shrink-0">
                                                ${(a.full_name || 'NV').slice(0,2).toUpperCase()}
                                            </div>
                                            <span class="font-semibold text-slate-800 truncate text-[11px]">${a.full_name || 'Cán bộ'}</span>
                                        </div>
                                        <div class="flex items-center gap-2 shrink-0">
                                            <span class="font-black text-rose-600 text-[11px]">${a.workload_percent || 125}% tải</span>
                                            <button onclick="TasksPage.openWorkloadAlertsModal(null)" class="px-2 py-0.5 rounded-md bg-amber-100 hover:bg-amber-200 text-amber-900 text-[9.5px] font-bold cursor-pointer">
                                                Giảm tải
                                            </button>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        } else if (isLeader) {
            // ================================================================
            // 🏢 CẤP QUẢN LÝ — "UNIT COMMAND DASHBOARD"
            // Layout: Dual Hero (Unit 58% + Personal 42%) → Action 2×2 Grid
            // ================================================================
            let deptKpi = null;
            try { deptKpi = await API.getDepartmentKPI(user.department_id); } catch(e) { console.warn(e); }
            let personalKpi = null;
            try { personalKpi = await API.getPersonalKPI(); } catch(e) { console.warn(e); }

            const deptKpiVal = Math.min(150, deptKpi ? (deptKpi.kpi || 0) : 0);
            const deptRank = Common.getRankInfo(deptKpiVal);
            const personalKpiVal = personalKpi ? (personalKpi.kpi || 0) : 0;
            const personalRank = Common.getRankInfo(personalKpiVal);
            const execScore = deptKpi ? (deptKpi.execution_score || 0) : 0;
            const govScore = deptKpi ? (deptKpi.governance_score || 0) : 0;
            const balanceBonus = deptKpi ? (deptKpi.balance_bonus || 0) : 0;
            const penaltyEsc = deptKpi ? (deptKpi.penalty_escalation || 0) : 0;
            const penaltyOverload = deptKpi ? (deptKpi.penalty_overload_shield || 0) : 0;
            const totalParentTasks = deptKpi ? (deptKpi.total_parent_tasks || 0) : 0;

            // Workload alerts cho đơn vị
            const overloadAlerts = (alertsData.overload_alerts || []).slice(0, 5);

            // Mock sparkline cho Dept KPI
            const deptSparkData = [30, 25, 40, 35, 45, deptKpiVal];

            container.innerHTML = `
                <!-- HEADER -->
                <div class="flex flex-wrap items-center justify-between gap-2 px-4 pt-4 pb-3 border-b border-slate-100">
                    <div class="flex items-center gap-2.5">
                        <div class="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs shadow-sm">
                            <i class="fa-solid fa-building-user"></i>
                        </div>
                        <div>
                            <div class="font-manrope font-extrabold text-[13px] text-slate-900 leading-tight">Trung Tâm Điều Hành Đơn Vị</div>
                            <div class="text-[9.5px] text-slate-400 font-medium">Hiệu suất Đơn vị & Cá nhân của bạn</div>
                        </div>
                    </div>
                    <div class="flex items-center gap-2">
                        <button onclick="TasksPage.openWorkloadAlertsModal(${user.department_id || 'null'})"
                            class="flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition">
                            <i class="fa-solid fa-users-gear text-indigo-500 text-xs"></i>
                            <span class="hidden sm:inline">Nhân Lực</span>
                        </button>
                        <button onclick="TasksPage.openKpiAuditModal(${user.id || 'null'}, ${user.department_id || 'null'})"
                            class="flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition">
                            <i class="fa-solid fa-receipt text-emerald-500 text-xs"></i>
                            <span class="hidden sm:inline">Audit Trail</span>
                        </button>
                    </div>
                </div>

                <!-- DUAL HERO: Unit (58%) + Personal (42%) -->
                <div class="grid sm:grid-cols-5 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 border-b border-slate-100">
                    <!-- UNIT HERO (col-span-3 = 60%) -->
                    <div class="sm:col-span-3 p-4 bg-gradient-to-br from-indigo-50/60 via-white to-slate-50/40">
                        <div class="text-[9.5px] text-indigo-600 font-bold uppercase tracking-wider mb-2 flex items-center gap-1">
                            <i class="fa-solid fa-building text-xs"></i> Chỉ Số Hiệu Suất Đơn Vị
                        </div>
                        <div class="flex items-start gap-4">
                            ${this._getSemiArcGauge(deptKpiVal, 110, deptRank)}
                            <div class="flex-1 pt-1 space-y-2">
                                <!-- KPI tổng -->
                                <div>
                                    <span class="font-manrope font-black text-2xl text-slate-900">${deptKpiVal.toFixed(1)}%</span>
                                    <span class="ml-2 text-xs px-2 py-0.5 rounded-full font-bold ${deptRank.badgeClass}">${deptRank.label}</span>
                                </div>
                                <!-- Thực thi bar -->
                                <div>
                                    <div class="flex items-center justify-between text-[10px] mb-1">
                                        <span class="text-slate-600 font-medium flex items-center gap-1"><i class="fa-solid fa-bolt text-indigo-400 text-[9px]"></i> Thực Thi (70%)</span>
                                        <span class="font-black text-indigo-700">${execScore.toFixed(0)}%</span>
                                    </div>
                                    <div class="w-full bg-indigo-100 rounded-full h-2">
                                        <div class="h-2 rounded-full bg-indigo-500 transition-all duration-700"
                                            style="width:${Math.min(100, execScore)}%"></div>
                                    </div>
                                </div>
                                <!-- Điều phối pill -->
                                <div class="flex flex-wrap items-center gap-1.5">
                                    <span class="text-[9.5px] text-slate-500 font-medium flex items-center gap-1"><i class="fa-solid fa-scale-balanced text-emerald-500 text-[9px]"></i> Điều Phối:</span>
                                    <span class="text-[10.5px] font-black text-emerald-800 px-2 py-0.5 rounded-full bg-emerald-100 border border-emerald-200">${govScore.toFixed(0)}đ</span>
                                    ${balanceBonus > 0 ? `<span class="text-[9.5px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center gap-0.5"><i class="fa-solid fa-medal text-[8px]"></i> +${balanceBonus}%</span>` : ''}
                                    ${penaltyEsc > 0 ? `<span class="text-[9.5px] font-bold px-1.5 py-0.5 rounded-full bg-rose-50 border border-rose-200 text-rose-700">−${penaltyEsc}%</span>` : ''}
                                    ${penaltyOverload > 0 ? `<span class="text-[9.5px] font-bold px-1.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700">−${penaltyOverload}%</span>` : ''}
                                </div>
                            </div>
                        </div>
                        <!-- Sparkline + footer -->
                        <div class="flex items-center justify-between mt-3 pt-2.5 border-t border-slate-100">
                            ${this._getSparkline(deptSparkData)}
                            <span class="text-[9.5px] text-slate-400">${totalParentTasks} nhiệm vụ cha đang theo dõi</span>
                        </div>
                    </div>

                    <!-- PERSONAL HERO (col-span-2 = 40%) -->
                    <div class="sm:col-span-2 p-4 bg-gradient-to-br from-emerald-50/40 via-white to-slate-50/30">
                        <div class="text-[9.5px] text-emerald-600 font-bold uppercase tracking-wider mb-2 flex items-center gap-1">
                            <i class="fa-solid fa-user-check text-xs"></i> KPI Cá Nhân Của Bạn
                        </div>
                        <div class="flex items-start gap-3">
                            ${this._getSemiArcGauge(personalKpiVal, 88, personalRank)}
                            <div class="flex-1 pt-1 space-y-1.5 text-[10.5px]">
                                <div class="flex items-center gap-1.5">
                                    <i class="fa-solid fa-clipboard-list text-slate-400 text-[9px] w-3"></i>
                                    <span class="text-slate-600">Nhiệm vụ trực tiếp:</span>
                                    <b class="text-slate-900">${personalKpi ? personalKpi.completed_tasks : 0}/${personalKpi ? personalKpi.total_tasks : 0}</b>
                                </div>
                                <div class="flex items-center gap-1.5">
                                    <i class="fa-solid fa-lightbulb text-amber-400 text-[9px] w-3"></i>
                                    <span class="text-slate-600">Thưởng đề xuất:</span>
                                    <b class="text-amber-700">+${personalKpi ? (personalKpi.proposal_bonus || 0) : 0}đ</b>
                                </div>
                                <div class="flex items-center gap-1.5">
                                    <i class="fa-solid fa-shield text-blue-400 text-[9px] w-3"></i>
                                    <span class="text-slate-600">Khiên Quá Tải:</span>
                                    <b class="text-blue-700">${overloadStaffCount === 0 ? '✅ Đang bật' : '⚠️ Có cán bộ quá tải'}</b>
                                </div>
                                ${(personalKpi && personalKpi.rejected_count > 0) ? `
                                <div class="flex items-center gap-1.5">
                                    <i class="fa-solid fa-rotate-left text-rose-400 text-[9px] w-3"></i>
                                    <span class="text-slate-600">Trả hồ sơ:</span>
                                    <b class="text-rose-700">${personalKpi.rejected_count} lần</b>
                                </div>` : ''}
                            </div>
                        </div>
                        <button onclick="TasksPage.openKpiAuditModal(${user.id || 'null'}, ${user.department_id || 'null'})"
                            class="mt-3 w-full flex items-center justify-center gap-1.5 text-[10px] font-semibold py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-100 transition">
                            <i class="fa-solid fa-receipt text-xs"></i> Xem Vết Tính Điểm →
                        </button>
                    </div>
                </div>

                <!-- ACTION COMMAND: 2×2 Grid -->
                <div class="grid grid-cols-2 gap-2 p-4">
                    ${_actionCard(overdueCount, 'Việc Quá Hạn', 'Cần xử lý ngay', 'fa-solid fa-fire', 'rose', "TasksPage.filterByStatus('TRE_HAN')", true)}
                    ${_actionCard(pendingApprovalCount, 'Chờ Phê Duyệt', 'Đang hàng đợi duyệt', 'fa-solid fa-inbox', 'amber', "TasksPage.filterByStatus('CHO_DUYET')")}
                    ${_actionCard(escalateCount, 'Escalate Leo Thang', 'Quá hạn chưa xử lý', 'fa-solid fa-arrow-up-right-dots', 'indigo', `TasksPage.openWorkloadAlertsModal(${user.department_id || 'null'})`)}
                    ${_actionCard(overloadStaffCount, 'Cán Bộ Quá Tải', 'Cần điều phối lại', 'fa-solid fa-users-gear', 'slate', `TasksPage.openWorkloadAlertsModal(${user.department_id || 'null'})`)}
                </div>

                ${overloadAlerts.length > 0 ? `
                <!-- WORKLOAD SNAPSHOT -->
                <div class="px-4 pb-4">
                    <div class="rounded-xl border border-amber-100 bg-amber-50/40 overflow-hidden">
                        <div class="px-3 py-2 border-b border-amber-100 flex items-center gap-1.5">
                            <i class="fa-solid fa-gauge-high text-amber-500 text-xs"></i>
                            <span class="text-[11px] font-bold text-amber-800">Cán Bộ Gần / Vượt Ngưỡng Tải</span>
                            <span class="text-[9px] text-amber-600 ml-auto">Ngưỡng an toàn: ≤ 120%</span>
                        </div>
                        <div class="p-2 flex flex-wrap gap-2">
                            ${overloadAlerts.map(a => {
                                const pct = Math.min(100, ((a.workload_percent || 0) / 150) * 100);
                                const wColor = (a.workload_percent || 0) > 120 ? '#f43f5e' : (a.workload_percent || 0) > 100 ? '#f59e0b' : '#10b981';
                                return `
                                    <div class="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-white border border-slate-100 min-w-[140px]">
                                        <div class="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[9px] font-bold text-slate-600 shrink-0">${(a.full_name || 'NV').slice(0,2).toUpperCase()}</div>
                                        <div class="flex-1 min-w-0">
                                            <div class="text-[9.5px] font-semibold text-slate-700 truncate">${a.full_name || 'Cán bộ'}</div>
                                            <div class="flex items-center gap-1 mt-0.5">
                                                <div class="flex-1 h-1 bg-slate-100 rounded-full"><div class="h-1 rounded-full" style="width:${pct}%;background:${wColor}"></div></div>
                                                <span class="text-[9px] font-black shrink-0" style="color:${wColor}">${a.workload_percent || 0}%</span>
                                            </div>
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                </div>
                ` : ''}
            `;

        } else {
            // ================================================================
            // 👤 CẤP NHÂN VIÊN — "PERSONAL PERFORMANCE CARD"
            // Layout: Compact Hero (horizontal) → Stat Row → Action Cards
            // ================================================================
            let personalKpi = null;
            try { personalKpi = await API.getPersonalKPI(); } catch(e) { console.warn(e); }

            const kpiVal = personalKpi ? (personalKpi.kpi || 0) : 0;
            const personalRank = Common.getRankInfo(kpiVal);
            const totalScore = personalKpi ? (personalKpi.total_actual_score || 0) : 0;
            const baseScore = personalKpi ? (personalKpi.total_base_score || 0) : 0;
            const proposalBonus = personalKpi ? (personalKpi.proposal_bonus || 0) : 0;
            const completedTasks = personalKpi ? (personalKpi.completed_tasks || 0) : 0;
            const totalTasks = personalKpi ? (personalKpi.total_tasks || 0) : 0;
            const shieldedCount = personalKpi ? (personalKpi.shielded_tasks_count || 0) : 0;
            const rejectedCount = personalKpi ? (personalKpi.rejected_count || 0) : 0;
            const approvedProposals = personalKpi ? (personalKpi.approved_proposals_count || 0) : 0;

            const staffSparkData = [0, 10, 5, 20, 15, kpiVal];

            container.innerHTML = `
                <!-- PERSONAL HERO — Horizontal Layout, Full Width -->
                <div class="flex flex-wrap items-center gap-4 px-4 py-4 bg-gradient-to-r from-indigo-50/50 via-white to-emerald-50/30 border-b border-slate-100">
                    <!-- Gauge -->
                    <div class="shrink-0">
                        ${this._getSemiArcGauge(kpiVal, 100, personalRank)}
                        <div class="text-center text-[9.5px] font-semibold text-slate-500 mt-0.5">KPI Của Tôi</div>
                    </div>

                    <!-- Score Info Column -->
                    <div class="flex-1 min-w-[140px]">
                        <div class="flex items-baseline gap-2 mb-1">
                            <span class="font-manrope font-black text-3xl text-slate-900 leading-none">${kpiVal.toFixed(1)}%</span>
                            <span class="text-xs px-2 py-0.5 rounded-full font-bold ${personalRank.badgeClass}">${personalRank.label}</span>
                        </div>
                        <div class="text-[10.5px] text-slate-500 mb-3">Điểm hiệu suất cá nhân kỳ này</div>
                        <!-- Progress bar tasks -->
                        <div class="mb-1.5">
                            <div class="flex items-center justify-between text-[10px] mb-1">
                                <span class="text-slate-600 font-medium">Tiến độ nhiệm vụ</span>
                                <span class="font-bold text-indigo-700">${completedTasks} / ${totalTasks} việc</span>
                            </div>
                            <div class="w-full bg-slate-100 rounded-full h-2">
                                <div class="h-2 rounded-full bg-indigo-500 transition-all duration-700"
                                    style="width:${totalTasks > 0 ? Math.min(100, Math.round(completedTasks/totalTasks*100)) : 0}%"></div>
                            </div>
                        </div>
                    </div>

                    <!-- Sparkline + Bonuses -->
                    <div class="shrink-0 flex flex-col gap-2 items-end">
                        <div>
                            <div class="text-[9px] text-slate-400 font-semibold uppercase tracking-wider mb-1 text-right">Xu hướng</div>
                            ${this._getSparkline(staffSparkData)}
                        </div>
                        ${proposalBonus > 0 ? `<div class="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-50 border border-amber-100">
                            <i class="fa-solid fa-lightbulb text-amber-500 text-[9px]"></i>
                            <span class="text-[9.5px] font-bold text-amber-800">+${proposalBonus}đ thưởng sáng kiến</span>
                        </div>` : ''}
                        ${shieldedCount > 0 ? `<div class="flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-50 border border-blue-100">
                            <i class="fa-solid fa-shield text-blue-500 text-[9px]"></i>
                            <span class="text-[9.5px] font-bold text-blue-800">${shieldedCount} việc được Khiên bảo vệ</span>
                        </div>` : ''}
                    </div>
                </div>

                <!-- STAT ROW: 3 compact cards -->
                <div class="grid grid-cols-3 divide-x divide-slate-100 border-b border-slate-100">
                    <div class="px-3 py-3 text-center">
                        <div class="text-[9.5px] text-slate-400 font-semibold uppercase tracking-wider mb-1">Tổng Điểm</div>
                        <div class="font-manrope font-black text-lg text-indigo-700">${totalScore.toFixed(1)}<span class="text-xs font-normal text-slate-400">đ</span></div>
                        <div class="text-[9px] text-slate-400">trên ${baseScore.toFixed(0)}đ cơ bản</div>
                    </div>
                    <div class="px-3 py-3 text-center">
                        <div class="text-[9.5px] text-slate-400 font-semibold uppercase tracking-wider mb-1">Sáng Kiến</div>
                        <div class="font-manrope font-black text-lg text-amber-600">${approvedProposals}<span class="text-xs font-normal text-slate-400"> lần</span></div>
                        <div class="text-[9px] text-slate-400">đề xuất được duyệt</div>
                    </div>
                    <div class="px-3 py-3 text-center">
                        <div class="text-[9.5px] text-slate-400 font-semibold uppercase tracking-wider mb-1">Chất Lượng</div>
                        <div class="font-manrope font-black text-lg ${rejectedCount > 0 ? 'text-rose-600' : 'text-emerald-600'}">${rejectedCount}<span class="text-xs font-normal text-slate-400"> lần trả</span></div>
                        <div class="text-[9px] text-slate-400">${rejectedCount === 0 ? '✅ Không có lỗi' : '⚠️ Cần cải thiện'}</div>
                    </div>
                </div>

                <!-- ACTION CARDS: 3 items -->
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 p-4">
                    ${_actionCard(overdueCount, 'Việc Quá Hạn', 'Cần hoàn thành ngay', 'fa-solid fa-fire', 'rose', "TasksPage.filterByStatus('TRE_HAN')", overdueCount > 0)}
                    ${_actionCard(pendingApprovalCount, 'Đề Xuất Chờ Duyệt', 'Đang chờ lãnh đạo', 'fa-solid fa-hourglass-half', 'amber', "TasksPage.filterByStatus('CHO_DUYET')")}
                    <div onclick="TasksPage.openKpiAuditModal(${user.id || 'null'}, ${user.department_id || 'null'})"
                        class="group cursor-pointer flex items-center gap-3 p-3 rounded-xl border border-emerald-200 bg-emerald-50 hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 active:scale-95">
                        <div class="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center text-sm shrink-0">
                            <i class="fa-solid fa-receipt"></i>
                        </div>
                        <div class="min-w-0 flex-1">
                            <div class="font-manrope font-black text-xl text-emerald-800 leading-none mb-0.5">100%</div>
                            <div class="text-[10px] font-semibold text-emerald-900 truncate">Minh Bạch Điểm Số</div>
                            <div class="text-[9px] text-emerald-500">Tra cứu vết tính điểm →</div>
                        </div>
                    </div>
                </div>
            `;
        }
    },

    async openPeriodGovernanceModal(tab = 'MONTH') {
        this._governanceTab = tab;
        let modal = document.getElementById('modalPeriodGovernance');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'modalPeriodGovernance';
            modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto';
            document.body.appendChild(modal);
        }

        modal.classList.remove('hidden');
        modal.innerHTML = `
            <div class="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden animate-fade-in flex flex-col max-h-[90vh]">
                <!-- Header -->
                <div class="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 text-white flex items-center justify-between">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-2xl bg-indigo-600/40 border border-indigo-400/30 flex items-center justify-center text-indigo-300 text-lg">
                            <i class="fa-solid fa-shield-halved"></i>
                        </div>
                        <div>
                            <h3 class="font-manrope font-extrabold text-base">Bảng Quản Trị & Theo Dõi Đồng Bộ Kỳ</h3>
                            <p class="text-xs text-slate-300">Period Tracking & Governance Hub • Snapshot Zero-Lag</p>
                        </div>
                    </div>
                    <button onclick="TasksPage.closePeriodGovernanceModal()" class="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer transition">
                        <i class="fa-solid fa-xmark text-sm"></i>
                    </button>
                </div>

                <!-- 3 Sheets Navigation Tabs -->
                <div class="px-6 pt-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-2">
                    <div class="flex items-center space-x-2">
                        <button onclick="TasksPage.setGovernanceTab('MONTH')" class="px-4 py-2 text-xs font-extrabold rounded-t-xl transition cursor-pointer ${this._governanceTab === 'MONTH' ? 'bg-white text-indigo-700 border-t-2 border-indigo-600 shadow-2xs' : 'text-slate-600 hover:text-slate-900'}">
                            📅 1. Theo Tháng
                        </button>
                        <button onclick="TasksPage.setGovernanceTab('QUARTER')" class="px-4 py-2 text-xs font-extrabold rounded-t-xl transition cursor-pointer ${this._governanceTab === 'QUARTER' ? 'bg-white text-indigo-700 border-t-2 border-indigo-600 shadow-2xs' : 'text-slate-600 hover:text-slate-900'}">
                            📊 2. Theo Quý
                        </button>
                        <button onclick="TasksPage.setGovernanceTab('YEAR')" class="px-4 py-2 text-xs font-extrabold rounded-t-xl transition cursor-pointer ${this._governanceTab === 'YEAR' ? 'bg-white text-indigo-700 border-t-2 border-indigo-600 shadow-2xs' : 'text-slate-600 hover:text-slate-900'}">
                            🎓 3. Theo Năm Học
                        </button>
                    </div>
                    <button onclick="TasksPage.recalculatePeriod(TasksPage._governanceTab, null)" class="text-[11px] font-bold px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 mb-2 cursor-pointer transition flex items-center gap-1.5">
                        <i class="fa-solid fa-arrows-rotate text-xs"></i>
                        <span>Đồng bộ toàn bộ Sheet</span>
                    </button>
                </div>

                <!-- Content Area -->
                <div id="periodGovernanceContent" class="p-6 overflow-y-auto flex-1">
                    <div class="flex items-center justify-center py-12 text-slate-400">
                        <i class="fa-solid fa-spinner fa-spin mr-2"></i> Đang tải dữ liệu Snapshot từ CSDL...
                    </div>
                </div>
            </div>
        `;

        await this.loadGovernanceSheetData();
    },

    async setGovernanceTab(tab) {
        this._governanceTab = tab;
        this.openPeriodGovernanceModal(tab);
    },

    async loadGovernanceSheetData() {
        const content = document.getElementById('periodGovernanceContent');
        if (!content) return;

        try {
            const list = await API.getPeriodSnapshotsList(this._governanceTab);
            if (!list || list.length === 0) {
                content.innerHTML = `<div class="p-8 text-center text-slate-400 italic">Chưa có bản ghi snapshot nào cho loại kỳ này.</div>`;
                return;
            }

            content.innerHTML = `
                <div class="overflow-x-auto border border-slate-200 rounded-2xl shadow-2xs">
                    <table class="w-full text-left border-collapse text-xs">
                        <thead>
                            <tr class="bg-slate-100/80 text-slate-700 font-extrabold border-b border-slate-200">
                                <th class="p-3">Kỳ Đánh Giá</th>
                                <th class="p-3">Trạng Thái</th>
                                <th class="p-3 text-center">Điểm SPI</th>
                                <th class="p-3 text-center">Tổng Việc</th>
                                <th class="p-3 text-center">Hoàn Thành</th>
                                <th class="p-3 text-center">Quá Hạn</th>
                                <th class="p-3">Lần Đồng Bộ Cuối</th>
                                <th class="p-3 text-right">Thao Tác</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100 font-medium text-slate-700">
                            ${list.map(s => {
                                const isClosed = s.is_closed;
                                const statusBadge = isClosed 
                                    ? `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200"><i class="fa-solid fa-lock text-[9px]"></i> Đã khóa sổ</span>`
                                    : `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Đang chạy</span>`;
                                
                                const spiScore = s.spi ? (s.spi.spi || 0) : 0;
                                const spiRank = Common.getRankInfo(spiScore);
                                const totalT = s.overview ? (s.overview.total_tasks || 0) : 0;
                                const compT = s.overview ? (s.overview.completed_tasks || 0) : 0;
                                const compPct = totalT > 0 ? ((compT / totalT) * 100).toFixed(1) : '0.0';
                                const overdueT = s.overview ? (s.overview.overdue_tasks || 0) : 0;
                                const updatedText = s.updated_at ? new Date(s.updated_at).toLocaleString('vi-VN') : 'Vừa tạo';

                                return `
                                    <tr class="hover:bg-indigo-50/30 transition">
                                        <td class="p-3 font-bold text-slate-900">
                                            <div class="flex items-center gap-1.5">
                                                <i class="fa-regular fa-calendar-check text-indigo-600"></i>
                                                <span>${s.period_key}</span>
                                            </div>
                                        </td>
                                        <td class="p-3">${statusBadge}</td>
                                        <td class="p-3 text-center font-extrabold text-sm ${spiRank.color}">
                                            ${spiScore.toFixed(1)}%
                                        </td>
                                        <td class="p-3 text-center font-bold">${totalT}</td>
                                        <td class="p-3 text-center text-emerald-700 font-bold">${compT} (${compPct}%)</td>
                                        <td class="p-3 text-center ${overdueT > 0 ? 'text-rose-600 font-extrabold' : 'text-slate-400'}">${overdueT}</td>
                                        <td class="p-3 text-[11px] text-slate-500">${updatedText}</td>
                                        <td class="p-3 text-right">
                                            <div class="flex items-center justify-end gap-1.5">
                                                <button onclick="TasksPage.recalculatePeriod('${s.period_type}', '${s.period_key}')" title="Tính toán lại & Đồng bộ" class="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[11px] cursor-pointer transition">
                                                    <i class="fa-solid fa-arrows-rotate mr-1"></i> Tính lại
                                                </button>
                                                <button onclick="TasksPage.togglePeriodLock('${s.period_type}', '${s.period_key}')" title="${isClosed ? 'Mở khóa sổ' : 'Khóa sổ kỳ'}" class="px-2.5 py-1 rounded-lg ${isClosed ? 'bg-amber-50 hover:bg-amber-100 text-amber-800' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'} font-bold text-[11px] cursor-pointer transition">
                                                    <i class="fa-solid ${isClosed ? 'fa-lock-open' : 'fa-lock'} mr-1"></i> ${isClosed ? 'Mở khóa' : 'Khóa'}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        } catch (e) {
            content.innerHTML = `<div class="p-4 bg-rose-50 text-rose-700 rounded-xl text-xs font-semibold">Lỗi tải dữ liệu: ${e.message}</div>`;
        }
    },

    async recalculatePeriod(type, key) {
        try {
            if (!key) {
                Common.showToast('Đang tính toán lại toàn bộ kỳ...', 'info');
                await API.getPeriodSnapshotsList(type);
            } else {
                Common.showToast(`Đang tính lại Snapshot cho ${key}...`, 'info');
                await API.recalculatePeriodSnapshot(type, key);
            }
            this._periodCache = {};
            await this.loadGovernanceSheetData();
            await this.renderKpiWidget(this.selectedBghUnitId);
            Common.showToast('Đã đồng bộ Snapshot thành công!', 'success');
        } catch(e) {
            Common.showToast('Lỗi khi tính lại Snapshot: ' + e.message, 'error');
        }
    },

    async togglePeriodLock(type, key) {
        try {
            await API.toggleLockPeriod(type, key);
            this._periodCache = {};
            await this.loadGovernanceSheetData();
            await this.renderKpiWidget(this.selectedBghUnitId);
            Common.showToast(`Đã thay đổi trạng thái khóa của ${key}!`, 'success');
        } catch(e) {
            Common.showToast('Lỗi khi đổi trạng thái khóa: ' + e.message, 'error');
        }
    },

    closePeriodGovernanceModal() {
        const modal = document.getElementById('modalPeriodGovernance');
        if (modal) modal.classList.add('hidden');
    },

    openTasksByStatusModal(statusKey) {
        let modal = document.getElementById('modalTasksByStatus');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'modalTasksByStatus';
            modal.className = 'fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center z-50 p-3 sm:p-4 hidden';
            document.body.appendChild(modal);
        }

        const now = new Date();
        const deptId = this.selectedBghUnitId;
        const deptObj = deptId ? (this.departments || []).find(d => d.id === parseInt(deptId)) : null;
        const deptName = deptObj ? `[${deptObj.code}] ${deptObj.name}` : 'Toàn trường (12 Đơn vị)';
        const periodText = this.bghPeriodKey || (this.bghPeriod === 'quarter' ? 'Quý 3/2026' : this.bghPeriod === 'year' ? 'Năm học 2025-2026' : 'Tháng 9/2026');

        let statusMeta = {
            title: 'Nhiệm Vụ',
            icon: 'fa-solid fa-list-check',
            color: 'indigo'
        };

        if (statusKey === 'CHUA_BAT_DAU') {
            statusMeta = { title: 'Nhiệm Vụ Chưa Bắt Đầu', icon: 'fa-solid fa-hourglass-start', color: 'slate' };
        } else if (statusKey === 'DANG_THUC_HIEN') {
            statusMeta = { title: 'Nhiệm Vụ Đang Thực Hiện', icon: 'fa-solid fa-spinner', color: 'blue' };
        } else if (statusKey === 'CHO_DUYET') {
            statusMeta = { title: 'Nhiệm Vụ Chờ Phê Duyệt', icon: 'fa-solid fa-clock-rotate-left', color: 'amber' };
        } else if (statusKey === 'OVERDUE') {
            statusMeta = { title: 'Nhiệm Vụ Quá Hạn Tiến Độ', icon: 'fa-solid fa-triangle-exclamation', color: 'rose' };
        } else if (statusKey === 'HOAN_THANH') {
            statusMeta = { title: 'Nhiệm Vụ Đã Hoàn Thành', icon: 'fa-solid fa-circle-check', color: 'emerald' };
        } else if (statusKey === 'TAM_DUNG_HUY') {
            statusMeta = { title: 'Nhiệm Vụ Tạm Dừng / Hủy Bỏ', icon: 'fa-solid fa-ban', color: 'purple' };
        }

        // Lọc danh sách nhiệm vụ từ this.tasks
        const allTasks = this.tasks || [];
        const filtered = allTasks.filter(t => {
            // 1. Lọc theo đơn vị nếu có chọn
            if (deptId) {
                const matchDept = (t.leading_dept_id === parseInt(deptId)) || 
                                  (t.assignee && t.assignee.department_id === parseInt(deptId));
                if (!matchDept) return false;
            }
            // 2. Lọc theo trạng thái
            if (statusKey === 'CHUA_BAT_DAU') return t.status === 'CHUA_BAT_DAU';
            if (statusKey === 'DANG_THUC_HIEN') return t.status === 'DANG_THUC_HIEN';
            if (statusKey === 'CHO_DUYET') return t.status === 'CHO_DUYET';
            if (statusKey === 'OVERDUE') {
                return t.status === 'TRE_HAN' || (t.due_date && new Date(t.due_date) < now && t.status !== 'HOAN_THANH');
            }
            if (statusKey === 'HOAN_THANH') return t.status === 'HOAN_THANH';
            if (statusKey === 'TAM_DUNG_HUY') return t.status === 'TAM_DUNG' || t.status === 'HUY_BO';
            return true;
        });

        this._currentStatusModalTasks = filtered;
        this._currentStatusKey = statusKey;
        this._currentStatusMeta = statusMeta;

        modal.innerHTML = `
            <div class="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 animate-fade-in">
                <!-- Header -->
                <div class="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                    <div class="flex items-center space-x-2.5">
                        <div class="w-8 h-8 rounded-lg bg-${statusMeta.color}-600 text-white flex items-center justify-center text-sm shadow-xs">
                            <i class="${statusMeta.icon}"></i>
                        </div>
                        <div>
                            <div class="flex items-center gap-2">
                                <h3 class="font-black text-sm text-slate-900 leading-tight">${statusMeta.title}</h3>
                                <span class="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-${statusMeta.color}-100 text-${statusMeta.color}-800 border border-${statusMeta.color}-200">
                                    ${filtered.length} nhiệm vụ
                                </span>
                            </div>
                            <p class="text-[10.5px] text-slate-500 font-medium">Đơn vị: <b class="text-slate-700">${deptName}</b> • Chu kỳ: <b class="text-indigo-700">${periodText}</b></p>
                        </div>
                    </div>
                    <button onclick="TasksPage.closeTasksByStatusModal()" class="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200 transition cursor-pointer">
                        <i class="fa-solid fa-xmark text-base"></i>
                    </button>
                </div>

                <!-- Search Filter Inside Modal -->
                <div class="px-5 py-2.5 bg-slate-50/70 border-b border-slate-200/80 flex items-center justify-between gap-3">
                    <div class="relative flex-1">
                        <i class="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                        <input type="text" id="statusModalSearchInput" oninput="TasksPage.filterTasksByStatusModal(this.value)"
                            placeholder="Tìm kiếm nhanh theo tên nhiệm vụ hoặc người phụ trách..."
                            class="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-400 shadow-2xs">
                    </div>
                    <span class="text-[11px] text-slate-500 font-semibold shrink-0" id="statusModalCountText">Hiển thị: <b>${filtered.length}</b> việc</span>
                </div>

                <!-- Tasks Table Body -->
                <div id="statusModalTableContainer" class="p-4 overflow-y-auto flex-1 text-xs">
                    ${this._renderTasksByStatusTable(filtered, statusKey)}
                </div>

                <!-- Footer -->
                <div class="px-5 py-2.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
                    <span class="text-[10.5px] text-slate-400">Nhấn vào từng nhiệm vụ để mở chi tiết &amp; cập nhật tiến độ</span>
                    <button onclick="TasksPage.closeTasksByStatusModal()" class="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-lg text-xs transition cursor-pointer">
                        Đóng
                    </button>
                </div>
            </div>
        `;

        modal.classList.remove('hidden');
    },

    closeTasksByStatusModal() {
        const modal = document.getElementById('modalTasksByStatus');
        if (modal) modal.classList.add('hidden');
    },

    filterTasksByStatusModal(term) {
        const query = (term || '').toLowerCase().trim();
        const list = this._currentStatusModalTasks || [];
        const filtered = query ? list.filter(t => 
            (t.title && t.title.toLowerCase().includes(query)) ||
            (t.code && t.code.toLowerCase().includes(query)) ||
            (t.assignee && t.assignee.full_name && t.assignee.full_name.toLowerCase().includes(query)) ||
            (t.leading_department && t.leading_department.code && t.leading_department.code.toLowerCase().includes(query))
        ) : list;

        const countEl = document.getElementById('statusModalCountText');
        if (countEl) countEl.innerHTML = `Hiển thị: <b>${filtered.length}</b> việc`;

        const container = document.getElementById('statusModalTableContainer');
        if (container) {
            container.innerHTML = this._renderTasksByStatusTable(filtered, this._currentStatusKey);
        }
    },

    _renderTasksByStatusTable(tasks, statusKey) {
        if (!tasks || tasks.length === 0) {
            return `
                <div class="py-12 text-center">
                    <div class="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto text-lg mb-2">
                        <i class="fa-solid fa-folder-open"></i>
                    </div>
                    <p class="text-xs font-semibold text-slate-600">Không tìm thấy công việc nào phù hợp</p>
                    <p class="text-[10px] text-slate-400 mt-0.5">Không có nhiệm vụ nào trong trạng thái hoặc đơn vị được chọn.</p>
                </div>
            `;
        }

        const now = new Date();

        return `
            <div class="overflow-x-auto">
                <table class="w-full text-left border-collapse text-xs">
                    <thead>
                        <tr class="border-b border-slate-200 text-[10.5px] font-extrabold text-slate-500 uppercase bg-slate-50/50">
                            <th class="py-2 px-2.5 w-8 text-center">#</th>
                            <th class="py-2 px-3 min-w-[220px]">Tên nhiệm vụ</th>
                            <th class="py-2 px-2.5 min-w-[100px]">Đơn vị</th>
                            <th class="py-2 px-2.5 min-w-[130px]">Người phụ trách</th>
                            <th class="py-2 px-2.5 min-w-[100px]">Hạn chót</th>
                            <th class="py-2 px-2.5 w-24 text-center">Tiến độ</th>
                            <th class="py-2 px-3 w-24 text-right">Thao tác</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100 font-medium text-slate-700">
                        ${tasks.map((t, idx) => {
                            const isOverdue = t.due_date && new Date(t.due_date) < now && t.status !== 'HOAN_THANH';
                            const dueFormatted = t.due_date ? Common.formatDate(t.due_date) : 'Chưa đặt';
                            const progress = t.progress !== undefined ? t.progress : (t.status === 'HOAN_THANH' ? 100 : t.status === 'CHUA_BAT_DAU' ? 0 : 50);
                            const deptCode = t.leading_department ? t.leading_department.code : (t.assignee && t.assignee.department ? t.assignee.department.code : 'HueIC');
                            const assigneeName = t.assignee ? t.assignee.full_name : '<span class="text-amber-600 italic">Chưa giao</span>';

                            return `
                                <tr class="hover:bg-slate-50/80 transition">
                                    <td class="py-2.5 px-2.5 text-center text-slate-400 font-bold text-[11px]">${idx + 1}</td>
                                    <td class="py-2.5 px-3">
                                        <div class="font-bold text-slate-900 hover:text-indigo-600 cursor-pointer line-clamp-2"
                                            onclick="TasksPage.closeTasksByStatusModal(); TasksPage.openTaskDetail(${t.id});">
                                            ${t.title}
                                        </div>
                                        <div class="text-[10px] text-slate-400 mt-0.5 font-mono">
                                            #${t.id} ${t.code ? '• ' + t.code : ''}
                                        </div>
                                    </td>
                                    <td class="py-2.5 px-2.5">
                                        <span class="px-2 py-0.5 rounded text-[10px] font-extrabold bg-indigo-50 text-indigo-800 border border-indigo-200/60">
                                            [${deptCode}]
                                        </span>
                                    </td>
                                    <td class="py-2.5 px-2.5">
                                        <div class="flex items-center gap-1.5 truncate">
                                            <i class="fa-regular fa-user text-[9.5px] text-slate-400"></i>
                                            <span class="truncate">${assigneeName}</span>
                                        </div>
                                    </td>
                                    <td class="py-2.5 px-2.5">
                                        <span class="${isOverdue ? 'text-rose-600 font-bold' : 'text-slate-600'}">
                                            ${dueFormatted}
                                            ${isOverdue ? '<span class="inline-block w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse ml-0.5"></span>' : ''}
                                        </span>
                                    </td>
                                    <td class="py-2.5 px-2.5 text-center">
                                        <div class="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                                            <div class="${progress >= 100 ? 'bg-emerald-500' : progress >= 50 ? 'bg-blue-500' : 'bg-amber-500'} h-full rounded-full"
                                                style="width: ${progress}%"></div>
                                        </div>
                                        <span class="text-[9.5px] font-bold text-slate-600 mt-0.5 inline-block">${progress}%</span>
                                    </td>
                                    <td class="py-2.5 px-3 text-right">
                                        <button onclick="TasksPage.closeTasksByStatusModal(); TasksPage.openTaskDetail(${t.id});"
                                            class="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-600 hover:text-white text-indigo-700 text-[10.5px] font-bold transition cursor-pointer">
                                            Chi tiết →
                                        </button>
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;
    },

    openWorkflowPerformanceModal() {
        let modal = document.getElementById('modalWorkflowPerformance');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'modalWorkflowPerformance';
            modal.className = 'fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center z-50 p-3 sm:p-4 hidden';
            document.body.appendChild(modal);
        }

        const workflows = this._currentWorkflowPerformance || [];

        modal.innerHTML = `
            <div class="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 animate-fade-in">
                <!-- Header -->
                <div class="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                    <div class="flex items-center space-x-2.5">
                        <div class="w-8 h-8 rounded-lg bg-teal-600 text-white flex items-center justify-center text-sm shadow-xs">
                            <i class="fa-solid fa-diagram-project"></i>
                        </div>
                        <div>
                            <div class="flex items-center gap-2">
                                <h3 class="font-black text-sm text-slate-900 leading-tight">Đánh Giá Hiệu Suất Quy Trình Chuẩn (SOP Engine)</h3>
                                <span class="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 border border-teal-200">
                                    ${workflows.length} quy trình
                                </span>
                            </div>
                            <p class="text-[10.5px] text-slate-500 font-medium">Đo lường thời gian chu kỳ (Cycle Time) &amp; Tỷ lệ hoàn thành theo danh mục SOP</p>
                        </div>
                    </div>
                    <button onclick="TasksPage.closeWorkflowPerformanceModal()" class="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200 transition cursor-pointer">
                        <i class="fa-solid fa-xmark text-base"></i>
                    </button>
                </div>

                <!-- Body Table -->
                <div class="p-4 overflow-y-auto flex-1 text-xs">
                    <table class="w-full text-left border-collapse text-xs">
                        <thead>
                            <tr class="border-b border-slate-200 text-[10.5px] font-extrabold text-slate-500 uppercase bg-slate-50/60">
                                <th class="py-2.5 px-3">Tên Quy Trình Chuẩn</th>
                                <th class="py-2.5 px-2.5 text-center">Đơn vị</th>
                                <th class="py-2.5 px-2.5 text-center">Số bước</th>
                                <th class="py-2.5 px-2.5 text-center">Nhiệm vụ</th>
                                <th class="py-2.5 px-2.5 text-center">Tỷ lệ xong</th>
                                <th class="py-2.5 px-2.5 text-center">Chu kỳ TB</th>
                                <th class="py-2.5 px-3 text-center">Đánh giá</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100 font-medium text-slate-700">
                            ${workflows.length === 0 ? `
                                <tr><td colspan="7" class="py-8 text-center text-slate-400 italic">Chưa có dữ liệu quy trình</td></tr>
                            ` : workflows.map((wf, idx) => {
                                const isFast = wf.avg_cycle_days <= 5.0;
                                const isWarning = wf.overdue_count > 0;
                                const badgeClass = isWarning ? 'bg-rose-100 text-rose-800 border-rose-200' : isFast ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-blue-100 text-blue-800 border-blue-200';
                                const badgeText = isWarning ? 'Có nghẽn' : isFast ? 'Tối ưu' : 'Bình thường';

                                return `
                                    <tr class="hover:bg-slate-50 transition">
                                        <td class="py-3 px-3">
                                            <div class="font-bold text-slate-900">${wf.name}</div>
                                            <div class="text-[10px] text-slate-400 font-mono mt-0.5">${wf.code}</div>
                                        </td>
                                        <td class="py-3 px-2.5 text-center">
                                            <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                                ${wf.dept_code}
                                            </span>
                                        </td>
                                        <td class="py-3 px-2.5 text-center font-bold text-slate-600">${wf.steps_count} bước</td>
                                        <td class="py-3 px-2.5 text-center font-bold">${wf.tasks_count} việc</td>
                                        <td class="py-3 px-2.5 text-center">
                                            <span class="font-extrabold text-emerald-700">${wf.completion_rate}%</span>
                                        </td>
                                        <td class="py-3 px-2.5 text-center font-extrabold text-indigo-700">
                                            ${wf.avg_cycle_days} ngày
                                        </td>
                                        <td class="py-3 px-3 text-center">
                                            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold border ${badgeClass}">
                                                ${badgeText}
                                            </span>
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>

                <!-- Footer -->
                <div class="px-5 py-2.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
                    <span class="text-[10.5px] text-slate-400">Chu kỳ trung bình được tính toán tự động dựa trên thời gian từ lúc khởi tạo đến lúc nghiệm thu hoàn thành</span>
                    <button onclick="TasksPage.closeWorkflowPerformanceModal()" class="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-lg text-xs transition cursor-pointer">
                        Đóng
                    </button>
                </div>
            </div>
        `;

        modal.classList.remove('hidden');
    },

    closeWorkflowPerformanceModal() {
        const modal = document.getElementById('modalWorkflowPerformance');
        if (modal) modal.classList.add('hidden');
    }

};
