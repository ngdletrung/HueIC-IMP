// React + Recharts Executive Operational Dashboard - HueIC IMP v2.4.4
// Modern Editorial & Decision-Oriented UI

const ReactObj = window.React || {};
const { useState, useEffect, useMemo } = ReactObj;
const RechartsObj = window.Recharts || window.recharts || {};
const BarChart = RechartsObj.BarChart;
const Bar = RechartsObj.Bar;
const XAxis = RechartsObj.XAxis;
const YAxis = RechartsObj.YAxis;
const CartesianGrid = RechartsObj.CartesianGrid;
const Tooltip = RechartsObj.Tooltip;
const Cell = RechartsObj.Cell;
const ResponsiveContainer = RechartsObj.ResponsiveContainer;


// ---------------------------------------------------------------------------
// Design Tokens
// ---------------------------------------------------------------------------
const COLOR = {
    bg: "#F6F5F1",
    surface: "#FFFFFF",
    ink: "#16233D",
    inkMuted: "#5B6472",
    border: "#E4E1D8",
    navy: "#16233D",
    teal: "#0E7C7B",
    tealSoft: "#E4F1F0",
    amber: "#C17817",
    amberSoft: "#FBF0DF",
    red: "#B3261E",
    redSoft: "#FBE9E7",
    grey: "#C7C2B4",
    green: "#2E7D32",
    greenSoft: "#E8F5E9",
};

const toneMap = {
    navy: { fg: COLOR.navy, bg: "#EEF0F4" },
    teal: { fg: COLOR.teal, bg: COLOR.tealSoft },
    amber: { fg: COLOR.amber, bg: COLOR.amberSoft },
    red: { fg: COLOR.red, bg: COLOR.redSoft },
    grey: { fg: COLOR.inkMuted, bg: "#EFEEE9" },
    green: { fg: COLOR.green, bg: COLOR.greenSoft },
};

// ---------------------------------------------------------------------------
// 1. KPI Card Component
// ---------------------------------------------------------------------------
function KpiCard({ item, href }) {
    const tone = toneMap[item.tone] || toneMap.navy;
    const isAlert = item.tone === "red" && item.value > 0;

    return (
        <a
            href={href}
            style={{
                background: COLOR.surface,
                border: `1px solid ${isAlert ? COLOR.red : COLOR.border}`,
                borderLeft: `3px solid ${tone.fg}`,
                borderRadius: 8,
                padding: "16px 18px",
                flex: "1 1 0",
                minWidth: 150,
                textDecoration: "none",
                color: "inherit",
                display: "block",
                boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                transition: "transform 0.15s ease, box-shadow 0.15s ease",
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = "0 4px 12px rgba(22,35,61,0.08)";
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.03)";
            }}
        >
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: COLOR.inkMuted, fontFamily: "Inter, sans-serif" }}>
                    {item.label}
                </span>
                <span
                    style={{
                        width: 28,
                        height: 28,
                        borderRadius: 6,
                        background: tone.bg,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        color: tone.fg,
                        fontSize: 13,
                    }}
                >
                    <i className={item.icon}></i>
                </span>
            </div>
            <div
                style={{
                    fontFamily: "Manrope, sans-serif",
                    fontWeight: 800,
                    fontSize: 30,
                    color: isAlert ? COLOR.red : COLOR.ink,
                    marginTop: 6,
                    lineHeight: 1,
                }}
            >
                {item.value}
            </div>
            <div style={{ fontSize: 11.5, color: isAlert ? COLOR.red : COLOR.inkMuted, marginTop: 6, fontWeight: isAlert ? 700 : 500, fontFamily: "Inter, sans-serif" }}>
                {item.note}
            </div>
        </a>
    );
}

