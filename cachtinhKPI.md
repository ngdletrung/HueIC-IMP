# 📊 SỔ TAY HƯỚNG DẪN CÁCH TÍNH ĐIỂM KPI (HUEIC IMP)
### Hệ Thống Đo Lường Hiệu Suất Tác Nghiệp & Quản Trị Trách Nhiệm Chuẩn Hóa
*(Ban hành kèm theo Khung kiến trúc điều hành HueIC IMP — Phiên bản Blueprint v1.0)*

---

## 🎯 I. MỤC TIÊU & TRIẾT LÝ QUẢN TRỊ KPI

> **"KPI không phải là công cụ trừng phạt, mà là Cỗ máy chẩn đoán hiệu suất và bảo vệ sự công bằng trong tổ chức."**

Hệ thống tính KPI của **HueIC IMP** được thiết kế dựa trên 4 mục tiêu cốt lõi:
1. **Công bằng tuyệt đối**: Việc lớn, phức tạp có trọng số cao; việc nhỏ, đơn giản có trọng số thấp. Không cào bằng trung bình cộng.
2. **Chống "Lách luật" & "Bào điểm" (Anti-Gaming)**: Không thể chọn nhiều việc dễ làm nhanh để lấy điểm cao hơn người làm việc khó.
3. **Bảo vệ Cán bộ làm tốt ("Khiên Quá Tải")**: Khi cán bộ bị giao dồn việc quá tải, nếu trễ hạn sẽ được miễn phạt, trách nhiệm được chuyển về năng lực điều phối của Lãnh đạo.
4. **Minh bạch & Truy vết kiểm toán (100% Traceable)**: Mọi điểm số đều có công thức, bằng chứng (Evidence), lịch sử hành động và độc lập qua từng năm học (Policy Versioning).

---

## 🔒 II. 8 NGUYÊN TẮC BẤT BIẾN (INVARIANTS)

1. **Không dùng điểm trừ tuyệt đối**: Mọi điểm trừ/thưởng đều quy đổi thành **Hệ số % nhân trên Điểm chuẩn (Base Score)** của chính nhiệm vụ đó.
2. **Chặn trần và sàn**: Điểm KPI cá nhân và đơn vị luôn nằm trong khoảng an toàn: **0% – 120%**.
3. **Không tính trùng lặp (No Double-Count)**:
   - **Nhân viên**: Hưởng điểm từ các **Nhiệm vụ con (Child Tasks)** được giao trực tiếp.
   - **Trưởng đơn vị**: Hưởng điểm từ **Nhiệm vụ cha (Parent Tasks)** và **Điểm điều phối**.
4. **Khóa sửa Deadline trực tiếp**: Khi nhiệm vụ đang thực hiện (`IN_PROGRESS`), không ai được tự ý đổi Deadline. Mọi gia hạn phải qua quy trình gửi phiếu yêu cầu (`request_extensions`) và được phê duyệt.
5. **Chụp ảnh tải công việc (Workload Snapshot)**: Chỉ số tải công việc dùng để xét miễn trừ trách nhiệm được chốt **tại thời điểm giao việc**, không bị ảnh hưởng bởi các việc giao thêm trong tương lai.
6. **Điểm Task Cha có trọng số (Weighted Parent Score)**: Điểm của nhiệm vụ cha là trung bình có trọng số theo độ lớn của các nhiệm vụ con, tuyệt đối không dùng trung bình cộng đơn giản.
7. **Tách biệt Tiến độ % và Điểm KPI**: Làm được 80% tiến độ chưa có điểm KPI. Điểm chỉ được chốt khi có **Biên bản Nghiệm thu / Phê duyệt Hoàn thành** từ cấp trên.
8. **Độc lập phiên bản (Policy Versioning)**: Mọi phép tính gắn liền với Quy chế đánh giá của từng năm học. Đổi công thức năm nay không làm thay đổi điểm số lịch sử của các năm trước.

