# Kế hoạch v3: Hệ thống điểm thưởng XP

Ngày lập: 17/10/2026. Trạng thái: CHỜ DUYỆT, chưa triển khai.

## 1. Phạm vi đã chốt

- Chỉ làm cho PostgreSQL: thêm một migration trong prisma/postgres/migrations. Không viết migration SQLite mới.
- Gộp cả 3 giai đoạn (nền tảng XP, động lực hằng ngày, huy hiệu và phần thưởng) thành một đợt làm.
- Không có bảng xếp hạng giữa các bạn. Học sinh chỉ so với chính mình (tuần này so với tuần trước, kỷ lục cá nhân).
- Học sinh cũ có XP khởi điểm tính từ lịch sử làm bài (xem mục 7).
- Cửa hàng phần thưởng do phụ huynh cấu hình: làm luôn ở cuối đợt này (mục 8), mặc định tắt cho đến khi phụ huynh bật.
- Mọi chữ trên giao diện XP đi theo nút LangToggle hiện có (EN/VI) qua src/lib/i18n.ts. Tên huy hiệu, nhiệm vụ, cấp độ, thông báo đều có đủ hai ngôn ngữ.

## 2. Điểm XP và cấp độ

XP mỗi hành động (admin chỉnh được):

- Trả lời đúng một câu: +10
- Đúng ngay lần đầu: +5 thêm
- Hoàn thành bài kiểm tra: +20; đạt 100%: thêm +50
- Hoàn thành một phiên Smart Review: +15
- Sửa đúng một câu từng sai: +15

Quy tắc:

- Mỗi câu chỉ cộng XP một lần. Làm lại bài đã đúng thì XP giảm một nửa.
- Mọi lần cộng XP ghi vào sổ cái (ledger) có lý do, nguồn và thời gian, để tính lại và kiểm tra được.
- XP chỉ được cộng ở phía máy chủ, ngay trong các hàm chấm bài hiện có (src/lib/services/attempts.ts, review.ts), cùng transaction, nên không cộng trùng và không gian lận được từ trình duyệt.
- Cấp độ: XP cần để lên cấp tăng dần. Mỗi cấp có tên vui theo ngôn ngữ (ví dụ Tập sự, Thám hiểm số, Pháp sư phân số). Trang chủ có thanh tiến độ lên cấp.

## 3. Động lực hằng ngày (đã làm dễ hơn)

- Chuỗi ngày học: chỉ cần trả lời đúng ít nhất 5 câu trong ngày là giữ chuỗi. Làm bài kiểm tra, Smart Review hay sửa lỗi đều tính.
- Thẻ bảo vệ chuỗi: tự tặng 1 thẻ mỗi 7 ngày học, giữ tối đa 2 thẻ. Bỏ lỡ một ngày thì tự dùng thẻ, chuỗi không đứt. Hết thẻ thì chuỗi về 0 nhưng vẫn giữ kỷ lục cũ.
- Nhiệm vụ ngày: chỉ 2 nhiệm vụ nhỏ, đổi mỗi ngày.
  - "Trả lời 5 câu" (cho XP và giữ chuỗi)
  - Một nhiệm vụ xoay vòng: ôn 1 chủ đề yếu, hoặc sửa 2 câu từng sai, hoặc làm 1 phiên Smart Review
  - Hoàn thành cả 2 nhận thêm +15 XP. Bỏ lỡ không bị phạt.
- Thử thách tuần: mục tiêu mềm, ví dụ "học 3 ngày trong tuần" hoặc "làm 1 bài kiểm tra". Không bắt buộc đạt điểm cao.
- Mốc thưởng chuỗi: 3, 7, 14, 30 ngày, thưởng XP nhỏ.
- Ngày học tính theo múi giờ Asia/Ho_Chi_Minh.

## 4. Huy hiệu và so với chính mình

- Huy hiệu: Điểm tuyệt đối, Chuỗi 7 ngày, Thợ săn lỗi sai (sửa 20 câu từng sai), Bậc thầy chủ đề (đạt 90% trở lên trong một chủ đề), Kỷ lục mới...
- Sao 1 đến 3 cho từng chủ đề, theo XP và độ chính xác của chủ đề đó.
- Mở khóa avatar và màu giao diện theo cấp.
- Trang My Progress thêm biểu đồ XP theo tuần: tuần này so với tuần trước, kỷ lục cá nhân. Không hiện thứ hạng của bạn khác.