// ---------------------------------------------------------------------------
// 2. Stacked Bar Breakdown Component
// ---------------------------------------------------------------------------
function StackedBar({ title, sub, data, onSelect }) {
    const total = data.reduce((s, d) => s + d.value, 0) || 1;

    return (
        <div
            style={{
                background: COLOR.surface,
                border: `1px solid ${COLOR.border}`,
                borderRadius: 8,
                padding: 18,
                boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
            }}
        >
            <div style={{ fontFamily: "Manrope, sans-serif", fontWeight: 700, fontSize: 14.5, color: COLOR.ink }}>
                {title}
            </div>
            <div style={{ fontSize: 11.5, color: COLOR.inkMuted, marginTop: 2, fontFamily: "Inter, sans-serif" }}>
                {sub}
            </div>

            {/* Horizontal Stacked Bar */}
            <div
                style={{
                    display: "flex",
                    width: "100%",
                    height: 10,
                    borderRadius: 5,
                    overflow: "hidden",
                    marginTop: 14,
                    background: "#EFEEE9",
                }}
            >
                {data.map((d) =>
                    d.value > 0 ? (
                        <div
                            key={d.label}
                            style={{
                                width: `${(d.value / total) * 100}%`,
                                background: d.color,
                                cursor: "pointer",
                            }}
                            title={`${d.label}: ${d.value} việc (${Math.round((d.value / total) * 100)}%)`}
                            onClick={() => onSelect && onSelect(d)}
                        />
                    ) : null
                )}
            </div>

            {/* Breakdown List */}
            <div style={{ display: "flex", flexDirection: "column", gap: 9, marginTop: 14 }}>
                {data.map((d) => (
                    <div
                        key={d.label}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            cursor: onSelect ? "pointer" : "default",
                            padding: "2px 4px",
                            borderRadius: 4,
                            transition: "background 0.15s",
                        }}
                        className="hover:bg-slate-50"
                        onClick={() => onSelect && onSelect(d)}
                    >
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ width: 8, height: 8, borderRadius: 2, background: d.color, display: "inline-block" }} />
                            <span style={{ fontSize: 13, color: COLOR.ink, fontFamily: "Inter, sans-serif" }}>{d.label}</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: COLOR.ink, fontFamily: "Inter, sans-serif" }}>
                                {d.value}
                            </span>
                            {d.overdue > 0 && (
                                <span style={{ fontSize: 10, fontWeight: 800, background: COLOR.redSoft, color: COLOR.red, padding: "1px 5px", borderRadius: 4 }}>
                                    🚨 {d.overdue} trễ
                                </span>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// 3. Progress Cell Component
// ---------------------------------------------------------------------------
function ProgressCell({ value }) {
    const color = value === 0 ? COLOR.grey : value >= 80 ? COLOR.green : value >= 50 ? COLOR.teal : COLOR.amber;
    return (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ flex: 1, height: 6, borderRadius: 3, background: "#EFEEE9", overflow: "hidden" }}>
                <div style={{ width: `${value}%`, height: "100%", background: color, borderRadius: 3 }} />
            </div>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: COLOR.ink, width: 34, textAlign: "right", fontFamily: "Inter, sans-serif" }}>
                {value}%
            </span>
        </div>
    );
}