---

## 🧮 III. CÔNG THỨC TÍNH ĐIỂM CHO 1 NHIỆM VỤ (TASK SCORE)

Mỗi nhiệm vụ khi hoàn thành sẽ được chấm điểm theo công thức chuẩn:

$$\Large \text{Điểm Thực Nhận (Actual Score)} = \text{Điểm Chuẩn (Base Score)} \times H_{\text{Hoàn thành}} \times H_{\text{Thời gian}} \times H_{\text{Chất lượng}}$$

---

### 1. Điểm Chuẩn (Base Score)
Phản ánh độ lớn, độ khó và tầm quan trọng của nhiệm vụ:

$$\text{Base Score} = \text{Hệ số Ưu tiên (Priority Factor)} \times \text{Trọng số (Weight)}$$

| Mức độ ưu tiên | Hệ số Ưu tiên (Priority Factor) | Ý nghĩa nghiệp vụ |
| :--- | :---: | :--- |
| **⚪ Thấp (Low)** | **1** | Việc hành chính thông thường, việc hỗ trợ |
| **🔵 Trung bình (Medium)** | **2** | Việc chuyên môn thường xuyên theo kế hoạch |
| **🟡 Cao (High)** | **3** | Việc trọng tâm tháng/quý của Khoa/Phòng |
| **🔥 Khẩn cấp (Urgent)** | **5** | Nhiệm vụ đột xuất, chỉ đạo khẩn từ Ban Giám Hiệu |

*`Trọng số (Weight)`: Thang điểm độ phức tạp (Mặc định = 1.0 đến 5.0).*

---

### 2. Hệ số Hoàn Thành ($H_{\text{Hoàn thành}}$)
* **Đã hoàn thành & Nghiệm thu (`DONE`)**: $H = 1.0$
* **Chưa hoàn thành / Bị hủy do lỗi chủ quan**: $H = 0.0$
* **Từ chối nhận việc không có lý do chính đáng**: $H = 0.5$

> ⚠️ **Lưu ý:** Nếu $H_{\text{Hoàn thành}} = 0$, điểm nhiệm vụ **bằng 0 ngay lập tức**, không cần xét tiếp hệ số thời gian và chất lượng.

---

### 3. Hệ số Thời Gian ($H_{\text{Thời gian}}$) — Áp dụng khi đã hoàn thành
Đo lường tính kịp thời và tốc độ xử lý:

| Mốc thời gian hoàn thành | Hệ số $H_{\text{Thời gian}}$ | Giải thích chi tiết |
| :--- | :---: | :--- |
| **Sớm $\ge$ 2 ngày** | **1.10** *(Tối đa 1.15)* | Thưởng hoàn thành vượt tiến độ |
| **Đúng hạn (hoặc sớm 1 ngày)** | **1.00** | Hoàn thành chuẩn mực theo kế hoạch |
| **Trễ 1 ngày** | **0.85** | Trừ 15% trên điểm chuẩn của task |
| **Trễ 2 ngày** | **0.70** | Trừ 30% trên điểm chuẩn của task |
| **Trễ 3 ngày** | **0.55** | Trừ 45% trên điểm chuẩn của task |
| **Trễ > 3 ngày** | **0.50 (Sàn tối thiểu)** | Chặn sàn 50%, không phạt thêm để khuyến khích cán bộ tiếp tục làm xong việc |

#### 🛡️ CƠ CHẾ ĐẶC BIỆT: "KHIÊN QUÁ TẢI" (OVERLOAD SHIELD)
* **Điều kiện kích hoạt**: Tại thời điểm giao việc, cán bộ đã có chỉ số tải **$\text{Workload Index} > 120\%$** (Đang gánh nhiều hơn 1.2 lần định mức).
* **Quyền lợi bảo vệ**: Nếu nhiệm vụ này bị trễ hạn, **$H_{\text{Thời gian}}$ của cán bộ vẫn được giữ nguyên là 1.00 (Không bị trừ điểm)**.
* **Chuyển giao trách nhiệm**: Phần điểm phạt trễ hạn đáng lẽ cán bộ phải chịu sẽ được **chuyển sang trừ vào Điểm Điều Phối của Trưởng đơn vị** (do phân công dồn việc không hợp lý).

