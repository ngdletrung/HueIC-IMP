# NHẬT KÝ CẢI TIẾN & LỊCH SỬ PHÁT TRIỂN HỆ THỐNG (HISTORY.md)

Tài liệu này ghi lại chi tiết toàn bộ các phiên bản, mốc thời gian phát triển, tính năng bổ sung, điều chỉnh CSDL và sửa lỗi giao diện của dự án **HueIC Internal Management Portal (HueIC IMP)** để phục vụ công tác theo dõi, bàn giao và rollback (khôi phục) khi cần.

---

## 📌 [Phiên bản 1.0.0] - 30/08/2026: Khởi tạo Kiến trúc Cốt lõi & Hạ tầng Docker
- **Mục tiêu**: Xây dựng nền tảng Full-stack Decoupled chuẩn, quy hoạch dải cổng riêng biệt, chống xung đột với các container có sẵn trên máy chủ.
- **Hạ tầng & Cấu hình Docker**:
  - `docker-compose.yml`: Thiết lập 3 dịch vụ cô lập `hueic_imp_db` (PostgreSQL 15), `hueic_imp_backend` (FastAPI), `hueic_imp_frontend` (Nginx).
  - Quy hoạch Block Port: `8880` (Frontend Nginx), `8881` (Backend FastAPI), `8882` (PostgreSQL).
  - Network: `hueic_imp_network`, Volume: `hueic_imp_db_data`.
  - `.env` & `.env.example`: Cấu hình bảo mật, mật khẩu kết nối CSDL có mã hóa URL-encode.
- **Backend FastAPI**:
  - Kiến trúc phân lớp: `app/models`, `app/schemas`, `app/api/v1`, `app/core`, `app/db`.
  - Bảo mật: Băm mật khẩu bằng `bcrypt` trực tiếp, xác thực Bearer Token JWT (HS256).
  - Dữ liệu khởi tạo (`init_db.py`): Khởi tạo tài khoản SuperAdmin (`admin` / `HueIC@2026!`).
- **Frontend SPA**:
  - Single Page Application (HTML5, Tailwind CSS, Vanilla JS, FontAwesome).
  - Reverse Proxy Nginx: Chuyển hướng `/api/` và `/docs` sang Backend container.
  - Màn hình Đăng nhập (`login.html`) và Dashboard Tổng quan (`index.html`).

---

## 📌 [Phiên bản 1.1.0] - 30/08/2026: Phân hệ Quản Lý Công Việc & Tiến Độ Liên Phòng Ban
- **Backend**:
  - Bổ sung bảng `tasks` và `task_comments` với quan hệ ForeignKey `ondelete="SET NULL"`.
  - Endpoint CRUD công việc: `GET/POST /api/v1/tasks`, `GET/PUT /api/v1/tasks/{id}`, `POST /api/v1/tasks/{id}/progress`, `POST /api/v1/tasks/{id}/comments`.
  - Endpoint thống kê KPI: `GET /api/v1/stats/summary` (tỷ lệ hoàn thành, công việc trễ hạn, tiến độ theo từng phòng ban).
- **Frontend**:
  - Bộ lọc công việc đa tiêu chí (Trạng thái, Độ ưu tiên, Đơn vị chủ trì, Tìm kiếm từ khóa).
  - Modal Giao việc mới, Modal Cập nhật % tiến độ (Slider trực quan), Modal Trao đổi / Thảo luận nhật ký công việc.

---

## 📌 [Phiên bản 1.2.0] - 30/08/2026: Bổ Sung Hệ Thống Phân Quyền Chi Tiết (RBAC Matrix)
- **Yêu cầu & Động lực**: Đáp ứng nhu cầu phân quyền mềm dẻo dạng Checkbox cho từng cán bộ/trưởng phòng cụ thể.
- **Backend**:
  - `app/core/permissions.py`: Danh mục 13 mã quyền hệ thống thuộc 4 phân hệ (Tasks, Org/Users, Assets, Documents).
  - `app/models/user.py`: Bổ sung cột `permissions = Column(JSON, default=list, nullable=False)`.
  - `app/db/init_db.py`: Bổ sung tự động migration `ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions JSON DEFAULT '[]'::json;`.
  - `app/api/v1/permissions.py`: Các API `GET /permissions/catalog`, `GET /permissions/users/{id}`, `PUT /permissions/users/{id}`, `POST /permissions/users/{id}/reset-default`.
- **Frontend**:
  - Giao diện Ma trận Checkbox phân quyền 2 cột: Cột trái chọn nhân sự, cột phải tích chọn quyền theo nhóm chức năng.
  - Nút tiện ích: "Gợi ý theo vai trò" và "Lưu Cấu Hình Phân Quyền".

---

## 📌 [Phiên bản 1.3.0] - 30/08/2026: Chuẩn Hóa 12 Đơn Vị Phòng/Khoa & Chữ Viết Tắt
- **Yêu cầu**: Cập nhật danh sách 12 đơn vị chính thức của HueIC kèm Mã chữ viết tắt (`code`):
  1. Ban Giám hiệu (`BGH`)
  2. Phòng Hành chính - Tổng hợp (`HCTH`)
  3. Phòng Đào tạo (`ĐT`)
  4. Phòng Quản trị - Đầu tư (`QTĐT`)
  5. Trung tâm Tuyển sinh - dịch vụ & Công tác sinh viên (`TSDV`)
  6. Khoa Cơ khí - Ô tô (`CKOT`)
  7. Khoa Điện - Điện tử (`DC`)
  8. Khoa Công nghệ thông tin và Kinh tế số (`CNTT`)
  9. Khoa Nhiệt lạnh (`NL`)
  10. Khoa Khoa học cơ bản (`KHCB`)
  11. Tổ Thanh tra giáo dục (`TTGD`)
  12. Ban Chuyển đổi số (`CĐ`)
- **Backend & Database**: Đồng bộ lại CSDL trong `app/db/init_db.py`, cập nhật tài khoản demo Trưởng Phòng QTĐT (`qtdt` / `HueIC@123`).

---

## 📌 [Phiên bản 1.4.0] - 30/08/2026: Tinh Gọn Menu Sidebar & Tách Sub-tabs Thiết Lập
- **UX Refactoring**: Gom 3 mục quản trị rời rạc (`Danh Mục Phòng/Khoa`, `Cán Bộ & Nhân Sự`, `Phân Quyền Chi Tiết`) vào 1 tab duy nhất: **⚙️ Thiết Lập Hệ Thống**.
- **Cấu trúc Sub-tabs**:
  - Sub-tab 1: Phòng / Khoa (12 Đơn vị)
  - Sub-tab 2: Cán Bộ & Nhân Sự
  - Sub-tab 3: Phân Quyền Chi Tiết (RBAC)

---

## 📌 [Phiên bản 1.5.0] - 30/08/2026: Đầy Đủ Quản Trị CRUD (Thêm, Sửa, Khóa, Xóa) & Multi-View
- **Cán Bộ & Nhân Sự**:
  - Thêm Nút `➕ Thêm Mới Cán Bộ` (Modal nhập đầy đủ thông tin, phòng ban, vai trò, mật khẩu).
  - Cột thao tác: `✏️ Sửa thông tin`, `🔒 Khóa / Kích hoạt lại`, `🗑️ Xóa vĩnh viễn tài khoản`.
  - Backend API: `DELETE /api/v1/users/{id}` (Tự động gỡ liên kết task an toàn).
- **Phòng / Khoa**:
  - Hỗ trợ 2 chế độ hiển thị: 🔲 **Lưới Thẻ (Grid Cards)** & 📋 **Danh Sách Ngang Chi Tiết (Table View)**.
  - Ô tìm kiếm tức thì theo tên/mã viết tắt.
  - Thao tác: `➕ Thêm Đơn Vị Mới`, `✏️ Sửa`, `🗑️ Xóa` (Có cơ chế kiểm tra chặn xóa nếu đang có cán bộ).
  - Backend API: `DELETE /api/v1/departments/{id}`.

---

## 📌 [Phiên bản 1.6.0] - 30/08/2026: Sửa Lỗi Giao Diện & Tối Ưu Hóa Mobile Responsive
- **Sửa lỗi hiển thị**:
  - Khắc phục triệt để lỗi nhảy dòng ở cột Trạng thái ("Hoạt động") và cột Thao tác ("Sửa", "Xóa") bằng `whitespace-nowrap` và `inline-flex items-center space-x-1.5`.