## 5. Phản hồi tức thì (giao diện học sinh)

- Hiệu ứng "+10 XP" khi trả lời đúng; hiệu ứng nhẹ khi lên cấp hoặc nhận huy hiệu. Tôn trọng chế độ giảm chuyển động của thiết bị.
- Màn hình kết quả bài kiểm tra và Smart Review hiện XP nhận được, cấp độ, chuỗi ngày.
- Trang chủ thêm thẻ XP: cấp, thanh tiến độ, chuỗi ngày, nhiệm vụ hôm nay.
- Thanh điều hướng hiện nhanh XP và chuỗi ngày.

## 6. Dữ liệu (chỉ PostgreSQL)

Thêm model vào prisma/postgres/schema.prisma và một migration mới:

- StudentXp: tổng XP, cấp, chuỗi hiện tại, kỷ lục chuỗi, số thẻ bảo vệ, ngày học gần nhất.
- XpLedger: studentId, số XP, lý do, nguồn (TEST, REVIEW, QUEST, BADGE, BACKFILL, ADMIN, REDEEM), khóa chống trùng, thời gian.
- StudentBadge: huy hiệu đã đạt và thời điểm.
- DailyQuest: nhiệm vụ ngày và tuần, tiến độ, trạng thái hoàn thành.
- Cấu hình XP lưu bằng bảng Setting hiện có (không thêm bảng).
- Cửa hàng (mục 8): Reward, RewardRedemption.

Lưu ý hạ tầng kiểm thử: hiện Vitest và Playwright chạy trên SQLite và có một test bắt buộc hai file schema giống hệt nhau. Cách xử lý đề xuất (phương án A):

- Vẫn thêm các model mới vào cả prisma/schema.prisma và prisma/postgres/schema.prisma để test song song schema đạt.
- Chỉ commit migration PostgreSQL. Không có migration SQLite.
- Bước chuẩn bị test (tests/global-setup.ts, scripts/e2e-prepare.ts) thêm lệnh `prisma db push --skip-generate` để tạo bảng XP trong DB tạm của test.
- Phương án B (bỏ hẳn SQLite, chuyển test sang PostgreSQL) không chọn đợt này vì thay đổi lớn và cần PostgreSQL thật khi chạy test.

## 7. XP khởi điểm từ lịch sử (backfill)

- Chạy một lần khi áp migration, hoặc qua script `npm run xp:backfill`, và có thể chạy lại an toàn (idempotent).
- Nguồn tính: toàn bộ bài kiểm tra đã nộp (StudentAnswer, TestAttempt) và các phiên Smart Review đã làm (ReviewQuestion, ReviewSession) của từng học sinh.
- Quy tắc tính: dùng cùng bảng điểm XP ở mục 2 nhưng đơn giản hóa cho dữ liệu cũ: câu đúng +10, hoàn thành bài kiểm tra +20, đạt 100% +50, hoàn thành phiên Smart Review +15. Không cộng điểm "đúng lần đầu" và "sửa lỗi" cho dữ liệu cũ vì không đủ thông tin.
- Mỗi dòng backfill có nguồn BACKFILL và khóa chống trùng theo attempt hoặc session, nên chạy lại không cộng thêm.
- Kenny nhận XP từ lịch sử. Henry, Xoai, Moon chưa có lịch sử nên bắt đầu từ 0.
- Chuỗi ngày: tính từ ngày học thực tế trong lịch sử, chỉ giữ chuỗi nếu ngày học gần nhất là hôm nay hoặc hôm qua; kỷ lục chuỗi lấy từ lịch sử. Huy hiệu xét theo dữ liệu cũ (ví dụ điểm tuyệt đối), không có hiệu ứng ăn mừng.
- Cấp độ tính lại từ tổng XP sau backfill.
- Trước khi chạy, in báo cáo xem trước (dry run) tổng XP dự kiến cho từng học sinh để admin kiểm tra.