---

### 4. Hệ số Chất Lượng ($H_{\text{Chất lượng}}$)
Đo lường độ chính xác và chất lượng hồ sơ/sản phẩm bàn giao:

| Tình trạng hoàn thành | Hệ số $H_{\text{Chất lượng}}$ | Công thức & Ví dụ |
| :--- | :---: | :--- |
| **Hoàn thành đạt chuẩn ngay lần đầu** | **1.00** | Sản phẩm chuẩn xác, không bị yêu cầu chỉnh sửa |
| **Bị trả về sửa lần 1** | **0.85** | $1.0 \times 0.85 = 0.85$ |
| **Bị trả về sửa lần 2** | **0.72** | $0.85 \times 0.85 = 0.7225$ |
| **Bị trả về sửa lần 3** | **0.61** | $0.85 \times 0.85 \times 0.85 \approx 0.614$ |
| **Bị trả về sửa $\ge$ 4 lần** | $0.85^n$ *(Sàn 0.0)* | Nhân dồn lũy tiến |

---

### 5. Điểm Thưởng Đề Xuất Sáng Kiến (Proposal Bonus)
* Cán bộ chủ động gửi **Đề xuất / Sáng kiến cải tiến** được Trưởng phòng hoặc BGH phê duyệt chủ trương và đưa vào thực hiện:
  $$\text{Thưởng cố định} = +15 \text{ điểm / đề xuất thành công}$$
* *Trần tối đa: $+30 \text{ điểm / kỳ đánh giá}$.*

---

## 👤 IV. CÁCH TÍNH KPI CÁ NHÂN THEO KỲ (INDIVIDUAL KPI)

Cuối mỗi kỳ đánh giá (Tháng / Quý / Năm học), điểm KPI của cán bộ được tổng hợp theo công thức:

$$\Large \text{KPI Cá Nhân} = \left( \frac{\sum \text{Điểm Thực Nhận (Actual Scores)}}{\sum \text{Điểm Chuẩn (Base Scores)}} \times 100\% \right) + \text{Điểm Thưởng Đề Xuất}$$

*(Áp dụng chặn trần tối đa **120%** và sàn tối thiểu **0%**).*

---

### 📌 VÍ DỤ MINH HỌA THỰC TẾ CHO CÁN BỘ A:
Trong tháng, Cán bộ A được giao 3 nhiệm vụ và có 1 đề xuất được duyệt:

| Nhiệm vụ | Mức ưu tiên | Trọng số | Điểm chuẩn | Kết quả thực hiện | Hệ số Thời gian | Hệ số Chất lượng | Điểm thực nhận |
| :--- | :---: | :---: | :---: | :--- | :---: | :---: | :---: |
| **Task 1: Báo cáo số liệu** | Trung bình (2) | 1.0 | **2.0** | Sớm 2 ngày, đạt lần 1 | 1.10 | 1.00 | **2.20** |
| **Task 2: Soạn bài giảng số** | Cao (3) | 2.0 | **6.0** | Đúng hạn, bị trả sửa 1 lần | 1.00 | 0.85 | **5.10** |
| **Task 3: Hỗ trợ tuyển sinh** | Khẩn cấp (5) | 1.5 | **7.5** | Trễ 1 ngày *(Có Khiên Quá Tải)* | 1.00 *(Miễn phạt)* | 1.00 | **7.50** |
| **Tổng cộng** | | | **15.5** | | | | **14.80** |