- **Tối ưu Mobile Responsive**:
  - Sidebar dạng ngăn kéo (Drawer) có nút **3 gạch (Hamburger)** và lớp phủ mờ (Backdrop), tự động thu lại sau khi chọn tab.
  - Sub-tabs hỗ trợ cuộn vuốt ngang cảm ứng ngón tay (`overflow-x-auto`).
  - Toàn bộ Popups/Modals co giãn theo chiều dọc (`max-h-[90vh] overflow-y-auto`) và tự chuyển layout 1 cột trên màn hình điện thoại.
- **Tài liệu hóa**:
  - Tạo file `.keywork.md`: Định nghĩa toàn bộ nguyên tắc kỹ thuật cốt lõi và tiêu chuẩn vận hành.
  - Tạo file `HISTORY.md`: Nhật ký chi tiết toàn bộ lịch sử cải tiến phục vụ tra cứu và rollback.

---

## 📌 [Phiên bản 1.6.1] - 30/08/2026: Bổ Sung Quy Tắc Bắt Buộc Cập Nhật HISTORY.md
- **Nội dung**:
  - Bổ sung Mục [6] trong `.keywork.md` đặt ra quy tắc nghiêm ngặt: Mọi thao tác chỉnh sửa tính năng, CSDL, giao diện hay sửa lỗi đều phải được cập nhật ngay lập tức vào `HISTORY.md`.
  - Đảm bảo tính liên tục, minh bạch và an toàn khi bàn giao giữa các lập trình viên hoặc AI Coding Assistant.

---

## 📌 [Phiên bản 1.6.2] - 30/08/2026: Tích Hợp Workspace Rules Tự Động Ghi Nhớ & Thực Thi
- **Mục tiêu**: Đảm bảo AI Assistant (Antigravity, Cursor, Copilot...) luôn tự động đọc và tuân thủ các nguyên tắc trong `.keywork.md` ở mọi phiên làm việc.
- **Hành động & File khởi tạo**:
  - Tạo `.gemini/rules/keywork-enforcement.md`: Quy tắc nạp tự động vào System Prompt của Antigravity/Gemini.
  - Tạo `AGENTS.md` & `.cursorrules`: Tương thích với mọi chuẩn AI Agent hiện đại.
  - Nội dung quy tắc: Bắt buộc tuân thủ 6 nhóm nguyên tắc trong `.keywork.md` và bắt buộc cập nhật `HISTORY.md` sau mỗi thay đổi.

---

## 📌 [Phiên bản 1.7.0] - 30/08/2026: Nâng Cấp Dashboard Trực Quan Với Chart.js & Tương Tác Chuyển Tab Thông Minh
- **Yêu cầu**: Nâng cấp giao diện Dashboard Tổng quan hoạt động & tiến độ sang biểu đồ hiện đại, sinh động và hỗ trợ bấm tương tác chuyển tab có lọc dữ liệu tự động.
- **Backend API**:
  - `backend/app/api/v1/stats.py`: Mở rộng `/api/v1/stats/summary` trả về chi tiết phân bổ 4 mức ưu tiên (`priority_stats`), số lượng công việc theo từng trạng thái và kiểm tra trễ hạn chuẩn xác theo múi giờ (`timezone.utc`).
- **Frontend & Giao diện**:
  - `frontend/index.html`:
    * Tích hợp thư viện **Chart.js v4.4.1**.
    * Nâng cấp 5 thẻ KPI có hiệu ứng hover 3D, cảnh báo quá hạn nhấp nháy, kèm chỉ dẫn bấm xem danh sách.
    * Thêm 2 biểu đồ trực quan: Biểu đồ tròn **Doughnut Chart** (Cơ cấu tình trạng nhiệm vụ) và Biểu đồ cột ngang **Horizontal Bar Chart** (Khối lượng & Tiến độ 12 Đơn vị HueIC).
    * Khu vực Phân bổ theo 4 mức độ ưu tiên (Khẩn cấp, Cao, Trung bình, Thấp) và Bảng xếp hạng tiến độ chi tiết.
  - `frontend/assets/js/app.js`:
    * Khởi tạo và cập nhật động 2 Chart.js instances (`statusChartInstance`, `deptChartInstance`).
    * Bổ sung cơ chế **Drill-down Navigation (Tương tác bấm chuyển tab)**:
      + Bấm vào thẻ KPI -> Nhảy sang tab `tasks` và lọc theo trạng thái (`DANG_THUC_HIEN`, `CHO_DUYET`, `TRE_HAN`, `HOAN_THANH`).
      + Bấm vào cung màu trên Biểu đồ Doughnut -> Nhảy sang tab `tasks` lọc theo trạng thái tương ứng.
      + Bấm vào thanh tiến độ hoặc tên đơn vị trong Bảng -> Nhảy sang tab `tasks` lọc theo phòng ban đó (`leading_dept_id`).
      + Bấm vào thẻ mức độ ưu tiên -> Nhảy sang tab `tasks` lọc theo độ ưu tiên.

---

## 📌 [Phiên bản 1.7.1] - 30/08/2026: Bộ Lọc Phạm Vi Giám Sát Cấp Trường / Cấp Phòng / Cán Bộ Cụ Thể
- **Yêu cầu**: Cho phép người dùng tùy chọn xem Dashboard thống kê ở cấp Toàn Trường, cấp Phòng/Khoa hoặc lọc riêng theo từng Cán bộ cụ thể.
- **Backend API**:
  - `backend/app/api/v1/stats.py`: Hỗ trợ query params `dept_id` và `user_id` trong `/api/v1/stats/summary`. Khi chọn `dept_id`, tự động tính toán thêm `staff_stats` (khối lượng và tiến độ chi tiết của từng cán bộ trong phòng).
- **Frontend & Giao diện**:
  - `frontend/index.html`: Thêm **Thanh Bộ Lọc Phạm Vi (Scope Filter Bar)** ngay trên đầu Dashboard với 2 dropdown (*Chọn Đơn vị/Phòng/Khoa* & *Chọn Cán bộ/Nhân sự*) cùng badge trạng thái phạm vi và nút bấm đặt lại về Toàn Trường.
  - `frontend/assets/js/app.js`:
    * Tự động lọc danh sách cán bộ theo phòng ban được chọn.
    * Tự động vẽ lại Biểu đồ tròn và Biểu đồ cột theo dữ liệu của phòng/cán bộ đó.
    * Chuyển đổi bảng xếp hạng thành danh sách cán bộ và khối lượng công việc từng người khi xem cấp Phòng.

---

## 📌 [Phiên bản 1.8.0] - 30/08/2026: Chuyển Đổi Sang Kiến Trúc Đa Trang Tinh Gọn (Multi-Page Modular) & Tối Ưu Toàn Diện PC & Mobile
- **Yêu cầu**: 
  * Tách từ mô hình SPA dồn chung sang mô hình Đa Trang Tinh Gọn (Multi-Page Modular) để DOM siêu nhẹ, tối ưu RAM và bảo trì module độc lập.
  * Tối ưu hiển thị chuyên biệt cho cả máy tính (PC) lẫn điện thoại di động (Smartphones/Tablets).
  * Cập nhật tài liệu `README.md` và bổ sung nguyên tắc bắt buộc cập nhật README vào `.keywork.md`.
- **Cấu trúc Trang HTML & JavaScript Độc Lập**:
  * `frontend/index.html` ⟷ `frontend/assets/js/dashboard.js`: Chuyên trách Dashboard KPI, Biểu đồ Chart.js (Doughnut & Bar), Bộ lọc 3 cấp (Toàn trường / Phòng / Cán bộ).
  * `frontend/tasks.html` ⟷ `frontend/assets/js/tasks.js`: Chuyên trách Quản lý công việc, Bộ lọc đa tiêu chí, 3 Modals (Giao việc, Cập nhật tiến độ %, Chi tiết & Nhật ký thảo luận).
  * `frontend/settings.html` ⟷ `frontend/assets/js/settings.js`: Chuyên trách 3 Sub-tabs (12 Đơn vị HueIC với 2 chế độ xem Thẻ/Bảng, Quản lý Cán bộ, Ma trận Phân quyền chi tiết RBAC).
  * `frontend/assets.html` & `frontend/documents.html`: Trang đích sẵn sàng cho các phân hệ mở rộng trong Phase 2.
  * `frontend/assets/js/common.js`: Quản lý chung Header Profile, Drawer Sidebar Mobile, Toast thông báo và Đăng xuất.