## 8. Cửa hàng phần thưởng của phụ huynh

- Admin (phụ huynh) tạo phần thưởng cho từng học sinh hoặc dùng chung: tên, mô tả, giá XP, giới hạn số lần đổi (mỗi tuần hoặc tổng), bật hoặc tắt.
- Học sinh vào trang "Phần thưởng" (EN/VI): thấy XP khả dụng, danh sách phần thưởng, nút "Đổi" khi đủ XP.
- Đổi thưởng tạo yêu cầu ở trạng thái chờ duyệt và trừ XP khả dụng ngay (ghi vào sổ cái, lý do REDEEM). Phụ huynh duyệt hoặc từ chối trong admin; từ chối thì hoàn lại XP. Cấp độ dựa trên tổng XP đã kiếm, không giảm khi tiêu XP.
- Phân biệt hai con số: XP tích lũy (quyết định cấp độ) và XP khả dụng (dùng để đổi).
- Admin xem lịch sử đổi thưởng, tặng hoặc trừ XP thủ công (ghi sổ cái với nguồn ADMIN).
- Mặc định cửa hàng tắt; chỉ hiện với học sinh khi phụ huynh bật và có ít nhất một phần thưởng.

## 9. Trang quản trị

- Cấu hình XP: số XP mỗi hành động, ngưỡng chuỗi, bật hoặc tắt từng tính năng (chuỗi, nhiệm vụ, huy hiệu, cửa hàng).
- Hồ sơ từng học sinh: xem XP, cấp, chuỗi, huy hiệu, sổ cái; tặng XP thủ công; đặt lại XP; chạy lại backfill cho học sinh đó.
- Sao lưu, khôi phục và xóa tiến độ hiện có phải bao gồm dữ liệu XP của đúng học sinh được chọn.

## 10. Các bước triển khai

1. Thêm model, migration PostgreSQL, cập nhật hai file schema và bước chuẩn bị test.
2. Module lõi src/lib/xp (quy tắc XP, cấp, chuỗi, nhiệm vụ, huy hiệu) và dịch vụ src/lib/services/xp.ts.
3. Gắn cộng XP vào attempts.ts và review.ts (cùng transaction, chống trùng).
4. Script backfill, báo cáo dry run, chạy cho Kenny.
5. Giao diện học sinh: thẻ XP ở trang chủ, nav, hiệu ứng, màn kết quả, nhiệm vụ, huy hiệu, biểu đồ so với chính mình, bản dịch EN/VI.
6. Cửa hàng phần thưởng (học sinh và admin).
7. Trang quản trị XP và cập nhật sao lưu, xóa tiến độ.
8. Kiểm thử (mục 11), cập nhật README và QA report, chạy typecheck, lint, test.

## 11. Kiểm thử

- Unit: quy tắc XP, cấp độ, chuỗi, thẻ bảo vệ, nhiệm vụ, huy hiệu, tính backfill.
- Integration: cộng XP khi nộp bài và khi trả lời Smart Review, chống cộng trùng, backfill chạy lại không đổi kết quả, đổi thưởng và hoàn XP, quyền truy cập theo học sinh.
- E2E: học sinh thấy XP và lên cấp, nhiệm vụ ngày, đổi ngôn ngữ EN/VI, đổi thưởng và phụ huynh duyệt.
- Không chạy được trên Neon thật trong môi trường này; migration PostgreSQL kiểm tra bằng cách đọc lại SQL và chạy trên PostgreSQL cục bộ nếu có, nếu không thì ghi rõ chưa kiểm thử trên PostgreSQL thật.

## 12. Rủi ro và lưu ý

- Migration PostgreSQL chạy tự động khi deploy Vercel; cần giữ migration thuần cộng thêm (chỉ tạo bảng mới) để không ảnh hưởng dữ liệu hiện có.
- Backfill phải idempotent để deploy lặp lại không nhân đôi XP.
- Không có bảng xếp hạng nên không cần chia sẻ dữ liệu giữa các hồ sơ.
- Giữ giao diện nhẹ, không gây áp lực: nhiệm vụ nhỏ, chuỗi có thẻ bảo vệ, bỏ lỡ không bị phạt.