$$\text{Tỷ lệ thực hiện} = \frac{14.80}{15.50} \times 100\% = 95.48\%$$
$$\text{Cộng thưởng 1 Đề xuất} = +15\%$$
$$\Large \mathbf{\text{KPI Cá Nhân Cán Bộ A}} = 95.48\% + 15\% = \mathbf{110.48\%} \quad \text{(Xếp loại: Xuất sắc 🟢)}$$

---

## 🏢 V. CÁCH TÍNH KPI TRƯỞNG ĐƠN VỊ (KHOA / PHÒNG)

Trưởng đơn vị chịu trách nhiệm kép: vừa thực hiện các nhiệm vụ lớn của trường giao, vừa phải điều phối nhân sự công bằng, không để ách tắc:

$$\Large \mathbf{\text{KPI Trưởng Đơn Vị}} = \left( \text{Điểm Thực Thi} \times 70\% \right) + \left( \text{Điểm Điều Phối} \times 30\% \right)$$

---

### 1. Điểm Thực Thi (70% Trọng số) — Weighted Parent Score
Điểm của các **Nhiệm vụ Cha (Cấp Trường / Cấp Đơn vị)** do Trưởng phòng chủ trì, tính theo trọng số đóng góp của các nhiệm vụ con:

$$\text{Parent Score} = \frac{\sum (\text{Điểm Chuẩn Con} \times \text{Hệ số Đạt Con})}{\sum \text{Điểm Chuẩn Con}} \times \text{Điểm Chuẩn Cha}$$

> 💡 **Quy tắc:** Nhiệm vụ con lớn (Base = 10) bị trễ sẽ kéo điểm Trưởng phòng xuống nhiều hơn nhiệm vụ con nhỏ (Base = 1). Khi các nhiệm vụ con chưa xong hết, hệ thống chỉ hiển thị nhãn **"KPI Dự Kiến (Projected)"**.

---

### 2. Điểm Điều Phối & Quản Trị (30% Trọng số)
Bắt đầu từ **100%**, cộng thưởng hoặc trừ phạt dựa trên hành vi quản trị:

| Tiêu chí điều phối | Mức tác động | Điều kiện áp dụng |
| :--- | :---: | :--- |
| **Phạt ngâm việc > 24h** | **-5% / việc** | Nhiệm vụ trường giao về phòng > 24h chưa phân công cho ai |
| **Phạt ngâm việc > 48h** | **-10% / việc** | Nhiệm vụ ngâm > 48h chưa phân công |
| **Phạt ngâm việc > 72h (BGH can thiệp)** | **-15% / việc** | Nhiệm vụ bị leo thang (Escalate) lên BGH chỉ đạo |
| **Phạt dồn tải làm trễ việc** | **-10%** | Khi > 30% nhân viên trong phòng trễ hạn do bị giao quá tải |
| **Phạt thay do kích hoạt Khiên Quá Tải** | **Bằng điểm phạt trễ** | Giao việc cho người đang quá tải làm họ bị trễ |
| **Thưởng Phân Công Hợp Lý** | **Cộng đến +15%** | Chia việc đồng đều, khoa học cho toàn thể cán bộ trong đơn vị (Độ lệch chuẩn tải thấp) |

*(Chặn trần Điểm Điều phối: **0% – 115%**; Tổng điểm phạt tối đa không trừ quá 30%/kỳ).*

---

## 🏛️ VI. CHỈ SỐ HIỆU SUẤT TOÀN TRƯỜNG — SPI (DÀNH CHO BAN GIÁM HIỆU)

**School Performance Index (SPI)** là thước đo tổng thể sức khỏe vận hành của toàn bộ 12 Phòng / Khoa / Trung tâm:

$$\Large \mathbf{\text{SPI Toàn Trường}} = 40\% \cdot R_{\text{Đúng hạn}} + 25\% \cdot R_{\text{Hoàn thành}} + 20\% \cdot R_{\text{Chất lượng}} + 15\% \cdot R_{\text{Phản hồi}}$$