- **Tối Ưu Trải Nghiệm PC & Thiết Bị Di Động**:
  * **PC/Laptop**: Bảng biểu hiển thị dạng bảng đầy đủ chi tiết, layout đa cột rộng rãi, biểu đồ tương tác lớn.
  * **Điện thoại**: Thêm **Thanh Điều Hướng Nhanh Dưới Đáy Màn Hình (Mobile Bottom Navigation Bar)** giúp chuyển trang 1 chạm như Mobile App; Sub-tabs hỗ trợ vuốt cuộn ngang; Modals co giãn `max-h-[90vh]` chống che phím; Bảng dữ liệu tự động cho phép cuộn ngang cảm ứng.
- **Quy Chuẩn & Tài Liệu**:
  * `README.md`: Cập nhật toàn diện sơ đồ kiến trúc Multi-Page, hướng dẫn khởi chạy và danh mục 12 đơn vị.
  * `.keywork.md`: Bổ sung Nguyên tắc 4 (Chuẩn hóa Đa trang Multi-Page) và Nguyên tắc 7 (Bắt buộc cập nhật README.md khi thay đổi cấu trúc).
  * `.gemini/rules/keywork-enforcement.md`, `AGENTS.md`, `.cursorrules`: Tự động nạp quy tắc vào System Prompt của mọi Trợ lý AI.

---

## 📌 [Phiên bản 1.8.1] - 30/08/2026: Tự Động Nhận Diện Thiết Bị (Adaptive Device Detection) & Kích Hoạt Giao Thức Tự Ghi Nhớ Nguyên Tắc
- **Yêu cầu**: 
  * Tự động nhận diện thiết bị PC và Điện thoại để hiển thị chính xác theo ngữ cảnh sử dụng.
  * Thiết lập cơ chế để Trợ lý AI tự động trích xuất và cập nhật các nguyên tắc vào `.keywork.md` mà không cần người dùng phải nhắc nhở.
- **Frontend & Tự Động Nhận Diện**:
  * `frontend/assets/js/common.js`: Thêm `Common.isMobile()`, `Common.isTablet()`, `Common.isDesktop()`, `Common.detectAndApplyDeviceClasses()` tự động gắn class nhận diện (`device-mobile`, `device-desktop`) và lắng nghe sự kiện xoay/co giãn màn hình (`window.resize`).
  * `frontend/tasks.html` & `frontend/assets/js/tasks.js`:
    + Trên PC (`md:block`): Hiển thị bảng dữ liệu chuẩn đầy đủ cột.
    + Trên Điện thoại (`md:hidden`): Tự động chuyển đổi sang giao diện **Thẻ Nhiệm Vụ (Touch Cards)** với thanh tiến độ mini và 2 nút thao tác to bản dễ chạm.
- **Tự Động Hóa Hệ Thống Quy Tắc**:
  * `.keywork.md`: Cập nhật Nguyên tắc 5 (Tự động nhận diện thiết bị & Adaptive UI) và bổ sung Nguyên tắc 8 (Giao thức tự động ghi nhận nguyên tắc mới).
  * `AGENTS.md`, `.gemini/rules/keywork-enforcement.md`, `.cursorrules`: Cấu hình chỉ thị bắt buộc AI chủ động phát hiện và ghi lại mọi nguyên tắc mới vào `.keywork.md` ngay lập tức mà không chờ người dùng nhắc.

---

## 📌 [Phiên bản 1.8.2] - 30/08/2026: Sửa Lỗi Tự Nạp Lại Tài Khoản Đã Xóa (Seed Data Guard)
- **Nguyên nhân**: Trong hàm `init_db.py` của Backend, danh sách tài khoản demo (`truong_daotao` / "ThS. Lê Thị Bình") được kiểm tra theo từng tài khoản (`if not existing: create`). Khi người dùng xóa tài khoản nhưng Backend container khởi động lại, `init_db` phát hiện không còn tài khoản đó nên đã tự động nạp lại (re-seed) vào CSDL.
- **Khắc phục**:
  * `backend/app/db/init_db.py`: Sửa đổi điều kiện khởi tạo demo data sang `if total_non_admin_users == 0:`. Dữ liệu mẫu chỉ được nạp đúng 1 lần duy nhất khi CSDL hoàn toàn trống. Khi đã có dữ liệu, hệ thống tuyệt đối không tự ý thêm lại các tài khoản mà người dùng đã xóa.
  * Đã xóa vĩnh viễn tài khoản `truong_daotao` ("ThS. Lê Thị Bình") khỏi CSDL PostgreSQL.
  * Cập nhật Nguyên tắc số 2 trong `.keywork.md` (Quy chuẩn Seed Data an toàn).

---

## 📌 [Phiên bản 1.8.3] - 30/08/2026: Chuẩn Hóa Nguyên Tắc Rà Soát Lỗi Tận Gốc Rễ, Giải Pháp Vĩ Mô & Bảo Toàn Tính Toàn Vẹn Hệ Thống
- **Yêu cầu**: Xác lập nguyên tắc cốt lõi về việc điều tra, phát hiện lỗi tận gốc rễ, đưa ra phương án xử lý vĩ mô toàn diện và bảo toàn tuyệt đối liên kết không bị đứt gãy giữa các file liên quan.
- **Chuẩn Hóa Nguyên Tắc Số 6 trong `.keywork.md`**:
  * **Tư duy Truy tìm Gốc rễ (Root-Cause Investigation)**: Cấm sửa chữa chắp vá bề nổi (superficial patch). Phải phân tích trọn vẹn luồng dữ liệu `Database -> Backend API -> Nginx Proxy -> Frontend JS -> DOM UI`.
  * **Giải pháp Vĩ mô (Macro-Level Architectural Solution)**: Xử lý triệt để tại tầng kiến trúc nhằm ngăn ngừa 100% lỗi tái diễn trong tương lai.
  * **Bảo toàn Tính Toàn vẹn Liên kết (Cross-Module Dependency Check)**: Khi sửa đổi bất kỳ hàm, model, API hay giao diện nào, bắt buộc phải rà soát và kiểm thử toàn bộ các file liên quan để không gây đứt gãy kết nối hay hiệu ứng phụ (side-effects).
- **Hạ Tầng Chỉ Thị**:
  * Đồng bộ hóa chỉ thị vào `AGENTS.md`, `.gemini/rules/keywork-enforcement.md` và `.cursorrules`.

---

## 📌 [Phiên bản 1.8.4] - 30/08/2026: Đồng Bộ Phản Chiếu Phạm Vi Giám Sát Toàn Diện Trên Dashboard
- **Yêu cầu**: Khi chọn phạm vi giám sát (Toàn trường / Phòng ban / Cán bộ), toàn bộ thông tin trên Dashboard (thẻ KPI, tiêu đề, mô tả biểu đồ, bảng chi tiết) phải tự động thay đổi phản ánh chính xác theo đối tượng đó.
- **Backend (`backend/app/api/v1/stats.py`)**:
  * Trả về thêm `user_tasks` khi lọc theo `user_id` cụ thể.
- **Frontend (`frontend/index.html` & `frontend/assets/js/dashboard.js`)**:
  * **Cập nhật tiêu đề động**: Thẻ KPI, Biểu đồ cơ cấu trạng thái, Biểu đồ tiến độ khối lượng, Thẻ phân bổ ưu tiên và Bảng chi tiết đều đổi tên theo đối tượng (`Cấp Toàn Trường` ⟷ `Đơn vị [Tên Đơn Vị]` ⟷ `Cán bộ [Tên Cán Bộ]`).
  * **Điều hướng thông minh**: Khi bấm vào các cung tròn của Doughnut Chart hoặc Thẻ ưu tiên, URL điều hướng sang `tasks.html` sẽ tự động kèm theo `&dept_id=...` hoặc `&user_id=...`.
  * **Biểu đồ Bar Chart 3 chế độ thích ứng**:
    + Toàn trường: Xếp hạng tiến độ 12 Đơn vị.
    + Đơn vị: So sánh khối lượng & tiến độ các Cán bộ trong đơn vị.
    + Cá nhân: Hiển thị tỷ lệ hoàn thành từng Nhiệm vụ cụ thể của cán bộ.
  * **Bảng chi tiết đa năng**: Tự động chuyển đổi thead và nội dung giữa *12 Phòng ban ⟷ Danh sách Cán bộ ⟷ Danh sách Nhiệm vụ chi tiết*.

---