// ---------------------------------------------------------------------------
// 4. Custom Recharts Tooltip
// ---------------------------------------------------------------------------
function CustomTooltip({ active, payload }) {
    if (!active || !payload || !payload.length) return null;
    const p = payload[0].payload;
    return (
        <div
            style={{
                background: COLOR.ink,
                color: "#fff",
                padding: "8px 12px",
                borderRadius: 6,
                fontSize: 12,
                fontFamily: "Inter, sans-serif",
                boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            }}
        >
            <div style={{ fontWeight: 700, marginBottom: 4 }}>{p.name}</div>
            <div>Tiến độ: <span style={{ fontWeight: 700, color: "#4ade80" }}>{p.progress}%</span></div>
            <div>Khối lượng: <span style={{ fontWeight: 700 }}>{p.total} nhiệm vụ</span></div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// 5. Main React Dashboard Application
// ---------------------------------------------------------------------------
function DashboardApp() {
    const [departments, setDepartments] = useState([]);
    const [users, setUsers] = useState([]);
    const [deptId, setDeptId] = useState("");
    const [userId, setUserId] = useState("");
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showIdle, setShowIdle] = useState(false);

    // Initial Load
    useEffect(() => {
        if (typeof Common !== "undefined") {
            Common.init("dashboard");
        }

        async function initData() {
            try {
                const [depts, userList] = await Promise.all([
                    API.getDepartments(),
                    API.getUsers(),
                ]);
                setDepartments(depts || []);
                setUsers(userList || []);
            } catch (err) {
                console.error("Lỗi tải danh mục:", err);
            }
        }
        initData();
    }, []);

    // Load Stats on Filter Change
    const loadStats = async () => {
        setLoading(true);
        try {
            const data = await API.getStatsSummary({ dept_id: deptId, user_id: userId });
            setStats(data);

            // Cập nhật sidebar badge
            const navBadge = document.getElementById("navBadgeTasks");
            if (navBadge && data?.overview) {
                const pending = (data.overview.overdue_tasks || 0) + (data.overview.review_tasks || 0);
                if (pending > 0) {
                    navBadge.classList.remove("hidden");
                    navBadge.innerText = pending;
                } else {
                    navBadge.classList.add("hidden");
                }
            }
        } catch (err) {
            console.error("Lỗi tải thống kê:", err);
            if (typeof Common !== "undefined") {
                Common.showToast("Không thể tải dữ liệu tổng quan", "error");
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadStats();
    }, [deptId, userId]);

    // Computed Data
    const ov = stats?.overview || {
        total_tasks: 0,
        in_progress_tasks: 0,
        review_tasks: 0,
        overdue_tasks: 0,
        completed_tasks: 0,
        not_started_tasks: 0,
        paused_tasks: 0,
        completion_rate: 0,
    };

    const actionQueue = stats?.action_queue || { overdue: [], due_soon: [], review: [] };
    const prio = stats?.priority_stats || {};

    const kpiData = [
        { label: "Tổng công việc", value: ov.total_tasks, icon: "fa-solid fa-folder-open", tone: "navy", note: "Tất cả nhiệm vụ", href: "tasks.html" },
        { label: "Đang thực hiện", value: ov.in_progress_tasks, icon: "fa-solid fa-clock-rotate-left", tone: "teal", note: "Đang triển khai", href: "tasks.html?status=DANG_THUC_HIEN" },
        { label: "Chờ nghiệm thu", value: ov.review_tasks, icon: "fa-solid fa-clipboard-check", tone: "amber", note: "Chờ phê duyệt", href: "tasks.html?status=CHO_DUYET" },
        { label: "Quá hạn tiến độ", value: ov.overdue_tasks || 0, icon: "fa-solid fa-triangle-exclamation", tone: "red", note: "Cần xử lý gấp", href: "tasks.html?status=TRE_HAN" },
        { label: "Đã hoàn thành", value: ov.completed_tasks, icon: "fa-solid fa-circle-check", tone: "green", note: `${ov.completion_rate}% đã nghiệm thu`, href: "tasks.html?status=HOAN_THANH" },
    ];

    const statusData = [
        { label: "Đã hoàn thành", value: ov.completed_tasks || 0, color: COLOR.green, statusKey: "HOAN_THANH" },
        { label: "Đang thực hiện", value: ov.in_progress_tasks || 0, color: COLOR.teal, statusKey: "DANG_THUC_HIEN" },
        { label: "Chờ nghiệm thu", value: ov.review_tasks || 0, color: COLOR.amber, statusKey: "CHO_DUYET" },
        { label: "Chưa bắt đầu", value: ov.not_started_tasks || 0, color: COLOR.grey, statusKey: "CHUA_BAT_DAU" },
        { label: "Tạm dừng", value: ov.paused_tasks || 0, color: "#8b5cf6", statusKey: "TAM_DUNG" },
        { label: "Quá hạn", value: ov.overdue_tasks || 0, color: COLOR.red, statusKey: "TRE_HAN" },
    ];

    const priorityData = [
        { label: "Khẩn cấp", value: prio.KHAN_CAP || 0, color: COLOR.red, prioKey: "KHAN_CAP", overdue: prio.KHAN_CAP_OVERDUE || 0 },
        { label: "Mức độ cao", value: prio.CAO || 0, color: COLOR.amber, prioKey: "CAO" },
        { label: "Trung bình", value: prio.TRUNG_BINH || 0, color: COLOR.teal, prioKey: "TRUNG_BINH" },
        { label: "Mức độ thấp", value: prio.THAP || 0, color: COLOR.grey, prioKey: "THAP" },
    ];

    // Units / Staff List Processing
    const isUserScope = Boolean(userId);
    const isDeptScope = Boolean(deptId) && !isUserScope;

    const rawList = useMemo(() => {
        if (isUserScope) {
            return (stats?.user_tasks || []).map((t) => ({
                code: t.leading_dept_code || "-",
                name: t.title,
                total: 1,
                doing: t.status === "DANG_THUC_HIEN" ? 1 : 0,
                done: t.status === "HOAN_THANH" ? 1 : 0,
                progress: t.progress_percent || 0,
                taskId: t.id,
            }));
        } else if (isDeptScope) {
            return (stats?.staff_stats || []).map((s) => ({
                code: s.full_name.substring(0, 3).toUpperCase(),
                name: `${s.full_name} (${s.position || "Cán bộ"})`,
                total: s.total_tasks || 0,
                doing: s.in_progress_tasks || 0,
                done: s.completed_tasks || 0,
                progress: s.avg_progress || 0,
                userId: s.user_id,
            }));
        } else {
            return (stats?.department_stats || []).map((d) => ({
                code: d.dept_code,
                name: d.dept_name,
                total: d.total_tasks || 0,
                doing: d.in_progress_tasks || 0,
                done: d.completed_tasks || 0,
                progress: d.avg_progress || 0,
                deptId: d.dept_id,
            }));
        }
    }, [stats, isUserScope, isDeptScope]);

    const activeUnits = rawList.filter((u) => u.total > 0).sort((a, b) => b.progress - a.progress);
    const idleUnits = rawList.filter((u) => u.total === 0);

    const chartData = activeUnits.map((u) => ({
        name: u.name.length > 28 ? u.name.substring(0, 28) + "..." : u.name,
        progress: u.progress,
        total: u.total,
    }));

    // Filter scope options
    const filteredUsers = useMemo(() => {
        if (!deptId) return users;
        return users.filter((u) => u.department_id == deptId);
    }, [users, deptId]);

    const totalActionCount = (actionQueue.overdue?.length || 0) + (actionQueue.due_soon?.length || 0) + (actionQueue.review?.length || 0);

    return (
        <div style={{ background: COLOR.bg, minHeight: "100vh", padding: "24px 28px", fontFamily: "Inter, sans-serif", color: COLOR.ink }}>
            {/* 1. Header & Scope Selector */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20, flexWrap: "wrap", gap: 14 }}>
                <div>
                    <h1 style={{ fontFamily: "Manrope, sans-serif", fontWeight: 800, fontSize: 22, margin: 0, color: COLOR.navy }}>
                        Tổng quan hoạt động & tiến độ
                    </h1>
                    <p style={{ margin: "4px 0 0", fontSize: 13, color: COLOR.inkMuted }}>
                        Theo dõi thực thi công việc của 12 đơn vị HueIC — cập nhật theo thời gian thực
                    </p>
                </div>

                {/* Filters & Actions */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    {/* Dept Filter */}
                    <select
                        value={deptId}
                        onChange={(e) => {
                            setDeptId(e.target.value);
                            setUserId("");
                        }}
                        style={{
                            background: COLOR.surface,
                            border: `1px solid ${COLOR.border}`,
                            borderRadius: 6,
                            padding: "8px 12px",
                            fontSize: 12.5,
                            fontWeight: 600,
                            color: COLOR.ink,
                            outline: "none",
                            cursor: "pointer",
                        }}
                    >
                        <option value="">🏢 Cấp Toàn Trường (12 Đơn vị)</option>
                        {departments.map((d) => (
                            <option key={d.id} value={d.id}>
                                {d.name} ({d.code})
                            </option>
                        ))}
                    </select>

                    {/* Staff Filter */}
                    <select
                        value={userId}
                        onChange={(e) => setUserId(e.target.value)}
                        style={{
                            background: COLOR.surface,
                            border: `1px solid ${COLOR.border}`,
                            borderRadius: 6,
                            padding: "8px 12px",
                            fontSize: 12.5,
                            fontWeight: 600,
                            color: COLOR.ink,
                            outline: "none",
                            cursor: "pointer",
                        }}
                    >
                        <option value="">👥 Tất Cả Cán Bộ</option>
                        {filteredUsers.map((u) => (
                            <option key={u.id} value={u.id}>
                                {u.full_name} ({u.position || u.role})
                            </option>
                        ))}
                    </select>

                    {/* Reset Scope */}
                    {(deptId || userId) && (
                        <button
                            onClick={() => {
                                setDeptId("");
                                setUserId("");
                            }}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                                background: COLOR.surface,
                                border: `1px solid ${COLOR.border}`,
                                borderRadius: 6,
                                padding: "8px 12px",
                                fontSize: 12.5,
                                fontWeight: 600,
                                color: COLOR.ink,
                                cursor: "pointer",
                            }}
                            title="Trở về cấp Toàn trường"
                        >
                            <i className="fa-solid fa-rotate-left"></i>
                        </button>
                    )}

                    {/* Refresh Button */}
                    <button
                        onClick={loadStats}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            background: COLOR.surface,
                            border: `1px solid ${COLOR.border}`,
                            borderRadius: 6,
                            padding: "8px 14px",
                            fontSize: 13,
                            fontWeight: 600,
                            color: COLOR.ink,
                            cursor: "pointer",
                        }}
                    >
                        <i className={`fa-solid fa-rotate ${loading ? "fa-spin" : ""}`}></i> Làm mới
                    </button>

                    {/* Action Button */}
                    <a
                        href="tasks.html"
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            background: COLOR.navy,
                            borderRadius: 6,
                            padding: "8px 16px",
                            fontSize: 13,
                            fontWeight: 600,
                            color: "#fff",
                            textDecoration: "none",
                        }}
                    >
                        <i className="fa-solid fa-plus text-xs"></i> Giao việc mới
                    </a>
                </div>
            </div>

            {/* 2. KPI Cards Strip */}
            <div style={{ display: "flex", gap: 12, marginBottom: 18, flexWrap: "wrap" }}>
                {kpiData.map((k) => (
                    <KpiCard key={k.label} item={k} href={k.href} />
                ))}
            </div>

            {/* 3. Urgent Action Queue Hub (Điểm nghẽn cần xử lý ngay) */}
            {totalActionCount > 0 && (
                <div
                    style={{
                        background: COLOR.surface,
                        border: `1px solid ${COLOR.border}`,
                        borderRadius: 8,
                        padding: "14px 18px",
                        marginBottom: 18,
                        boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                    }}
                >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <i className="fa-solid fa-bolt-lightning text-amber-500"></i>
                            <span style={{ fontFamily: "Manrope, sans-serif", fontWeight: 700, fontSize: 13.5, color: COLOR.ink }}>
                                Điểm Nghẽn & Nhiệm Vụ Cần Chỉ Đạo Ngay ({totalActionCount})
                            </span>
                        </div>
                        <a href="tasks.html?status=TRE_HAN" style={{ fontSize: 12, fontWeight: 700, color: COLOR.teal, textDecoration: "none" }}>
                            Xem tất cả danh sách →
                        </a>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 10 }}>
                        {actionQueue.overdue?.slice(0, 2).map((item) => (
                            <div
                                key={item.id}
                                style={{
                                    padding: "10px 12px",
                                    background: COLOR.redSoft,
                                    border: `1px solid #ffcdd2`,
                                    borderRadius: 6,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    gap: 10,
                                }}
                            >
                                <div style={{ minWidth: 0, flex: 1 }}>
                                    <div style={{ fontSize: 12, fontWeight: 700, color: COLOR.red, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                        🚨 {item.title}
                                    </div>
                                    <div style={{ fontSize: 11, color: COLOR.inkMuted, marginTop: 2 }}>
                                        [{item.dept_code}] {item.assignee_name} • <span style={{ color: COLOR.red, fontWeight: 700 }}>Trễ {item.days_overdue} ngày</span>
                                    </div>
                                </div>
                                <a
                                    href={`tasks.html?task_id=${item.id}`}
                                    style={{
                                        background: COLOR.red,
                                        color: "#fff",
                                        fontSize: 11,
                                        fontWeight: 700,
                                        padding: "4px 9px",
                                        borderRadius: 4,
                                        textDecoration: "none",
                                        flexShrink: 0,
                                    }}
                                >
                                    Xử lý
                                </a>
                            </div>
                        ))}

                        {actionQueue.review?.slice(0, 1).map((item) => (
                            <div
                                key={item.id}
                                style={{
                                    padding: "10px 12px",
                                    background: COLOR.amberSoft,
                                    border: `1px solid #ffe082`,
                                    borderRadius: 6,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    gap: 10,
                                }}
                            >
                                <div style={{ minWidth: 0, flex: 1 }}>
                                    <div style={{ fontSize: 12, fontWeight: 700, color: COLOR.amber, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                        🟡 {item.title}
                                    </div>
                                    <div style={{ fontSize: 11, color: COLOR.inkMuted, marginTop: 2 }}>
                                        [{item.dept_code}] {item.assignee_name} • Chờ duyệt ({item.progress_percent}%)
                                    </div>
                                </div>
                                <a
                                    href={`tasks.html?task_id=${item.id}`}
                                    style={{
                                        background: COLOR.amber,
                                        color: "#fff",
                                        fontSize: 11,
                                        fontWeight: 700,
                                        padding: "4px 9px",
                                        borderRadius: 4,
                                        textDecoration: "none",
                                        flexShrink: 0,
                                    }}
                                >
                                    Duyệt
                                </a>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* 4. Main 2-Column Grid (300px : 1fr) */}
            <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 16, alignItems: "start" }}>
                {/* Left Column: Stacked Bars */}
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    <StackedBar
                        title="Cơ cấu tình trạng"
                        sub={`Toàn bộ ${ov.total_tasks} công việc`}
                        data={statusData}
                        onSelect={(d) => (window.location.href = `tasks.html?status=${d.statusKey}`)}
                    />
                    <StackedBar
                        title="Phân bổ ưu tiên"
                        sub="Theo mức độ khẩn cấp"
                        data={priorityData}
                        onSelect={(d) => (window.location.href = `tasks.html?priority=${d.prioKey}`)}
                    />
                </div>

                {/* Right Column: Recharts Bar Chart & Detailed Table */}
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    {/* Recharts Bar Chart */}
                    <div
                        style={{
                            background: COLOR.surface,
                            border: `1px solid ${COLOR.border}`,
                            borderRadius: 8,
                            padding: 18,
                            boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                        }}
                    >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                            <div>
                                <div style={{ fontFamily: "Manrope, sans-serif", fontWeight: 700, fontSize: 14.5, color: COLOR.ink }}>
                                    {isUserScope ? "Tiến độ nhiệm vụ của cán bộ" : isDeptScope ? "Tiến độ cán bộ thuộc đơn vị" : "Tiến độ theo 12 đơn vị HueIC"}
                                </div>
                                <div style={{ fontSize: 11.5, color: COLOR.inkMuted, marginTop: 2 }}>
                                    {activeUnits.length > 0
                                        ? `Hiển thị ${activeUnits.length} đối tượng đang có công việc (sắp xếp theo % hoàn thành)`
                                        : "Chưa có công việc nào trong phạm vi đã chọn"}
                                </div>
                            </div>
                            <span style={{ fontSize: 11, fontWeight: 700, color: COLOR.teal, background: COLOR.tealSoft, padding: "2px 8px", borderRadius: 4 }}>
                                Recharts
                            </span>
                        </div>

                        {activeUnits.length > 0 && typeof ResponsiveContainer !== "undefined" ? (
                            <div style={{ height: Math.max(activeUnits.length * 44, 110), marginTop: 14 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
                                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={COLOR.border} />
                                        <XAxis
                                            type="number"
                                            domain={[0, 100]}
                                            tick={{ fontSize: 11, fill: COLOR.inkMuted }}
                                            tickFormatter={(v) => `${v}%`}
                                            axisLine={{ stroke: COLOR.border }}
                                            tickLine={false}
                                        />
                                        <YAxis
                                            type="category"
                                            dataKey="name"
                                            width={190}
                                            tick={{ fontSize: 12, fill: COLOR.ink, fontWeight: 600 }}
                                            axisLine={{ stroke: COLOR.border }}
                                            tickLine={false}
                                        />
                                        <Tooltip cursor={{ fill: "rgba(22,35,61,0.04)" }} content={<CustomTooltip />} />
                                        <Bar dataKey="progress" radius={[0, 4, 4, 0]} barSize={18}>
                                            {chartData.map((d, i) => (
                                                <Cell key={i} fill={d.progress >= 50 ? COLOR.teal : COLOR.amber} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        ) : (
                            <div style={{ padding: "30px 0", textAlign: "center", color: COLOR.inkMuted, fontSize: 12.5, fontStyle: "italic" }}>
                                Không có đối tượng nào đang thực hiện công việc.
                            </div>
                        )}
                    </div>

                    {/* Detailed Data Table */}
                    <div
                        style={{
                            background: COLOR.surface,
                            border: `1px solid ${COLOR.border}`,
                            borderRadius: 8,
                            overflow: "hidden",
                            boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                        }}
                    >
                        <div style={{ padding: "16px 18px 10px" }}>
                            <div style={{ fontFamily: "Manrope, sans-serif", fontWeight: 700, fontSize: 14.5, color: COLOR.ink }}>
                                Bảng theo dõi tiến độ chi tiết
                            </div>
                            <div style={{ fontSize: 11.5, color: COLOR.inkMuted, marginTop: 2 }}>
                                Đơn vị đang có nhiệm vụ hiển thị trước — bấm để xem danh sách việc
                            </div>
                        </div>

                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                            <thead>
                                <tr style={{ borderTop: `1px solid ${COLOR.border}`, borderBottom: `1px solid ${COLOR.border}`, background: "#FAFAF7" }}>
                                    {["Mã", isUserScope ? "Tiêu đề nhiệm vụ" : "Đơn vị / Phòng / Khoa", "Tổng việc", "Đang làm", "Hoàn thành", "Tiến độ (%)", ""].map((h, i) => (
                                        <th
                                            key={h + i}
                                            style={{
                                                textAlign: "left",
                                                padding: "10px 16px",
                                                fontSize: 11.5,
                                                color: COLOR.inkMuted,
                                                fontWeight: 700,
                                                whiteSpace: "nowrap",
                                            }}
                                        >
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {activeUnits.length > 0 ? (
                                    activeUnits.map((u) => (
                                        <tr key={u.code + u.name} style={{ borderBottom: `1px solid ${COLOR.border}` }} className="hover:bg-slate-50">
                                            <td style={{ padding: "11px 16px" }}>
                                                <span
                                                    style={{
                                                        background: COLOR.tealSoft,
                                                        color: COLOR.teal,
                                                        fontSize: 11,
                                                        fontWeight: 800,
                                                        padding: "2px 7px",
                                                        borderRadius: 4,
                                                    }}
                                                >
                                                    {u.code}
                                                </span>
                                            </td>
                                            <td style={{ padding: "11px 16px", fontWeight: 600, color: COLOR.ink }}>{u.name}</td>
                                            <td style={{ padding: "11px 16px", fontWeight: 700 }}>{u.total}</td>
                                            <td style={{ padding: "11px 16px", color: COLOR.teal, fontWeight: 700 }}>{u.doing}</td>
                                            <td style={{ padding: "11px 16px", color: COLOR.green, fontWeight: 700 }}>{u.done}</td>
                                            <td style={{ padding: "11px 16px", minWidth: 150 }}>
                                                <ProgressCell value={u.progress} />
                                            </td>
                                            <td style={{ padding: "11px 16px", textAlign: "right" }}>
                                                <a
                                                    href={u.taskId ? `tasks.html?task_id=${u.taskId}` : u.userId ? `tasks.html?user_id=${u.userId}` : `tasks.html?dept_id=${u.deptId}`}
                                                    style={{
                                                        color: COLOR.teal,
                                                        fontSize: 12.5,
                                                        fontWeight: 700,
                                                        display: "inline-flex",
                                                        alignItems: "center",
                                                        gap: 4,
                                                        textDecoration: "none",
                                                    }}
                                                >
                                                    <span>Xem việc</span>
                                                    <i className="fa-solid fa-arrow-up-right-from-square text-[10px]"></i>
                                                </a>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={7} style={{ padding: "24px", textAlign: "center", color: COLOR.inkMuted, fontStyle: "italic", fontSize: 12.5 }}>
                                            Chưa có dữ liệu nào trong phạm vi đã chọn.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>

                        {/* Collapsed Idle Units Accordion */}
                        {idleUnits.length > 0 && (
                            <>
                                <button
                                    onClick={() => setShowIdle(!showIdle)}
                                    style={{
                                        width: "100%",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 6,
                                        padding: "10px 18px",
                                        background: "#FAFAF7",
                                        border: "none",
                                        borderTop: `1px solid ${COLOR.border}`,
                                        fontSize: 12.5,
                                        fontWeight: 600,
                                        color: COLOR.inkMuted,
                                        cursor: "pointer",
                                        textAlign: "left",
                                    }}
                                >
                                    <i className={`fa-solid ${showIdle ? "fa-chevron-down" : "fa-chevron-right"} text-xs`}></i>
                                    <span>{idleUnits.length} đơn vị chưa có công việc nào</span>
                                </button>
                                {showIdle && (
                                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                                        <tbody>
                                            {idleUnits.map((u) => (
                                                <tr key={u.code + u.name} style={{ borderBottom: `1px solid ${COLOR.border}` }} className="hover:bg-slate-50">
                                                    <td style={{ padding: "8px 18px", width: 80 }}>
                                                        <span
                                                            style={{
                                                                background: "#EFEEE9",
                                                                color: COLOR.inkMuted,
                                                                fontSize: 10.5,
                                                                fontWeight: 700,
                                                                padding: "2px 6px",
                                                                borderRadius: 4,
                                                            }}
                                                        >
                                                            {u.code}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: "8px 18px", color: COLOR.inkMuted, fontWeight: 500 }}>{u.name}</td>
                                                    <td style={{ padding: "8px 18px", color: COLOR.grey, textAlign: "right", fontStyle: "italic" }}>
                                                        Chưa có việc
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

// Mount React Root Safely (Handles both before & after DOMContentLoaded)
function mountReactDashboard() {
    try {
        const rootEl = document.getElementById("react-dashboard-root");
        if (rootEl && typeof ReactDOM !== "undefined") {
            const root = ReactDOM.createRoot(rootEl);
            root.render(<DashboardApp />);
            console.log("✅ HueIC IMP React & Recharts Dashboard Mounted Successfully");
        } else {
            console.warn("⚠️ Cannot mount React Dashboard: rootEl or ReactDOM is missing");
        }
    } catch (err) {
        console.error("❌ Error mounting React Dashboard:", err);
    }
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountReactDashboard);
} else {
    mountReactDashboard();
}