Trong đó:
1. **$R_{\text{Đúng hạn}}$ (40%)**: Tỷ lệ nhiệm vụ cấp trường hoàn thành đúng hoặc trước hạn.
2. **$R_{\text{Hoàn thành}}$ (25%)**: Tỷ lệ nhiệm vụ đã kết thúc / Tổng số nhiệm vụ được giao trong kỳ.
3. **$R_{\text{Chất lượng}}$ (20%)**: Tỷ lệ nhiệm vụ hoàn thành đạt chuẩn ngay từ lần đầu tiên.
4. **$R_{\text{Phản hồi}}$ (15%)**: Tốc độ tiếp nhận và giải quyết chỉ đạo điều hành của các đơn vị (quy đổi ngược từ số lần phải Escalate).

---

## 🔍 VII. BẢNG XẾP LOẠI HIỆU SUẤT ĐỊNH KỲ

| Mức % KPI Đạt Được | Xếp Loại Thi Đua | Ý Nghĩa Nghiệp Vụ & Vinh Danh |
| :---: | :---: | :--- |
| **$\ge 110\%$** | **Xuất Sắc (A+)** 🌟 | Vượt tiến độ, nhiều sáng kiến, chất lượng vượt trội |
| **$95\% - 109\%$** | **Tốt (A)** 🟢 | Hoàn thành tốt, đúng hạn, chất lượng bảo đảm |
| **$80\% - 94\%$** | **Hoàn Thành (B)** 🟡 | Đạt yêu cầu, có một vài nhiệm vụ trễ nhẹ hoặc sửa đổi |
| **$65\% - 79\%$** | **Cần Cải Thiện (C)** 🟠 | Còn nhiều nhiệm vụ trễ hạn hoặc bị trả về nhiều lần |
| **$< 65\%$** | **Không Đạt (D)** 🔴 | Không hoàn thành chỉ tiêu, ngâm việc hoặc từ chối nhiệm vụ |

---

## ❓ VIII. CÂU HỎI THƯỜNG GẶP (FAQ KHI GIẢI THÍCH CHO NGƯỜI DÙNG)

#### Q1: Tôi làm nhiệm vụ bị trả về sửa 2 lần, vậy tôi có bị mất hết điểm không?
> **Trả lời:** **KHÔNG.** Bạn chỉ bị nhân hệ số chất lượng $0.85 \times 0.85 = 0.7225$ (giữ lại hơn 72% điểm). Khi bạn sửa xong và được nghiệm thu, bạn vẫn nhận phần lớn điểm của nhiệm vụ đó.

#### Q2: Tôi đang gánh 5 việc lớn, sếp giao thêm việc thứ 6 và bị trễ hạn thì tôi có bị trừ KPI không?
> **Trả lời:** **KHÔNG.** Hệ thống tự động kích hoạt **"Khiên Quá Tải" (Overload Shield)** vì tại thời điểm nhận việc bạn đã quá tải ($>120\%$). Bạn được giữ nguyên hệ số thời gian 1.0 (không bị trừ điểm), điểm trừ trễ hạn sẽ chuyển sang Trưởng phòng.

#### Q3: Sếp tôi giao nhiệm vụ nhưng quên không phê duyệt nghiệm thu thì tôi có được tính điểm không?
> **Trả lời:** Hệ thống có cơ chế đếm ngược thời gian chờ duyệt. Nếu Lãnh đạo ngâm phê duyệt quá 48h, hệ thống sẽ cảnh báo trừ điểm điều phối của Lãnh đạo để đảm bảo quyền lợi chốt điểm kịp thời cho nhân viên.

---
*Tài liệu này được tích hợp trực tiếp vào hệ thống tính toán tự động của HueIC IMP. Mọi thắc mắc hoặc yêu cầu đối soát điểm vui lòng sử dụng tính năng "Tra cứu Lịch sử Kiểm toán (Audit Trail)" tại chi tiết từng nhiệm vụ.*