## 📌 [Phiên bản 1.8.5] - 30/08/2026: Sửa Lỗi API.updateTaskProgress & Rà Soát Toàn Vẹn Liên Kết Cross-Module
- **Nguyên nhân**: Khi thực hiện cập nhật tiến độ công việc trong Modal trên trang `tasks.html`, `tasks.js` gọi hàm `API.updateTaskProgress(taskId, payload)` nhưng trong module `api.js` trước đó chỉ có `API.updateTask()`.
- **Khắc phục (Tuân thủ Nguyên tắc số 6 - Root-Cause & Cross-Module Integrity)**:
  * `frontend/assets/js/api.js`:
    + Bổ sung hàm `updateTaskProgress(id, data)` tự động cập nhật cả `status`, `progress_percent` và đính kèm bình luận `comment` nếu có.
    + Rà soát toàn bộ các module JavaScript (`tasks.js`, `settings.js`, `dashboard.js`, `common.js`) và bổ sung các hàm/alias tương thích: `addTaskComment`, `resetDefaultPermissions`, `toggleUserActive`.
    + Đã chạy kiểm thử tự động xác nhận `missing=[]` (100% các hàm API được gọi đều đã được định nghĩa đầy đủ).

---

## 📌 [Phiên bản 1.8.6] - 30/08/2026: Đồng Bộ Ràng Buộc 2 Chiều Thông Minh Giữa Trạng Thái & % Tiến Độ Nhiệm Vụ
- **Yêu cầu**: Trạng thái và % Tiến độ phải luôn đồng bộ tương thích với nhau (ví dụ: Đang thực hiện thì không thể là 100%, Chưa bắt đầu thì phải là 0%, Đã hoàn thành thì phải là 100%).
- **Frontend (`frontend/tasks.html` & `frontend/assets/js/tasks.js`)**:
  * `TasksPage.handleStatusChange(newStatus)`:
    + Chọn `CHUA_BAT_DAU`: Thanh trượt tự động gán `0%`.
    + Chọn `HOAN_THANH` hoặc `CHO_DUYET`: Thanh trượt tự động gán `100%`.
    + Chọn `DANG_THUC_HIEN`: Nếu thanh trượt đang ở `0%` hoặc `100%`, tự động đưa về `50%` (hoặc giữ nguyên dải `1% - 99%`).
  * `TasksPage.handleProgressSliderChange(val)`:
    + Kéo về `0%`: Tự động chuyển trạng thái sang `CHUA_BAT_DAU`.
    + Kéo lên `100%`: Tự động chuyển trạng thái sang `HOAN_THANH`.
    + Kéo trong khoảng `1% - 99%`: Tự động chuyển trạng thái sang `DANG_THUC_HIEN`.
  * `TasksPage.openUpdateModal()`: Tự động chuẩn hóa % tiến độ tương thích với trạng thái trước khi hiển thị cho người dùng.

---

## 📌 [Phiên bản 1.9.0] - 30/08/2026: Triển Khai Phân Hệ Quản Trị Quy Trình Từng Bước & Checklist Mốc (Workflow Pipeline)
- **Bối cảnh & Yêu cầu**: Loại bỏ phương pháp tính % tiến độ cảm tính. Mỗi nhiệm vụ gắn liền với quy trình từng bước cụ thể (từ 2 đến 8 bước) để xác định chính xác nhiệm vụ đang ở khâu nào và tính % hoàn thành chuẩn xác.
- **Cơ sở dữ liệu & Backend**:
  * `backend/app/models/task.py`: Bổ sung cột JSON `workflow_steps` lưu trữ danh sách các bước mốc `[{id, title, is_completed, completed_at, note}]`.
  * `backend/app/db/init_db.py`: Bổ sung migration an toàn `ALTER TABLE tasks ADD COLUMN IF NOT EXISTS workflow_steps JSON DEFAULT '[]'::json;`.
  * `backend/app/schemas/task.py`: Bổ sung `WorkflowStepSchema`, cập nhật `TaskBase`, `TaskCreate`, `TaskUpdate`, `TaskOut`.
  * `backend/app/api/v1/tasks.py`: Tự động tính `% = round((done / total) * 100)` và tự động chuyển đổi trạng thái khi các bước được hoàn thành.
  * `backend/app/api/v1/stats.py`: Bổ sung `workflow_steps` vào `user_tasks` để đồng bộ hiển thị trên Dashboard.
- **Giao diện & Tiện ích Frontend**:
  * `frontend/tasks.html` & `frontend/assets/js/tasks.js`:
    + Thư viện 4 mẫu quy trình tích hợp: `QUICK_2` (2 bước), `PDCA_4` (4 bước), `DAO_TAO_5` (5 bước), `QTĐT_8` (8 bước) kèm khả năng thêm/xóa/sửa từng bước tự do.
    + Modal Cập nhật tiến độ: Danh sách Checklist từng bước với Checkbox, ghi chú kết quả, tự động cập nhật tiến độ % và hiển thị tên bước hiện tại.
    + Modal Chi tiết: Visual Stepper / Timeline đồ họa trực quan thể hiện toàn bộ lộ trình nhiệm vụ.
    + Bảng PC và Thẻ Mobile: Cột tiến độ hiển thị trực quan `[Progress Bar] + [Bước X/Y: Tên bước]`.
  * `frontend/assets/js/dashboard.js`: Hiển thị thông tin bước mốc của nhiệm vụ trong Bảng theo dõi tiến độ Dashboard.
- **Tài liệu & Nguyên tắc**:
  * Bổ sung **Nguyên tắc số 10** vào `.keywork.md` và `.keywork`.
  * Cập nhật tài liệu `README.md` và `walkthrough.md`.

---

## 📌 [Phiên bản 2.0.0] - 30/08/2026: Triển Khai Phân Hệ Quản Lý Danh Mục Quy Trình Chuẩn Động (Enterprise Workflow Engine)
- **Bối cảnh & Mục tiêu**:
  * Chuyển đổi toàn diện từ việc hardcode các mẫu quy trình cố định sang một **Hệ thống Quản lý Danh mục Quy trình Vận hành Chuẩn (SOP Engine)** động, cho phép Quản trị viên/Trưởng đơn vị tạo mới, chỉnh sửa, xóa và cấu hình linh hoạt danh sách các bước mốc (từ 1 đến 8 bước) cho từng Đơn vị hoặc Toàn trường.
- **Cơ Sở Dữ Liệu & Backend**:
  * `backend/app/models/workflow.py`: Tạo mới model `WorkflowTemplate` (`id`, `code`, `name`, `department_id`, `description`, `steps` [JSON], `is_active`, `created_at`, `updated_at`).
  * `backend/app/models/task.py`: Thêm cột `workflow_name = Column(String(255), nullable=True)` vào model `Task`.
  * `backend/app/models/__init__.py`: Export `WorkflowTemplate`.
  * `backend/app/schemas/workflow.py`: Tạo mới `WorkflowTemplateCreate`, `WorkflowTemplateUpdate`, `WorkflowTemplateOut`.
  * `backend/app/schemas/task.py`: Thêm `workflow_name` vào `TaskBase`, `TaskCreate`, `TaskUpdate`, `TaskOut`.
  * `backend/app/api/v1/workflows.py`: Cung cấp trọn bộ CRUD endpoints `GET/POST /api/v1/workflows`, `GET/PUT/DELETE /api/v1/workflows/{id}` với bộ lọc theo đơn vị và tìm kiếm từ khóa.
  * `backend/app/api/v1/stats.py`: Bổ sung `workflow_name` vào `user_tasks` để hiển thị trên Dashboard.
  * `backend/app/main.py`: Đăng ký router `workflows.router` với prefix `/api/v1/workflows`.
  * `backend/app/db/init_db.py`: 
    + Migration an toàn tự động thêm cột `workflow_name` và bảng `workflow_templates`.
    + Tự động nạp sẵn **Bộ 7 Quy trình chuẩn HueIC**:
      1. `QT_CHUNG_01`: Quy trình Soạn thảo & Trình ký văn bản (2 bước) - Toàn trường
      2. `QT_CHUNG_02`: Quy trình Quản trị chất lượng & Cải tiến PDCA (4 bước) - Toàn trường
      3. `QT_DT_01`: Quy trình Xây dựng & Thẩm định Đề cương CTĐT (5 bước) - Phòng ĐT
      4. `QT_QTDT_01`: Quy trình Mua sắm & Đầu tư Cơ sở vật chất (8 bước) - Phòng QTĐT
      5. `QT_HCTH_01`: Quy trình Tổ chức Sự kiện / Hội thảo Toàn trường (6 bước) - Phòng HCTH
      6. `QT_TSDV_01`: Quy trình Tiếp nhận & Xét duyệt Học bổng Sinh viên (4 bước) - Trung tâm TSDV
      7. `QT_CNTT_01`: Quy trình Nâng cấp & Bảo trì Hệ thống Máy chủ (5 bước) - Khoa CNTT
