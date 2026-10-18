# EQ Hiệu trưởng — tài khoản Tuan

Hai ngân hàng riêng cho user `tuan`; mỗi bộ có 900 câu, 30 đề × 30 câu. Bộ 1 được gán sử dụng ban đầu, bộ 2 giữ để chuyển qua bằng User Profiles → Tuan → Question Banks.

Nguồn: `eq-hieutruong-bo1.csv`, `eq-hieutruong-bo2.csv` do người dùng cung cấp ngày 18/10/2026. Giữ nguyên mã câu hỏi, nội dung, đáp án và giải thích. Chỉ chuẩn hóa metadata theo định dạng ứng dụng:

- Bộ 1: `test_id` T01–T30 → 1–30.
- Bộ 2: `test_id` T31–T60 → 1–30; mã câu T31-Q01…T60-Q30 được giữ nguyên.
- `test_level` tính theo nhóm đề (1–10 Beginner, 11–20 Intermediate, 21–30 Advanced); `difficulty` gốc được giữ nguyên.

Kết quả kiểm tra file: mỗi bộ 900 dòng, không lỗi parse/thiếu cột/trùng câu hoặc lỗi chặn import sau chuẩn hóa. Mỗi bộ có 600 câu cần xác nhận duyệt vì là nội dung tình huống EQ, không có biểu thức toán để tự xác minh. Cờ này không xác nhận nội dung đã được chuyên gia thẩm định; đáp án là đáp án do tác giả file cung cấp.

Có kiểm thử tích hợp nhập cả hai bộ, publish riêng cho user thử nghiệm, gán bộ 1, đăng nhập, mở đề, lưu đáp án và chấm điểm. File nguồn trong thư mục tải xuống không bị sửa.

Xác minh trước phát hành: 21 file / 204 tests đạt; production build local đạt TypeScript và lint. Các bài test có ghi dữ liệu chạy trên SQLite thử nghiệm riêng.
