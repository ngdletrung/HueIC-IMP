// React 18 + Recharts Executive Operational Dashboard - HueIC IMP v2.7.0
// 100% Original Complete Structure: 5 KPI Cards, Status/Priority Segments, Vertical BarChart & Detailed Unit Table

(function () {
  const { useState, useEffect, useMemo, createElement: h } = React;
  const {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Cell,
    ResponsiveContainer,
  } = window.Recharts || {};

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
    green: "#3B8B6E",
    greenSoft: "#E7F3EC",
  };

  const toneMap = {
    navy: { fg: COLOR.navy, bg: "#EEF0F4" },
    teal: { fg: COLOR.teal, bg: COLOR.tealSoft },
    amber: { fg: COLOR.amber, bg: COLOR.amberSoft },
    red: { fg: COLOR.red, bg: COLOR.redSoft },
    grey: { fg: COLOR.inkMuted, bg: "#EFEEE9" },
    green: { fg: COLOR.green, bg: COLOR.greenSoft },
  };

  const IconComp = ({ iconClass, size = 13, color }) =>
    h("i", { className: iconClass, style: { fontSize: size, color: color || "currentColor" } });

  // ---------------------------------------------------------------------------
  // 1. KPI Card Component
  // ---------------------------------------------------------------------------
  function KpiCard({ item, onClick }) {
    const tone = toneMap[item.tone] || toneMap.navy;
    const isAlert = item.tone === "red" && item.value > 0;

    return h(
      "div",
      {
        onClick: onClick,
        title: `Mở xem danh sách "${item.label}"`,
        style: {
          background: COLOR.surface,
          border: `1px solid ${isAlert ? COLOR.red : COLOR.border}`,
          borderLeft: `3.5px solid ${tone.fg}`,
          borderRadius: 8,
          padding: "14px 16px",
          flex: "1 1 0",
          minWidth: 140,
          cursor: "pointer",
          boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
          transition: "all 0.15s ease",
        },
        onMouseEnter: (e) => {
          e.currentTarget.style.transform = "translateY(-2px)";
          e.currentTarget.style.boxShadow = "0 4px 12px rgba(22,35,61,0.08)";
          e.currentTarget.style.borderColor = tone.fg;
        },
        onMouseLeave: (e) => {
          e.currentTarget.style.transform = "translateY(0)";
          e.currentTarget.style.boxShadow = "0 1px 2px rgba(0,0,0,0.03)";
          e.currentTarget.style.borderColor = isAlert ? COLOR.red : COLOR.border;
        },
      },
      h(
        "div",
        { style: { display: "flex", alignItems: "center", justifyContent: "space-between" } },
        h(
          "span",
          {
            style: {
              fontSize: 12,
              fontWeight: 600,
              color: COLOR.inkMuted,
              fontFamily: "Inter, sans-serif",
              letterSpacing: "0.01em",
            },
          },
          item.label
        ),
        h(
          "span",
          {
            style: {
              width: 24,
              height: 24,
              borderRadius: 6,
              background: tone.bg,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            },
          },
          h(IconComp, { iconClass: item.iconClass, size: 12, color: tone.fg })
        )
      ),
      h(
        "div",
        {
          style: {
            fontFamily: "Manrope, sans-serif",
            fontWeight: 800,
            fontSize: 28,
            color: isAlert ? COLOR.red : COLOR.ink,
            marginTop: 4,
            lineHeight: 1.1,
          },
        },
        item.value
      ),
      h(
        "div",
        {
          style: {
            fontSize: 11,
            color: COLOR.inkMuted,
            marginTop: 4,
            fontFamily: "Inter, sans-serif",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          },
        },
        item.note
      )
    );
  }

  // ---------------------------------------------------------------------------
  // 2. StackedBar Component
  // ---------------------------------------------------------------------------
  function StackedBar({ data, title, sub, onItemClick }) {
    const total = data.reduce((s, d) => s + d.value, 0) || 1;

    return h(
      "div",
      {
        style: {
          background: COLOR.surface,
          border: `1px solid ${COLOR.border}`,
          borderRadius: 6,
          padding: 18,
          boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
        },
      },
      h("div", { style: { fontFamily: "Manrope, sans-serif", fontWeight: 700, fontSize: 14.5, color: COLOR.ink } }, title),
      h("div", { style: { fontSize: 11.5, color: COLOR.inkMuted, marginTop: 2, fontFamily: "Inter, sans-serif" } }, sub),
      // Multi-segment horizontal bar
      h(
        "div",
        {
          style: {
            display: "flex",
            width: "100%",
            height: 10,
            borderRadius: 5,
            overflow: "hidden",
            marginTop: 16,
            background: "#EFEEE9",
            gap: 1,
          },
        },
        data.map((d) =>
          d.value > 0
            ? h("div", {
                key: d.label,
                style: {
                  width: `${(d.value / total) * 100}%`,
                  background: d.color,
                  transition: "width 0.4s ease",
                  cursor: "pointer",
                },
                title: `${d.label}: ${d.value} (Bấm để xem)`,
                onClick: () => onItemClick && onItemClick(d),
              })
            : null
        )
      ),
      // List of rows
      h(
        "div",
        { style: { display: "flex", flexDirection: "column", gap: 6, marginTop: 14 } },
        data.map((d) =>
          h(
            "div",
            {
              key: d.label,
              onClick: () => onItemClick && onItemClick(d),
              title: `Mở xem danh sách "${d.label}"`,
              style: {
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "4px 8px",
                borderRadius: 4,
                cursor: "pointer",
                transition: "background 0.15s ease",
              },
              onMouseEnter: (e) => (e.currentTarget.style.background = "#F6F5F1"),
              onMouseLeave: (e) => (e.currentTarget.style.background = "transparent"),
            },
            h(
              "div",
              { style: { display: "flex", alignItems: "center", gap: 8 } },
              h("span", {
                style: { width: 8, height: 8, borderRadius: 2, background: d.color, display: "inline-block" },
              }),
              h("span", { style: { fontSize: 12.5, color: COLOR.ink, fontFamily: "Inter, sans-serif" } }, d.label)
            ),
            h(
              "div",
              { style: { display: "flex", alignItems: "center", gap: 6 } },
              h(
                "span",
                { style: { fontSize: 13, fontWeight: 700, color: COLOR.ink, fontFamily: "Inter, sans-serif" } },
                d.value
              ),
              h("i", { className: "fa-solid fa-arrow-right text-[10px] text-slate-400" })
            )
          )
        )
      )
    );
  }

  // ---------------------------------------------------------------------------
  // 3. ProgressCell Component
  // ---------------------------------------------------------------------------
  function ProgressCell({ value }) {
    const color =
      value === 0 ? COLOR.grey : value >= 100 ? COLOR.green : value >= 50 ? COLOR.teal : COLOR.amber;

    return h(
      "div",
      { style: { display: "flex", alignItems: "center", gap: 10 } },
      h(
        "div",
        { style: { flex: 1, height: 6, borderRadius: 3, background: "#EFEEE9", overflow: "hidden" } },
        h("div", {
          style: { width: `${value}%`, height: "100%", background: color, borderRadius: 3 },
        })
      ),
      h(
        "span",
        {
          style: {
            fontSize: 12.5,
            fontWeight: 700,
            color: COLOR.ink,
            width: 34,
            textAlign: "right",
            fontFamily: "Manrope, sans-serif",
          },
        },
        `${value}%`
      )
    );
  }

  // ---------------------------------------------------------------------------
  // 4. CustomTooltip Component
  // ---------------------------------------------------------------------------
  function CustomTooltip({ active, payload }) {
    if (!active || !payload || !payload.length) return null;
    const p = payload[0].payload;
    return h(
      "div",
      {
        style: {
          background: COLOR.ink,
          color: "#fff",
          padding: "8px 12px",
          borderRadius: 6,
          fontSize: 12,
          fontFamily: "Inter, sans-serif",
          boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
        },
      },
      h("div", { style: { fontWeight: 700, marginBottom: 3 } }, p.name),
      h("div", null, "Tiến độ: ", h("strong", null, `${p.progress}%`)),
      h("div", null, "Tổng việc: ", h("strong", null, p.total))
    );
  }

  // ---------------------------------------------------------------------------
  // 5. Main ExecutiveDashboardApp Component
  // ---------------------------------------------------------------------------
  function ExecutiveDashboardApp() {
    const [showIdle, setShowIdle] = useState(false);
    const [departments, setDepartments] = useState([]);
    const [users, setUsers] = useState([]);
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterVersion, setFilterVersion] = useState(0);

    // Read active filter criteria from DOM if present
    const currentDeptId = document.getElementById("filterDept")?.value || "";
    const currentStatus = document.getElementById("filterStatus")?.value || "";
    const currentPriority = document.getElementById("filterPriority")?.value || "";
    const currentSearch = document.getElementById("taskSearchInput")?.value || "";

    const selectedDept = useMemo(() => {
      if (!currentDeptId) return null;
      return departments.find((d) => d.id === parseInt(currentDeptId)) || null;
    }, [departments, currentDeptId]);

    const statusConfig = useMemo(() => {
      return typeof Common !== "undefined" && Common.getStatusConfig
        ? Common.getStatusConfig()
        : [
            { code: "CHUA_BAT_DAU", label: "Chưa bắt đầu", color: "#8B96AC", order: 1 },
            { code: "DANG_THUC_HIEN", label: "Đang làm", color: "#0E7C7B", order: 2 },
            { code: "CHO_DUYET", label: "Chờ duyệt", color: "#C17817", order: 3 },
            { code: "TRE_HAN", label: "Quá hạn", color: "#B3261E", order: 4 },
            { code: "HOAN_THANH", label: "Hoàn thành", color: "#3B8B6E", order: 5 },
          ];
    }, []);

    const priorityConfig = useMemo(() => {
      return typeof Common !== "undefined" && Common.getPriorityConfig
        ? Common.getPriorityConfig()
        : [
            { code: "KHAN_CAP", label: "Khẩn cấp", color: "#B3261E", order: 1 },
            { code: "CAO", label: "Mức độ cao", color: "#C17817", order: 2 },
            { code: "TRUNG_BINH", label: "Trung bình", color: "#0E7C7B", order: 3 },
            { code: "THAP", label: "Mức độ thấp", color: "#8B96AC", order: 4 },
          ];
    }, []);

    const loadData = async () => {
      try {
        setLoading(true);
        const [deptsData, usersData, tasksData] = await Promise.all([
          API.getDepartments(),
          API.getUsers(),
          API.getTasks({}),
        ]);
        setDepartments(deptsData || []);
        setUsers(usersData || []);
        setTasks(tasksData || []);
      } catch (e) {
        console.error("[ExecutiveDashboard] Load error:", e);
      } finally {
        setLoading(false);
      }
    };

    useEffect(() => {
      loadData();

      const handleFilterChange = () => {
        setFilterVersion((v) => v + 1);
      };

      window.addEventListener("taskFiltersChanged", handleFilterChange);
      const filterDeptEl = document.getElementById("filterDept");
      const filterStatusEl = document.getElementById("filterStatus");
      const filterPriorityEl = document.getElementById("filterPriority");
      const filterSearchEl = document.getElementById("taskSearchInput");

      filterDeptEl?.addEventListener("change", handleFilterChange);
      filterStatusEl?.addEventListener("change", handleFilterChange);
      filterPriorityEl?.addEventListener("change", handleFilterChange);
      filterSearchEl?.addEventListener("input", handleFilterChange);

      return () => {
        window.removeEventListener("taskFiltersChanged", handleFilterChange);
        filterDeptEl?.removeEventListener("change", handleFilterChange);
        filterStatusEl?.removeEventListener("change", handleFilterChange);
        filterPriorityEl?.removeEventListener("change", handleFilterChange);
        filterSearchEl?.removeEventListener("input", handleFilterChange);
      };
    }, []);

    // 1. Filter Tasks by Scope
    const scopedTasks = useMemo(() => {
      return tasks.filter((t) => {
        if (currentDeptId) {
          const targetDeptId = parseInt(currentDeptId);
          const tDeptId =
            t.leading_dept_id !== undefined && t.leading_dept_id !== null
              ? t.leading_dept_id
              : t.leading_department ? t.leading_department.id : null;
          const tAssistingDeptId =
            t.assisting_dept_id !== undefined && t.assisting_dept_id !== null
              ? t.assisting_dept_id
              : t.assisting_department ? t.assisting_department.id : null;

          if (tDeptId !== targetDeptId && tAssistingDeptId !== targetDeptId) {
            return false;
          }
        }

        if (currentStatus && t.status !== currentStatus) return false;
        if (currentPriority && t.priority !== currentPriority) return false;

        if (currentSearch) {
          const q = currentSearch.toLowerCase();
          const titleMatch = (t.title || "").toLowerCase().includes(q);
          const descMatch = (t.description || "").toLowerCase().includes(q);
          if (!titleMatch && !descMatch) return false;
        }

        return true;
      });
    }, [tasks, currentDeptId, currentStatus, currentPriority, currentSearch, filterVersion]);

    // 2. Dynamic Scoped KPIs - Click navigates to tasks-list.html
    const kpis = useMemo(() => {
      const total = scopedTasks.length;
      let doing = 0, pending = 0, overdue = 0, done = 0;

      scopedTasks.forEach((t) => {
        const isCompleted = t.status === "HOAN_THANH";
        const deadlineInfo =
          typeof Common !== "undefined" && Common.getDeadlineStatus
            ? Common.getDeadlineStatus(t.due_date, isCompleted)
            : { isOverdue: false };

        if (isCompleted) done++;
        else if (deadlineInfo.isOverdue || t.status === "TRE_HAN") overdue++;
        else if (t.status === "CHO_DUYET") pending++;
        else if (t.status === "DANG_THUC_HIEN") doing++;
      });

      const completionRate = total > 0 ? Math.round((done / total) * 100) : 0;
      const scopeNote = selectedDept ? `thuộc [${selectedDept.code}]` : "toàn trường";

      return [
        {
          key: "total",
          label: "Tổng công việc",
          value: total,
          iconClass: "fa-regular fa-folder-open",
          tone: "navy",
          note: `Tất cả nhiệm vụ ${scopeNote}`,
          onClick: () => {
            window.location.href = selectedDept ? `tasks-list.html?dept_id=${selectedDept.id}` : "tasks-list.html";
          },
        },
        {
          key: "doing",
          label: "Đang thực hiện",
          value: doing,
          iconClass: "fa-regular fa-clock",
          tone: "teal",
          note: "Đang triển khai",
          onClick: () => {
            const qs = selectedDept ? `status=DANG_THUC_HIEN&dept_id=${selectedDept.id}` : "status=DANG_THUC_HIEN";
            window.location.href = `tasks-list.html?${qs}`;
          },
        },
        {
          key: "pending",
          label: "Chờ nghiệm thu",
          value: pending,
          iconClass: "fa-solid fa-clipboard-check",
          tone: pending > 0 ? "amber" : "grey",
          note: "Chờ phê duyệt",
          onClick: () => {
            const qs = selectedDept ? `status=CHO_DUYET&dept_id=${selectedDept.id}` : "status=CHO_DUYET";
            window.location.href = `tasks-list.html?${qs}`;
          },
        },
        {
          key: "overdue",
          label: "Quá hạn tiến độ",
          value: overdue,
          iconClass: "fa-solid fa-triangle-exclamation",
          tone: overdue > 0 ? "red" : "grey",
          note: overdue > 0 ? "Cần xử lý gấp" : "Không có việc trễ",
          onClick: () => {
            const qs = selectedDept ? `quick_filter=overdue&dept_id=${selectedDept.id}` : "quick_filter=overdue";
            window.location.href = `tasks-list.html?${qs}`;
          },
        },
        {
          key: "done",
          label: "Đã hoàn thành",
          value: done,
          iconClass: "fa-regular fa-circle-check",
          tone: done > 0 ? "green" : "grey",
          note: `${completionRate}% đã nghiệm thu`,
          onClick: () => {
            const qs = selectedDept ? `status=HOAN_THANH&dept_id=${selectedDept.id}` : "status=HOAN_THANH";
            window.location.href = `tasks-list.html?${qs}`;
          },
        },
      ];
    }, [scopedTasks, selectedDept]);

    // 3. Status Segments
    const statusData = useMemo(() => {
      const counts = { CHUA_BAT_DAU: 0, DANG_THUC_HIEN: 0, CHO_DUYET: 0, TRE_HAN: 0, HOAN_THANH: 0, TAM_DUNG: 0 };

      scopedTasks.forEach((t) => {
        const isCompleted = t.status === "HOAN_THANH";
        const deadlineInfo =
          typeof Common !== "undefined" && Common.getDeadlineStatus
            ? Common.getDeadlineStatus(t.due_date, isCompleted)
            : { isOverdue: false };

        if (isCompleted) counts.HOAN_THANH++;
        else if (deadlineInfo.isOverdue || t.status === "TRE_HAN") counts.TRE_HAN++;
        else if (t.status === "CHO_DUYET") counts.CHO_DUYET++;
        else if (t.status === "DANG_THUC_HIEN") counts.DANG_THUC_HIEN++;
        else if (t.status === "TAM_DUNG") counts.TAM_DUNG++;
        else counts.CHUA_BAT_DAU++;
      });

      return statusConfig
        .slice()
        .sort((a, b) => (a.order || 0) - (b.order || 0))
        .map((cfg) => ({
          code: cfg.code,
          label: cfg.label,
          value: counts[cfg.code] || 0,
          color: cfg.color,
        }));
    }, [scopedTasks, statusConfig]);

    // 4. Priority Segments
    const priorityData = useMemo(() => {
      const counts = { KHAN_CAP: 0, CAO: 0, TRUNG_BINH: 0, THAP: 0 };
      scopedTasks.forEach((t) => {
        if (counts[t.priority] !== undefined) counts[t.priority]++;
      });

      return priorityConfig
        .slice()
        .sort((a, b) => (a.order || 0) - (b.order || 0))
        .map((cfg) => ({
          code: cfg.code,
          label: cfg.label,
          value: counts[cfg.code] || 0,
          color: cfg.color,
        }));
    }, [scopedTasks, priorityConfig]);

    // 5. 12 Units Progress Data
    const unitsData = useMemo(() => {
      if (selectedDept) {
        const deptId = selectedDept.id;
        const deptUsers = users.filter((u) => u.department_id === deptId);

        if (deptUsers.length > 0) {
          return deptUsers.map((u) => {
            const uTasks = scopedTasks.filter((t) => t.assignee_id === u.id);
            const total = uTasks.length;
            let doing = 0, done = 0, sumProg = 0;

            uTasks.forEach((t) => {
              sumProg += t.progress_percent || 0;
              if (t.status === "HOAN_THANH") done++;
              else if (t.status === "DANG_THUC_HIEN") doing++;
            });

            return {
              id: u.id,
              code: u.username || `U${u.id}`,
              name: u.full_name,
              total,
              doing,
              done,
              progress: total > 0 ? Math.round(sumProg / total) : 0,
              isUser: true,
            };
          });
        }

        return scopedTasks.map((t) => ({
          id: t.id,
          code: `ID #${t.id}`,
          name: t.title,
          total: 1,
          doing: t.status === "DANG_THUC_HIEN" ? 1 : 0,
          done: t.status === "HOAN_THANH" ? 1 : 0,
          progress: t.progress_percent || 0,
          isTask: true,
        }));
      }

      return departments.map((d) => {
        const dTasks = scopedTasks.filter((t) => {
          const did =
            t.leading_dept_id !== undefined && t.leading_dept_id !== null
              ? t.leading_dept_id
              : t.leading_department ? t.leading_department.id : null;
          return did === d.id;
        });

        const total = dTasks.length;
        let doing = 0, done = 0, sumProg = 0;

        dTasks.forEach((t) => {
          sumProg += t.progress_percent || 0;
          if (t.status === "HOAN_THANH") done++;
          else if (t.status === "DANG_THUC_HIEN") doing++;
        });

        return {
          id: d.id,
          code: d.code,
          name: d.name,
          total,
          doing,
          done,
          progress: total > 0 ? Math.round(sumProg / total) : 0,
          isDept: true,
        };
      });
    }, [selectedDept, departments, users, scopedTasks]);

    const active = useMemo(() => {
      return unitsData.filter((u) => u.total > 0).sort((a, b) => b.progress - a.progress);
    }, [unitsData]);

    const idle = useMemo(() => {
      return unitsData.filter((u) => u.total === 0);
    }, [unitsData]);

    const chartData = useMemo(() => {
      return active.map((u) => ({ name: u.name, progress: u.progress, total: u.total }));
    }, [active]);

    // Handle clicking a Status item
    const handleStatusClick = (statusItem) => {
      if (statusItem.code === "TRE_HAN") {
        window.location.href = "tasks-list.html?quick_filter=overdue";
      } else {
        window.location.href = `tasks-list.html?status=${statusItem.code}`;
      }
    };

    // Handle clicking a Priority item
    const handlePriorityClick = (priorityItem) => {
      window.location.href = `tasks-list.html?priority=${priorityItem.code}`;
    };

    if (loading) {
      return h(
        "div",
        { style: { padding: "40px", textAlign: "center", color: COLOR.inkMuted, fontSize: 13 } },
        h("i", { className: "fa-solid fa-circle-notch fa-spin text-xl text-[#0E7C7B] mb-2 block" }),
        "Đang nạp dữ liệu tổng quan hoạt động & tiến độ..."
      );
    }

    const scopeTitleText = selectedDept
      ? `Tổng quan tiến độ: [${selectedDept.code}] ${selectedDept.name}`
      : "Tổng quan hoạt động & tiến độ";

    const scopeSubtitleText = selectedDept
      ? `Theo dõi thực thi ${scopedTasks.length} công việc thuộc đơn vị ${selectedDept.name} — cập nhật theo thời gian thực`
      : "Theo dõi thực thi công việc của 12 đơn vị HueIC — cập nhật theo thời gian thực";

    const chartTitleText = selectedDept
      ? `Tiến độ theo Cán bộ / Nhiệm vụ [${selectedDept.code}]`
      : "Tiến độ theo đơn vị";

    const chartSubText = selectedDept
      ? `Hiển thị ${active.length} cán bộ / nhiệm vụ đang thực hiện trong đơn vị`
      : `Chỉ hiển thị ${active.length} đơn vị đang có công việc — trong tổng số 12`;

    const tableTitleText = selectedDept
      ? `Bảng theo dõi chi tiết [${selectedDept.code}] ${selectedDept.name}`
      : "Bảng theo dõi tiến độ chi tiết";

    const tableSubText = selectedDept
      ? "Chi tiết từng nhiệm vụ và cán bộ thực thi trong đơn vị"
      : "Đơn vị đang có nhiệm vụ hiển thị trước — bấm để xem việc";

    const idleButtonText = selectedDept
      ? `${idle.length} cán bộ chưa được giao nhiệm vụ`
      : `${idle.length} đơn vị chưa có công việc nào`;

    return h(
      "div",
      { style: { background: COLOR.bg, fontFamily: "Inter, sans-serif", color: COLOR.ink } },

      // Header
      h(
        "div",
        {
          style: {
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            marginBottom: 20,
            flexWrap: "wrap",
            gap: 12,
          },
        },
        h(
          "div",
          null,
          h(
            "h1",
            {
              style: {
                fontFamily: "Manrope, sans-serif",
                fontWeight: 800,
                fontSize: 22,
                margin: 0,
                color: COLOR.navy,
              },
            },
            scopeTitleText
          ),
          h(
            "p",
            { style: { margin: "4px 0 0", fontSize: 13, color: COLOR.inkMuted } },
            scopeSubtitleText
          )
        ),
        h(
          "div",
          { style: { display: "flex", alignItems: "center", gap: 8 } },
          selectedDept
            ? h(
                "button",
                {
                  onClick: () => {
                    const sel = document.getElementById("filterDept");
                    if (sel) {
                      sel.value = "";
                      sel.dispatchEvent(new Event("change"));
                    }
                    if (typeof TasksPage !== "undefined") TasksPage.loadTasks();
                  },
                  style: {
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    background: "#F1F0EB",
                    border: `1px solid ${COLOR.border}`,
                    borderRadius: 6,
                    padding: "8px 12px",
                    fontSize: 12,
                    fontWeight: 600,
                    color: COLOR.inkMuted,
                    cursor: "pointer",
                  },
                },
                h("i", { className: "fa-solid fa-xmark text-xs" }),
                "Xem toàn trường"
              )
            : null,
          h(
            "button",
            {
              onClick: loadData,
              style: {
                display: "flex",
                alignItems: "center",
                gap: 6,
                background: COLOR.surface,
                border: `1px solid ${COLOR.border}`,
                borderRadius: 6,
                padding: "8px 14px",
                fontSize: 12.5,
                fontWeight: 600,
                color: COLOR.ink,
                cursor: "pointer",
              },
            },
            h("i", { className: "fa-solid fa-rotate-right text-xs" }),
            " Làm mới"
          ),
          h(
            "button",
            {
              onClick: () => {
                window.location.href = "tasks-list.html";
              },
              style: {
                display: "flex",
                alignItems: "center",
                gap: 6,
                background: COLOR.navy,
                border: "none",
                borderRadius: 6,
                padding: "8px 14px",
                fontSize: 12.5,
                fontWeight: 600,
                color: "#fff",
                cursor: "pointer",
              },
            },
            "Danh sách công việc"
          )
        )
      ),

      // 5 KPI Cards Strip
      h(
        "div",
        { style: { display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" } },
        kpis.map((k) =>
          h(KpiCard, {
            key: k.label,
            item: k,
            onClick: k.onClick,
          })
        )
      ),

      // Main Grid (300px 1fr)
      h(
        "div",
        {
          style: {
            display: "grid",
            gridTemplateColumns: window.innerWidth >= 1024 ? "300px 1fr" : "1fr",
            gap: 16,
            alignItems: "start",
          },
        },

        // Left column
        h(
          "div",
          { style: { display: "flex", flexDirection: "column", gap: 16 } },
          h(StackedBar, {
            data: statusData,
            title: "Cơ cấu tình trạng",
            sub: selectedDept
              ? `Toàn bộ ${scopedTasks.length} việc thuộc [${selectedDept.code}]`
              : `Toàn bộ ${scopedTasks.length} công việc, cấp toàn trường`,
            onItemClick: handleStatusClick,
          }),
          h(StackedBar, {
            data: priorityData,
            title: "Phân bổ ưu tiên",
            sub: selectedDept ? `Theo mức độ ưu tiên [${selectedDept.code}]` : "Theo mức độ khẩn cấp",
            onItemClick: handlePriorityClick,
          })
        ),

        // Right column
        h(
          "div",
          { style: { display: "flex", flexDirection: "column", gap: 16 } },

          // Chart Card
          h(
            "div",
            {
              style: {
                background: COLOR.surface,
                border: `1px solid ${COLOR.border}`,
                borderRadius: 6,
                padding: 18,
                boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
              },
            },
            h(
              "div",
              { style: { display: "flex", justifyContent: "space-between", alignItems: "baseline" } },
              h(
                "div",
                null,
                h("div", { style: { fontFamily: "Manrope, sans-serif", fontWeight: 700, fontSize: 14.5 } }, chartTitleText),
                h("div", { style: { fontSize: 11.5, color: COLOR.inkMuted, marginTop: 2 } }, chartSubText)
              )
            ),
            active.length > 0 && typeof BarChart !== "undefined"
              ? h(
                  "div",
                  { style: { height: Math.max(active.length * 44, 90), marginTop: 12 } },
                  h(
                    ResponsiveContainer,
                    { width: "100%", height: "100%" },
                    h(
                      BarChart,
                      { data: chartData, layout: "vertical", margin: { left: 8, right: 24, top: 4, bottom: 4 } },
                      h(CartesianGrid, { strokeDasharray: "3 3", horizontal: false, stroke: COLOR.border }),
                      h(XAxis, {
                        type: "number",
                        domain: [0, 100],
                        tick: { fontSize: 11, fill: COLOR.inkMuted },
                        tickFormatter: (v) => `${v}%`,
                        axisLine: { stroke: COLOR.border },
                        tickLine: false,
                      }),
                      h(YAxis, {
                        type: "category",
                        dataKey: "name",
                        width: 190,
                        tick: { fontSize: 12, fill: COLOR.ink, fontWeight: 500 },
                        axisLine: { stroke: COLOR.border },
                        tickLine: false,
                      }),
                      h(Tooltip, { cursor: { fill: "rgba(20,30,50,0.04)" }, content: h(CustomTooltip) }),
                      h(
                        Bar,
                        {
                          dataKey: "progress",
                          radius: [0, 4, 4, 0],
                          barSize: 18,
                          onClick: (data) => {
                            if (data) {
                              const found = active.find((u) => u.name === data.name);
                              if (found && found.isDept) {
                                window.location.href = `tasks-list.html?dept_id=${found.id}`;
                              } else {
                                window.location.href = "tasks-list.html";
                              }
                            }
                          },
                        },
                        chartData.map((d, i) =>
                          h(Cell, { key: i, fill: d.progress >= 50 ? COLOR.teal : COLOR.amber, cursor: "pointer" })
                        )
                      )
                    )
                  )
                )
              : h(
                  "div",
                  { style: { padding: "24px 0", textAlign: "center", color: COLOR.inkMuted, fontSize: 12.5, fontStyle: "italic" } },
                  "Chưa có nhiệm vụ nào phát sinh trong phạm vi đã chọn."
                )
          ),

          // Table Card (100% Original HueIC Detailed Units Table)
          h(
            "div",
            {
              style: {
                background: COLOR.surface,
                border: `1px solid ${COLOR.border}`,
                borderRadius: 6,
                overflow: "hidden",
                boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
              },
            },
            h(
              "div",
              { style: { padding: "16px 18px 8px" } },
              h("div", { style: { fontFamily: "Manrope, sans-serif", fontWeight: 700, fontSize: 14.5 } }, tableTitleText),
              h("div", { style: { fontSize: 11.5, color: COLOR.inkMuted, marginTop: 2 } }, tableSubText)
            ),
            h(
              "table",
              { style: { width: "100%", borderCollapse: "collapse", fontSize: 13 } },
              h(
                "thead",
                null,
                h(
                  "tr",
                  { style: { borderTop: `1px solid ${COLOR.border}`, borderBottom: `1px solid ${COLOR.border}` } },
                  [
                    selectedDept ? "Mã / ID" : "Mã",
                    selectedDept ? "Cán bộ / Nhiệm vụ" : "Đơn vị / Phòng / Khoa",
                    "Tổng việc",
                    "Đang làm",
                    "Hoàn thành",
                    "Tiến độ",
                    "",
                  ].map((header, idx) =>
                    h(
                      "th",
                      {
                        key: header + idx,
                        style: {
                          textAlign: "left",
                          padding: "9px 18px",
                          fontSize: 11.5,
                          color: COLOR.inkMuted,
                          fontWeight: 600,
                          whiteSpace: "nowrap",
                        },
                      },
                      header
                    )
                  )
                )
              ),
              h(
                "tbody",
                null,
                active.length > 0
                  ? active.map((u) =>
                      h(
                        "tr",
                        { key: u.code + u.id, style: { borderBottom: `1px solid ${COLOR.border}` }, className: "hover:bg-slate-50" },
                        h(
                          "td",
                          { style: { padding: "11px 18px" } },
                          h(
                            "span",
                            {
                              style: {
                                background: COLOR.tealSoft,
                                color: COLOR.teal,
                                fontSize: 11,
                                fontWeight: 700,
                                padding: "2px 7px",
                                borderRadius: 4,
                                fontFamily: "monospace",
                              },
                            },
                            u.code
                          )
                        ),
                        h("td", { style: { padding: "11px 18px", fontWeight: 500 } }, u.name),
                        h("td", { style: { padding: "11px 18px", fontWeight: 700 } }, u.total),
                        h("td", { style: { padding: "11px 18px", color: COLOR.teal, fontWeight: 700 } }, u.doing),
                        h("td", { style: { padding: "11px 18px", color: COLOR.green, fontWeight: 700 } }, u.done),
                        h("td", { style: { padding: "11px 18px", minWidth: 160 } }, h(ProgressCell, { value: u.progress })),
                        h(
                          "td",
                          { style: { padding: "11px 18px" } },
                          h(
                            "button",
                            {
                              onClick: () => {
                                if (u.isDept) {
                                  window.location.href = `tasks-list.html?dept_id=${u.id}`;
                                } else {
                                  window.location.href = `tasks-list.html?search=${encodeURIComponent(u.name)}`;
                                }
                              },
                              style: {
                                background: "transparent",
                                border: "none",
                                color: COLOR.teal,
                                fontSize: 12.5,
                                fontWeight: 600,
                                display: "flex",
                                alignItems: "center",
                                gap: 4,
                                cursor: "pointer",
                                padding: 0,
                              },
                            },
                            h("span", null, "Xem việc"),
                            h("i", { className: "fa-solid fa-arrow-up-right-from-square text-[10px]" })
                          )
                        )
                      )
                    )
                  : h(
                      "tr",
                      null,
                      h(
                        "td",
                        { colSpan: 7, style: { padding: "20px", textAlign: "center", color: COLOR.inkMuted, fontStyle: "italic" } },
                        "Chưa có dữ liệu nào trong phạm vi đã chọn."
                      )
                    )
              )
            ),

            // Collapsed Idle Accordion Button
            idle.length > 0
              ? h(
                  "button",
                  {
                    onClick: () => setShowIdle(!showIdle),
                    style: {
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "10px 18px",
                      background: "#FAFAF7",
                      border: "none",
                      borderTop: `1px solid ${COLOR.border}`,
                      fontSize: 12.5,
                      color: COLOR.inkMuted,
                      fontWeight: 600,
                      cursor: "pointer",
                      textAlign: "left",
                    },
                  },
                  h("i", { className: `fa-solid ${showIdle ? "fa-chevron-down" : "fa-chevron-right"} text-xs` }),
                  h("span", null, idleButtonText)
                )
              : null,
            showIdle && idle.length > 0
              ? h(
                  "table",
                  { style: { width: "100%", borderCollapse: "collapse", fontSize: 12.5 } },
                  h(
                    "tbody",
                    null,
                    idle.map((u) =>
                      h(
                        "tr",
                        { key: u.code + u.id, style: { borderBottom: `1px solid ${COLOR.border}` }, className: "hover:bg-slate-50" },
                        h(
                          "td",
                          { style: { padding: "8px 18px", width: 70 } },
                          h(
                            "span",
                            {
                              style: {
                                background: "#EFEEE9",
                                color: COLOR.inkMuted,
                                fontSize: 10.5,
                                fontWeight: 700,
                                padding: "2px 7px",
                                borderRadius: 4,
                              },
                            },
                            u.code
                          )
                        ),
                        h("td", { style: { padding: "8px 18px", color: COLOR.inkMuted, fontWeight: 500 } }, u.name),
                        h("td", { style: { padding: "8px 18px", color: COLOR.grey, textAlign: "right", fontStyle: "italic" } }, "Chưa có việc")
                      )
                    )
                  )
                )
              : null
          )
        )
      )
    );
  }

  // ---------------------------------------------------------------------------
  // Global Mount Handler
  // ---------------------------------------------------------------------------
  function mountTaskExecutiveDashboard() {
    const rootEl = document.getElementById("tasks-react-dashboard");
    if (!rootEl) return;
    if (typeof ReactDOM !== "undefined" && ReactDOM.createRoot) {
      if (!window._taskDashboardRoot) {
        window._taskDashboardRoot = ReactDOM.createRoot(rootEl);
      }
      window._taskDashboardRoot.render(h(ExecutiveDashboardApp));
    }
  }

  window.mountTaskExecutiveDashboard = mountTaskExecutiveDashboard;

  // Auto mount on load
  if (document.readyState === "complete" || document.readyState === "interactive") {
    setTimeout(mountTaskExecutiveDashboard, 10);
  } else {
    document.addEventListener("DOMContentLoaded", () => {
      setTimeout(mountTaskExecutiveDashboard, 10);
    });
  }
})();