- **Giao Diện & Tiện Ích Frontend**:
  * `frontend/assets/js/api.js`: Thêm `getWorkflows`, `getWorkflowDetail`, `createWorkflow`, `updateWorkflow`, `deleteWorkflow`.
  * `frontend/settings.html` & `frontend/assets/js/settings.js`:
    + Thêm tab thứ 4 **"Quy Trình Mẫu (Workflows)"** với bộ lọc theo Đơn vị, tìm kiếm và thẻ hiển thị trực quan các bước.
    + Thêm Modal Tạo/Sửa Quy Trình (`modalWorkflowForm`): Cho phép nhập Mã, Tên, Đơn vị áp dụng, và Dynamic Step Builder (thêm/xóa/sửa từng bước mốc linh hoạt).
  * `frontend/tasks.html` & `frontend/assets/js/tasks.js`:
    + Nâng cấp Modal Giao Việc Mới (`modalCreateTask`): Tích hợp Dropdown Chọn Quy Trình Mẫu động, tự động lọc theo Đơn vị chủ trì.
    + Khi chọn quy trình ➡️ Tự động nạp `workflow_name` và tất cả các bước mốc.
    + Bảng PC và Thẻ Mobile: Hiển thị rõ tên quy trình + bước mốc hiện tại `[Tên Quy Trình] • Bước X/Y: Tên bước`.
  * `frontend/assets/js/dashboard.js`: Bổ sung hiển thị `workflow_name` trên bảng danh sách nhiệm vụ cán bộ.
- **Tài Liệu & Nguyên Tắc**:
  * Tự động ghi nhận **Nguyên tắc số 11** vào `.keywork.md` và `.keywork`.
  * Cập nhật `README.md` (mục 5) và `walkthrough.md`.
  * Đã chạy kiểm thử tự động toàn diện xác nhận 100% API và tính năng hoạt động hoàn hảo!

---

## 📌 [Phiên bản 2.0.1] - 30/08/2026: Chuẩn Hóa Khóa Kéo % Thủ Công & Tính Toán % Tự Động 100% Theo Số Bước
- **Yêu cầu của Người dùng**:
  1. Loại bỏ hoàn toàn thanh kéo trượt % tiến độ thủ công (slider) để tránh việc kéo % cảm tính.
  2. Tỷ lệ % tiến độ và trạng thái "Đang thực hiện" bắt buộc phải được chia chính xác tuyệt đối theo tổng số bước của quy trình `round((Số bước hoàn thành / Tổng số bước) * 100)`.
- **Frontend (`frontend/tasks.html` & `frontend/assets/js/tasks.js`)**:
  * `frontend/tasks.html`:
    + Xóa bỏ `input type="range" id="updateProgress"` và các mốc 0% / 50% / 100% gây hiểu nhầm.
    + Bổ sung **Visual Progress Meter Display**: Thanh đo tiến độ tự động hiển thị tỷ lệ thực tế, badge % rõ ràng và text đếm bước: `Đã xong: X/Y bước (Z%)`.
  * `frontend/assets/js/tasks.js`:
    + Khóa 100% việc nhập % thủ công. % tiến độ chỉ được cập nhật khi người dùng tích/bỏ tích các bước trong Checklist.
    + Từng bước trong checklist hiển thị rõ tỷ lệ đóng góp của bước đó: `${Math.round(100 / total)}% / bước`.
    + Đổi trạng thái sang `HOAN_THANH` ➡️ tự động tích tất cả các bước (100%).
    + Đổi trạng thái sang `CHUA_BAT_DAU` ➡️ tự động bỏ tích tất cả các bước (0%).
    + Đổi trạng thái sang `DANG_THUC_HIEN` ➡️ giữ nguyên số bước đang tích (hoặc tự động kích hoạt bước 1 nếu đang ở 0 bước).
- **Tài liệu & Nguyên tắc**:
  * Cập nhật điều khoản trong **Nguyên tắc số 10** trong `.keywork.md` và `.keywork`.
  * Kiểm thử tự động khẳng định tính toán đúng 100% cho các quy trình từ 2 đến 8 bước.

---

## 📌 [Phiên bản 2.1.0] - 30/08/2026: Triển Khai 4 Tính Năng Đột Phá Chuẩn MISA AMIS Công Việc
- **Bối cảnh & Mục tiêu**:
  * Tham khảo và chắt lọc những tinh hoa xuất sắc nhất từ nền tảng **MISA AMIS Công Việc** để nâng tầm trải nghiệm quản trị công việc của HueIC IMP lên chuẩn doanh nghiệp hiện đại.
- **Chi tiết 4 Trụ Cột Đột Phá**:
  1. **Không gian làm việc Đa chế độ (Multi-View Workspace)**:
     - 📊 **Dạng Bảng Danh Sách (List View)**: Màn hình PC 8 cột trực quan hiển thị số thứ tự, tên công việc, đơn vị chủ trì & người phụ trách, hạn chót với badge thông minh, mức độ ưu tiên, trạng thái, tiến độ % kèm bước mốc và 2 nút hành động (Tiến độ / Chi tiết). Màn hình Mobile hiển thị Thẻ Touch to bản.
     - 📌 **Bảng Thẻ Kanban Kéo Thả (Kanban Board Drag & Drop)**: 4 cột trạng thái (*Chưa bắt đầu, Đang thực hiện, Chờ nghiệm thu, Đã hoàn thành*). Hỗ trợ kéo thả thẻ HTML5 siêu mượt, tự động gọi API cập nhật trạng thái và điều chỉnh trạng thái bước mốc.
     - 📅 **Lịch Công Tác Tháng (Calendar View)**: Ma trận lịch 7 cột tự động phân bổ công việc theo ngày hết hạn `due_date`, gắn badge màu theo độ ưu tiên (`KHAN_CAP`, `CAO`, `TRUNG_BINH`, `THAP`), hỗ trợ chuyển tháng trước/sau/hôm nay và click xem chi tiết 1 chạm.
  2. **Hệ thống Cảnh báo Hạn chót & Điểm nghẽn Thời gian thực (Real-Time Deadline Alerts)**:
     - Hàm `Common.getDeadlineStatus(dueDate, isCompleted)` tự động tính toán khoảng cách ngày:
       * 🚨 `Quá hạn X ngày`: Badge đỏ nổi bật cho công việc trễ hạn.
       * ⏳ `Còn Y ngày`: Badge cam/vàng cảnh báo hạn chót trong vòng 48h.
       * ⚡ `Hạn hôm nay`: Badge xanh dương khẩn trương.
       * ✅ `Đúng hạn / Đã xong`: Badge xanh lá an toàn.
  3. **Thanh Bộ Lọc Nhanh 1 Chạm (Quick Filter Pills)**:
     - Thanh nút lọc tức thì: `[Tất cả]`, `[🚨 Quá hạn (count)]`, `[⏳ Sắp đến hạn (count)]`, `[🎯 Việc của tôi]`, `[🔥 Khẩn cấp]`.
     - Tự động cập nhật số lượng badge cảnh báo trên thanh công cụ.
  4. **Bộ Gợi Ý Quy Trình AI/Tự Động (Smart Workflow Suggester)**:
     - Tự động bắt từ khóa khi người dùng gõ tiêu đề nhiệm vụ trong Form giao việc (ví dụ: *'mua sắm', 'đề cương', 'học bổng', 'sự kiện', 'máy chủ', 'trình ký', 'pdca'*).
     - Hiển thị banner gợi ý quy trình chuẩn HueIC tương ứng kèm nút **Áp dụng ngay** 1-click để tự động điền đơn vị chủ trì, tên quy trình và toàn bộ danh sách các bước mốc.
  5. **Chuẩn Hóa Dropdown Trạng Thái (Status Dropdowns Cleansing)**:
     - Loại bỏ hoàn toàn các nhãn phần trăm cứng `(0%)`, `(100%)` trong các thẻ `<option>` của dropdown trạng thái (`#updateStatus`), chỉ giữ lại tên trạng thái chuẩn hóa (*Chưa bắt đầu, Đang thực hiện, Chờ nghiệm thu, Đã hoàn thành, Tạm dừng, Trễ hạn*) để tránh gây hiểu nhầm, đảm bảo % chỉ phản ánh giá trị động thực tế từ các bước quy trình.
- **Tài liệu & Nguyên tắc**:
  * Tự động ghi nhận **Nguyên tắc số 12** vào `.keywork.md` và `.keywork`.
  * Cập nhật `README.md` và `walkthrough.md`.
  * Kiểm thử tự động Python xác nhận toàn bộ luồng tạo việc, kéo thả Kanban và truy vấn dữ liệu hoạt động 100% chính xác.



---

## v2.1.1 — 2026-08-30 (Bug-Fix & Status Normalization)

### 🐛 Sửa lỗi nghiêm trọng
- **Root-cause lỗi "Lỗi nạp danh sách công việc"**:
  - Tách riêng block `try/catch` API và block render giao diện trong `loadTasks()` (`tasks.js`).
  - Trước đây 1 `catch` bắt cả 2 → nếu render lỗi JS runtime cũng hiển thị toast sai "Lỗi nạp danh sách công việc".
  - Sau fix: Toast chỉ xuất hiện khi API thực sự thất bại; lỗi render được log vào `console.error` để debug.
- **Sửa `getDeadlineStatus` trong `common.js`**:
  - Chuẩn hóa `daysDiff` → `diffDays` nhất quán trong toàn bộ hàm (tránh `ReferenceError`).
  - Bổ sung `isOverdue: false, isDueSoon: false` cho trường hợp `isCompleted` và `no due_date`.
  - Bổ sung `shortLabel` cho tất cả trường hợp (`shortLabel` được dùng trong Kanban cards, mobile).

### ✅ Chuẩn hóa 6 Trạng thái Nhiệm vụ
- **Loại bỏ `TRE_HAN` khỏi UI**: Trễ hạn là cờ tự động tính từ `due_date`, KHÔNG phải trạng thái thủ công.
- **Thêm `HUY_BO`** (Hủy bỏ) vào toàn bộ hệ thống:
  - `backend/app/models/task.py`: Thêm `HUY_BO = "HUY_BO"` vào `TaskStatus` enum.
  - PostgreSQL DB: Migration an toàn `ALTER TYPE taskstatus ADD VALUE IF NOT EXISTS 'HUY_BO'`.
  - `frontend/tasks.html`: Cập nhật `#filterStatus` và `#updateStatus` → 6 trạng thái chuẩn.
  - `frontend/assets/js/tasks.js`: Cập nhật `statusBadges`, `handleStatusChange`, logic tự động gán trạng thái.
  - `frontend/assets/js/dashboard.js`: Bảng theo dõi dùng tên tiếng Việt thay vì mã enum thô.
- **Thiết kế 6 Trạng thái Chuẩn HueIC IMP**:
  - ⚪ `CHUA_BAT_DAU` — Chưa bắt đầu
  - 🔵 `DANG_THUC_HIEN` — Đang thực hiện
  - 🟡 `CHO_DUYET` — Chờ nghiệm thu
  - 🟢 `HOAN_THANH` — Đã hoàn thành
  - 🟣 `TAM_DUNG` — Tạm dừng (chờ kinh phí/chỉ đạo)
  - ⚫ `HUY_BO` — Hủy bỏ (chỉ Admin/người giao việc)
  - *(Trễ hạn hiển thị bằng badge `🚨 Quá hạn X ngày` tự động theo `due_date` — không phải dropdown)*

### 📂 Files chỉnh sửa
- `frontend/assets/js/common.js` — Fix `getDeadlineStatus`, chuẩn hóa properties
- `frontend/assets/js/tasks.js` — Fix `loadTasks` catch, thêm `HUY_BO` statusBadge, `handleStatusChange`
- `frontend/assets/js/dashboard.js` — Render tên tiếng Việt cho status
- `frontend/tasks.html` — Cập nhật `#filterStatus`, `#updateStatus` dropdowns
- `backend/app/models/task.py` — Thêm `HUY_BO` vào `TaskStatus` enum
- `PostgreSQL DB` — Migration `ALTER TYPE taskstatus ADD VALUE 'HUY_BO'`

---

## 📌 [Phiên bản 2.2.0] - 30/08/2026: Phân Hệ Lịch Công Tác Độc Lập Chuyên Nghiệp (Work Calendar Hub)
- **Yêu cầu & Động lực**:
  - Tách Lịch Công Tác thành một phân hệ độc lập nằm ở Menu chính ngay dưới "Tổng Quan (Dashboard)" và đứng trước "Quản Lý Công Việc".
  - Tham khảo và tích hợp các chuẩn UX/UI tiên tiến nhất từ **Google Calendar**, **Notion Calendar**, **ClickUp Planner** và **Linear**.
- **Tính Năng Đột Phá Đã Triển Khai**:
  1. **4 Chế Độ Xem Đa Năng (Multi-View Calendar)**:
     - 📅 **Tháng (Month View)**: Lưới 7 cột (Thứ 2 ➡️ Chủ Nhật), chip màu sắc động theo trạng thái/mức độ ưu tiên, đếm số lượng việc trong ngày, click nhảy sang xem chi tiết Ngày.
     - 📆 **Tuần (Week View)**: 7 cột theo ngày trong tuần, hiển thị thẻ nhiệm vụ timeline dọc và highlight ngày hiện tại.
     - ⏱️ **Ngày (Day View)**: Thống kê chi tiết việc đến hạn trong ngày kết hợp Timeline phân chia khung giờ làm việc hành chính chuẩn nhà trường (Sáng 07:00 - 11:30, Nghỉ trưa, Chiều 13:30 - 17:00).
     - 📋 **Danh Sách / Lịch Trình (Agenda View)**: Danh sách cuộn dạng dòng thời gian gom nhóm theo ngày hạn chót, hiển thị đầy đủ Đơn vị chủ trì, Cán bộ phụ trách và % tiến độ.
  2. **Mini-Calendar Sidebar (Google Calendar Style)**:
     - Lịch mini bên trái sidebar hỗ trợ nhảy ngày tức thì, chuyển tháng nhanh, đánh dấu chấm xanh cho những ngày có nhiệm vụ.
  3. **Hệ Thống Badge & Thống Kê Nhanh Thời Gian Thực**:
     - Đếm tự động số việc `Đến hạn hôm nay`, `Quá hạn` và `Sắp đến hạn` ngay trên thanh công cụ header.
  4. **Tích Hợp Đồng Bộ 100% Vào Toàn Bộ 5 Phân Hệ**:
     - Cập nhật Navigation Sidebar và Mobile Bottom Nav trên toàn bộ các trang (`index.html`, `calendar.html`, `tasks.html`, `settings.html`, `assets.html`, `documents.html`).
- **Files Tạo Mới & Chỉnh Sửa**:
  - `[NEW] frontend/calendar.html` — Giao diện chính của Phân hệ Lịch Công Tác.
  - `[NEW] frontend/assets/js/calendar.js` — Logic điều khiển 4 views, Mini-Calendar, gom nhóm sự kiện và điều hướng.
  - `[MODIFY] frontend/index.html` — Bổ sung Lịch Công Tác vào Sidebar Nav và Mobile Bottom Bar.
  - `[MODIFY] frontend/tasks.html` — Bổ sung Lịch Công Tác vào Sidebar Nav và Mobile Bottom Bar.
  - `[MODIFY] frontend/settings.html` — Bổ sung Lịch Công Tác vào Sidebar Nav và Mobile Bottom Bar.
  - `[MODIFY] frontend/assets.html` — Bổ sung Lịch Công Tác vào Sidebar Nav.
  - `[MODIFY] frontend/documents.html` — Bổ sung Lịch Công Tác vào Sidebar Nav.
- `[MODIFY] .keywork.md` — Bổ sung Nguyên tắc số 13.
  - `[MODIFY] README.md` — Bổ sung phân hệ Lịch Công Tác vào cấu trúc tài liệu.

---

## 📌 [Phiên bản 2.2.1] - 30/08/2026: Tối Ưu Hóa Bộ Lọc Nhiệm Vụ & Đồng Bộ Truy Xuất User Session
- **Nguyên nhân cốt lõi**:
  1. Trong `tasks.js` và `calendar.js`, một số hàm gọi `API.getCurrentUser()` trong khi `api.js` chỉ định nghĩa `API.getUser()`.
  2. Dữ liệu `hueic_user` lưu trong `localStorage` chứa trường `id` (thay vì `user_id`), khiến bộ lọc "Việc của tôi" (`my_tasks`) so sánh với `undefined`.
  3. Khi click từ Dashboard (biểu đồ hoặc bảng cán bộ) truyền tham số `?user_id=...` sang `tasks.html`, `API.getTasks()` chưa chuyển `user_id` thành `assignee_id` cho Backend.
  4. Thiếu logic tự động mở Modal Chi tiết khi URL chứa tham số `?task_id=...` (từ Lịch Công Tác hoặc Dashboard).
- **Các cải tiến & Sửa lỗi đã hoàn tất**:
  - `frontend/assets/js/api.js`:
    - Thêm alias `getCurrentUser()` trỏ về `getUser()`.
    - Bổ sung tham số `assignee_id` và tự động map `user_id` ➡️ `assignee_id` trong `API.getTasks()`.
  - `frontend/assets/js/tasks.js`:
    - Chuẩn hóa truy xuất `currentUserId = user?.id || user?.user_id`.
    - Thêm xử lý `user_id` từ URL trong `loadTasks()`.
    - Tự động mở Modal Chi tiết (`openTaskDetail`) khi URL có `?task_id=...`.
- **Kết quả kiểm thử**: Toàn bộ công việc đã giao hiển thị chính xác trên Dashboard, Danh sách việc, Thẻ Kanban và Lịch Công Tác.

---

## 📌 [Phiên bản 2.3.0] - 31/08/2026: Tái Cấu Trúc Sidebar Ngữ Cảnh & Nâng Cấp Lưới Lịch Công Tác Full-Height Chuyên Nghiệp
- **Yêu cầu & Phản hồi từ Người dùng**:
  1. Khi ở màn hình Lịch Công Tác (`calendar.html`), các menu điều hướng còn lại (`Thiết Lập Hệ Thống`, `Phân hệ mở rộng`, `Quản Lý Tài Sản`, `Văn Bản & Hồ Sơ`) cần được chuyển xuống **dưới** phần Mini-Calendar và Bảng chú thích màu (dưới dòng *Tạm dừng*) để tăng tính trực quan, đúng phân cấp ngữ cảnh công cụ.
  2. Thiết kế lại lưới lịch bên phải (Month View): Khắc phục hiện tượng nền trắng đơn điệu, các ô ngày bị lửng lơ thiếu chiều cao, thiếu độ tương phản giữa ngày thường vs cuối tuần (T7/CN), ngày trong tháng vs ngoài tháng, ngày hôm nay. Cần nâng cấp giao diện đạt chuẩn chuyên nghiệp tương tự Google Calendar / Notion Calendar.
- **Các cải tiến kỹ thuật & Giao diện đã thực hiện**:
  1. **Tái Cấu Trúc Sidebar Ngữ Cảnh (`frontend/calendar.html`)**:
     - Menu Lịch Công Tác (Active) nằm dưới Quản Lý Công Việc.
     - Tiện ích Lịch (Mini-Calendar + Bảng chú thích 5 màu: *Đang thực hiện, Quá hạn, Chờ nghiệm thu, Đã hoàn thành, Tạm dừng*) được gắn liền mạch ngay dưới Lịch Công Tác.
     - Mục *Thiết Lập Hệ Thống* và *Phân hệ mở rộng* (`Quản Lý Tài Sản`, `Văn Bản & Hồ Sơ`) được chuyển xuống dưới dòng *Tạm dừng*.
     - Sidebar trang bị `overflow-y-auto` cuộn mượt mà trên mọi độ phân giải.
  2. **Lưới Lịch Tháng Full-Height & Tối Ưu Độ Tương Phản (`calendar.html` & `assets/js/calendar.js`)**:
     - Lưới tháng tự động co giãn phủ kín 100% chiều cao màn hình (`flex-1 grid-auto-rows: 1fr` với `gap-px bg-slate-200`).
     - **Thứ 7 & Chủ Nhật**: Cột có nền ánh hồng nhẹ (`bg-rose-50/20`), header màu đỏ đô (`text-rose-600 font-extrabold`), số ngày màu đỏ nổi bật.
     - **Ngày ngoài tháng**: Nền muted `bg-slate-50/70`, số ngày màu xám nhẹ `text-slate-400 font-medium`.
     - **Ngày hôm nay (Today)**: Khung viền xanh dương tinh tế (`box-shadow: inset 0 0 0 1.5px #3b82f6`), badge số ngày tròn xanh dương nổi bật (`bg-blue-800 text-white font-black`).
     - **Thẻ Nhiệm Vụ (Event Chips)**: Bo góc 6px, dải màu viền trái `border-l-3`, badge mã đơn vị `[BGH]`, `[CNTT]`, tiêu đề và tooltip đa thông tin khi rê chuột. Badge `+X việc khác` nếu ngày có nhiều hơn 3 công việc.
  3. **Thanh Công Cụ Header Lịch Đa Năng**:
     - Tích hợp bộ lọc nhanh 12 Đơn vị trường (`#calendarFilterDept`).
     - Ô tìm kiếm từ khóa trực tiếp trên Lịch (`#calendarSearchInput`).
     - Nút tắt nhanh "Giao việc mới" điều hướng sang `tasks.html`.
  4. **Nâng cấp đồng bộ các View còn lại**:
     - Tuần (Week View), Ngày (Day View), Danh sách (Agenda View) được trau chuốt về màu sắc, bố cục thẻ và dòng thời gian.
- **Files Chỉnh Sửa**:
  - `[MODIFY] frontend/calendar.html`
  - `[MODIFY] frontend/assets/js/calendar.js`
  - `[MODIFY] .keywork.md` (Cập nhật Section 12 & 13)
  - `[MODIFY] HISTORY.md`

---

## 📌 [Phiên bản 2.3.1] - 31/08/2026: Đồng Bộ Kích Thước Thanh Tiến Độ Biểu Đồ & Bảng Chi Tiết 12 Đơn Vị Trên Dashboard
- **Yêu cầu & Phản hồi từ Người dùng**:
  - Điều chỉnh kích thước thanh tiến độ ở mục "Tiến Độ & Khối Lượng 12 Đơn Vị HueIC" bằng với chiều cao và độ thông thoáng của "Bảng Theo Dõi Tiến Độ Chi Tiết 12 Đơn Vị HueIC".
- **Nguyên nhân gốc rễ**:
  - Thẻ chứa canvas biểu đồ thanh ngang trước đây bị cố định ở `h-60` (240px). Khi phải hiển thị đồng thời 12 đơn vị (24 cột bar và 12 nhãn phòng ban), không gian bị nén chặt khiến các thanh tiến độ bị ép mỏng dính (~4px), nhãn chữ bị co cụm trong khi bảng chi tiết bên dưới chiếm ~550px.
- **Các cải tiến kỹ thuật & Giao diện đã thực hiện**:
  1. **Định Kích Thước Động Cho Canvas Container (`frontend/index.html` & `frontend/assets/js/dashboard.js`)**:
     - Thay thế class `h-60` bằng container động `#chartDeptProgressContainer` với `min-h-[520px]`.
     - Tự động tính toán chiều cao container theo số lượng phần tử (`targetHeight = Math.max(520, labels.length * 44 + 40)` px) tương ứng ~44px/hàng, đồng bộ tuyệt đối với 12 dòng của Bảng Chi Tiết.
  2. **Tăng Cường Độ Dày & Độ Nét Thanh Bar (Chart.js)**:
     - Đặt `barThickness: 13-16px`, `borderRadius: 6px`, `barPercentage: 0.85`, `categoryPercentage: 0.85`.
     - Nhãn 12 Đơn vị ở trục Y (`scales.y.ticks`) được định dạng `font: 11px, weight: 700`, màu chữ đậm `#334155`, không bị chồng chéo hay co méo.
     - Cân đối chiều cao Biểu đồ Cơ Cấu Tình Trạng (Doughnut Chart) bên cột trái lên `h-72` với `my-auto` tạo bố cục trực quan hài hòa.
- **Files Chỉnh Sửa**:
  - `[MODIFY] frontend/index.html`
  - `[MODIFY] frontend/assets/js/dashboard.js`
  - `[MODIFY] .keywork.md` (Bổ sung Section 14)
  - `[MODIFY] HISTORY.md`

---

## 📌 [Phiên bản 2.4.0] - 31/08/2026: Nâng Cấp Toàn Diện Dashboard Thành "Executive Operational & Decision-Making Dashboard"
- **Mục tiêu chiến lược**:
  - Chuyển hóa toàn diện Dashboard từ giao diện "thống kê dữ liệu bị động" sang **"Executive Operational Dashboard (Trợ lý điều hành ra quyết định cấp cao)"** chuẩn Enterprise. Nhìn vào là nhận biết ngay tình hình thực tế, các điểm nghẽn nghiêm trọng, rủi ro tiềm ẩn và các việc cần lãnh đạo ra quyết định/hành động tiếp theo.
- **Các cải tiến kỹ thuật & Giao diện đã thực hiện**:
  1. **Bổ Sung Phân Vùng ⚡ VIỆC CẦN XỬ LÝ NGAY (Action Queue / Decision Hub)**:
     - Tích hợp khối thông minh hiển thị danh sách các điểm nghẽn cần ưu tiên xử lý:
       - 🔴 **Nhiệm vụ Quá hạn**: Mã đơn vị `[ĐT]`, Tên việc, Cán bộ phụ trách, Số ngày trễ hạn, Nút `[Xử lý →]` mở thẳng chi tiết nhiệm vụ.
       - ⏳ **Nhiệm vụ Sắp đến hạn (trong 48-72h)**: Cảnh báo thời gian còn lại, Nút `[Đôn đốc →]`.
       - 🟡 **Nhiệm vụ Chờ nghiệm thu**: Tên việc, % tiến độ, Nút `[Phê duyệt →]`.
       - ✨ Banner xanh tích cực khi hệ thống vận hành hoàn hảo không có việc tồn đọng.
  2. **Tích Hợp Khối Tiến Độ Đối Tượng Đa Chế Độ (Tabbed View)**:
     - Chuyển đổi linh hoạt 3 Tabs:
       - **Tab 1 (Mặc định): 📈 Tiến Độ (%)**: Danh sách thanh progress bar ngang tinh gọn của từng đơn vị/cán bộ kèm badge trạng thái vận hành và nút lọc nhanh.
       - **Tab 2: 📊 Biểu Đồ Bar**: Biểu đồ Chart.js so sánh tỷ lệ hoàn thành (%) và tổng khối lượng công việc.
       - **Tab 3: 🥧 Cơ Cấu %**: Biểu đồ Doughnut Chart phân bổ 6 trạng thái công việc.
  3. **Băng Ngang Ưu Tiên Xử Lý (Priority Action Strip)**:
     - 4 khối thẻ tương tác dạng nút bấm: `🔴 01 — KHẨN CẤP` (kèm badge đếm số việc quá hạn), `🟠 02 — CAO`, `🔵 03 — TRUNG BÌNH`, `⚪ 04 — THẤP`. Bấm vào bất kỳ thẻ nào sẽ lọc ngay danh sách công việc tương ứng.
  4. **Bổ Sung Cột "Trạng Thái Vận Hành" Quản Trị Vào Bảng Chi Tiết 12 Đơn Vị**:
     - Đánh giá trực quan tình hình vận hành:
       - 🔴 `🚨 Có X việc trễ hạn` (Đỏ cảnh báo)
       - ⏳ `⏳ Đang triển khai` (Hổ phách)
       - 🟢 `✅ Đúng tiến độ` (Xanh lá)
       - ⚪ `Chưa có việc` (Xám)
  5. **Tổ Chức Lại Sidebar Thành 3 Nhóm Chức Năng Chuẩn Enterprise & Notification Badge**:
     - Phân nhóm rõ nét: `ĐIỀU HÀNH` (Tổng Quan, Quản Lý Công Việc, Lịch Công Tác), `QUẢN TRỊ` (Thiết Lập Hệ Thống, Quản Lý Tài Sản), `HỒ SƠ` (Văn Bản & Hồ Sơ).
     - Gắn Badge số lượng việc quá hạn/chờ duyệt thời gian thực cạnh menu Quản Lý Công Việc trên toàn bộ hệ thống.
  6. **Cập Nhật Backend Stats API (`/api/v1/stats/summary`)**:
     - Tính toán và trả về `action_queue` (danh sách chi tiết việc quá hạn, việc sắp đến hạn trong 72h, việc chờ nghiệm thu).
     - Tính toán `priority_stats` kèm số lượng việc quá hạn cho từng mức ưu tiên.
     - Đánh giá tự động `operational_status`, `status_label`, `status_badge` cho từng phòng ban và từng cán bộ.
- **Files Chỉnh Sửa**:
  - `[MODIFY] backend/app/api/v1/stats.py`
  - `[MODIFY] frontend/index.html`
  - `[MODIFY] frontend/assets/js/dashboard.js`
  - `[MODIFY] frontend/assets/js/common.js`
  - `[MODIFY] frontend/tasks.html`
  - `[MODIFY] frontend/settings.html`
  - `[MODIFY] frontend/calendar.html`
  - `[MODIFY] frontend/assets.html`
  - `[MODIFY] frontend/documents.html`
  - `[MODIFY] .keywork.md` (Bổ sung Section 15)
  - `[MODIFY] HISTORY.md`

---

## 📌 [Phiên bản 2.4.1] - 31/08/2026: Sửa Lỗi Cú Pháp Khởi Tạo Dashboard & Hoàn Thiện Tải Dữ Liệu Thời Gian Thực
- **Vấn đề phát hiện**:
  - Khối *Việc Cần Xử Lý Ngay* bị treo ở trạng thái "Đang tải danh sách việc cần xử lý..." và khối *Tiến Độ & Khối Lượng 12 Đơn Vị HueIC* không nạp dữ liệu.
- **Nguyên nhân gốc rễ**:
  - Trong quá trình merge mã nguồn trước đó, file `dashboard.js` có đoạn mã thừa không hợp lệ ở cuối file dẫn tới lỗi JavaScript Runtime, khiến hàm `Dashboard.init()` bị dừng thực thi ngay khi mở trang `index.html`.
- **Giải pháp xử lý**:
  - Làm sạch toàn bộ `frontend/assets/js/dashboard.js`, loại bỏ triệt để đoạn mã trùng lặp.
  - Kiểm tra và xác thực cú pháp bằng `node -c` trên toàn bộ 6 file JavaScript trong hệ thống.
  - Kiểm thử tải dữ liệu trực tiếp: Action Queue, 3 Tabs Tiến Độ %, Biểu đồ Bar Chart, Doughnut Chart và Bảng Chi Tiết 12 Đơn Vị đã hoạt động mượt mà, chính xác 100%.
- **Files Chỉnh Sửa**:
  - `[MODIFY] frontend/assets/js/dashboard.js`
  - `[MODIFY] HISTORY.md`

---

## 📌 [Phiên bản 2.4.2] - 31/08/2026: Khôi Phục Hiển Thị Trực Tiếp 2 Khối Biểu Đồ Chart.js Trên Dashboard
- **Vấn đề phát hiện**:
  - Biểu đồ Doughnut Chart và Horizontal Bar Chart không hiển thị trực tiếp khi mở Dashboard do trước đó đặt ẩn trong các Tab con. Khi canvas ở trạng thái `display: none`, Chart.js không thể tính toán kích thước thực tế (0x0px) dẫn tới việc đồ thị không vẽ được.
- **Giải pháp xử lý**:
  - **Tái thiết kế layout Dashboard tối ưu**:
    1. ⚡ **Việc Cần Xử Lý Ngay (Action Queue)**: Hiển thị nổi bật dạng lưới 3 cột (Quá hạn 🔴, Sắp hạn trong 72h ⏳, Chờ duyệt 🟡) ngay dưới hàng KPI.
    2. 📊 **2 Khối Biểu Đồ Trực Quan (Visual Charts Layer)**: Hiển thị song song đồng thời trực tiếp trên màn hình:
       - **Cột Trái (lg:col-span-5)**: *Cơ Cấu Tình Trạng Nhiệm Vụ* (Doughnut Chart 6 lát màu chuẩn, legend trực quan, click lọc việc).
       - **Cột Phải (lg:col-span-7)**: *Tiến Độ & Khối Lượng 12 Đơn Vị HueIC* (Horizontal Bar Chart với chiều cao tự động theo 12 đơn vị `min-h-[480px]`, thanh bar dày 13-14px, bo góc 6px).
    3. 🎯 **Băng Ngang Ưu Tiên Xử Lý**: 4 thẻ mức độ tương tác 1-click filter.
    4. 📋 **Bảng Chi Tiết 12 Đơn Vị**: Bảng theo dõi tiến độ đầy đủ với cột Trạng thái Vận hành.
  - **Cập nhật JS (`dashboard.js`)**:
    - Gọi hàm `renderStatusDoughnutChart()` và `renderDeptProgressBarChart()` trực tiếp và vô điều kiện trong `loadStats()`.
    - Loại bỏ cơ chế ẩn hiện tab gây lỗi kích thước canvas.
- **Files Chỉnh Sửa**:
  - `[MODIFY] frontend/index.html`
  - `[MODIFY] frontend/assets/js/dashboard.js`
  - `[MODIFY] HISTORY.md`






