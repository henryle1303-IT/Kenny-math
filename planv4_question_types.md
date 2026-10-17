Kế hoạch v4: Thêm các dạng câu hỏi khác nhau (giai đoạn 1: văn bản thuần)

Ngày lập: 17/10/2026. Trạng thái: ĐỀ XUẤT, chờ xác nhận trước khi làm.

1. Hiện trạng

Toàn bộ hệ thống chỉ hiểu một dạng: trắc nghiệm 4 đáp án A-D. Giả định này nằm ở:
- Schema: Question có optionA..optionD, correctAnswer (A|B|C|D); StudentAnswer.selectedAnswer và ReviewQuestion.selectedAnswer/correctAnswer.
- Chấm bài: src/lib/grading.ts so sánh chuỗi selected === correctAnswer.
- Dịch vụ: attempts.ts (saveAnswer chỉ nhận A-D), review.ts (answerReviewQuestion chỉ nhận A-D), xp.ts (dùng selectedAnswer khác null để biết đã trả lời).
- Máy sinh đề: src/lib/gen (Built có correct + wrong[], engine ghép 3 đáp án nhiễu, GeneratedQuestion.options là bộ 4).
- Kiểm tra ngân hàng: src/lib/validate/question.ts và bank.ts (4 đáp án khác nhau, verifyExpr khớp đáp án đúng).
- CSV: src/lib/csv/columns.ts (option_a..d, correct_answer), import.ts, export.ts, services/importer.ts.
- Giao diện: TestRunner.tsx, ReviewRunner.tsx, trang results/[id]/review, admin QuestionManager.tsx, demo tĩnh (demo/model.ts, DemoApp.tsx).
- Sao lưu tiến độ: services/progress-backup.ts.

2. Phạm vi giai đoạn 1 ("plain text trước")

Hiểu là: chỉ thêm các dạng mà đề bài và đáp án đều là chữ/số, chưa cần hình ảnh, kéo thả hay vẽ. Dạng cần hình hoặc tương tác để giai đoạn 2 (mục 9). Nếu bạn hiểu khác, xem câu hỏi mở ở mục 10.

Các dạng thêm (giữ nguyên trắc nghiệm MCQ):
a) NUMERIC_INPUT: nhập số. Chấp nhận dạng tương đương (0.5 = 1/2 = .50), số nguyên, thập phân, phân số; đơn vị tùy chọn (cm, kg); dung sai tùy chọn (mặc định 0).
b) TRUE_FALSE: Đúng/Sai cho một hoặc vài mệnh đề; tính đúng khi tất cả đúng.
c) MULTI_SELECT: chọn tất cả đáp án đúng (2-6 lựa chọn). Đúng khi chọn chính xác tập đáp án đúng.
d) FILL_BLANK: điền nhiều chỗ trống (ví dụ "3/4 + {1} = 1" hoặc dãy số có 2-3 ô trống). Mỗi ô là một đáp án số; đúng khi tất cả ô đúng.
e) ORDERING: sắp xếp 3-6 mục theo thứ tự (ví dụ xếp phân số từ nhỏ đến lớn), chọn bằng nút lên/xuống hoặc bấm lần lượt, không cần kéo thả.
f) SHORT_TEXT (ít dùng): trả lời chữ ngắn từ danh sách đáp án chấp nhận, không phân biệt hoa thường. Chỉ cho câu logic đơn giản; có thể hoãn.

Không làm ở giai đoạn 1: hình/sơ đồ, ghép cặp, kéo thả, vẽ trên đường thẳng số, chấm điểm từng phần.

3. Nguyên tắc thiết kế

- Tương thích ngược hoàn toàn: mọi câu hiện có là MCQ; cột mới có giá trị mặc định; file CSV cũ nhập vào vẫn chạy nguyên.
- Một "cửa" cho mỗi dạng: thư mục mới src/lib/question-types gồm registry; mỗi dạng cùng một giao diện: validateDefinition (kiểm tra cấu hình câu), parseResponse (chuẩn hóa trả lời của học sinh), grade (đúng/sai), displayCorrect (chuỗi đáp án đúng để hiển thị), nhập/xuất CSV, nhãn EN/VI. Các chỗ khác chỉ gọi registry, không rẽ nhánh theo dạng.
- Chấm trên máy chủ như hiện nay. Mỗi câu vẫn 1 điểm, đúng/sai tuyệt đối, nên XP, sao, kỹ năng, lịch sử không phải đổi.
- Cách lưu trả lời: giữ cột selectedAnswer kiểu chuỗi. MCQ vẫn là "A".."D"; dạng khác lưu chuỗi JSON đã chuẩn hóa (["B","D"], {"1":"3/4"}, [2,0,1]). Nhờ vậy backup, XP, lịch sử dùng lại được.
- Cấu hình và đáp án chấp nhận được lưu trong một cột JSON mới của Question (answerData), không nhồi vào optionA..D.
- Đề bài vẫn qua RichText/KaTeX; câu trả lời nhập tay hiển thị dạng text, không thực thi HTML.
- Mọi nhãn và hướng dẫn ("Chọn tất cả đáp án đúng", "Nhập số") có EN/VI qua src/lib/i18n.ts.

4. Dữ liệu

Thêm vào cả hai schema (prisma/schema.prisma và prisma/postgres/schema.prisma) và một migration PostgreSQL thuần cộng thêm (ADD COLUMN có DEFAULT, không đổi dữ liệu cũ); migration SQLite tương ứng nếu còn dùng:

Question:
- questionType String @default("MCQ")  // MCQ | NUMERIC_INPUT | TRUE_FALSE | MULTI_SELECT | FILL_BLANK | ORDERING | SHORT_TEXT
- answerData String?                   // JSON cấu hình theo dạng; null với MCQ
- Giữ optionA..D và correctAnswer cho MCQ; với dạng khác để chuỗi rỗng (hoặc đổi thành nullable trong cùng migration; chọn cách an toàn nhất sau khi đọc lại schema).

ReviewQuestion: thêm questionType (mặc định MCQ); generatedQuestionData (JSON sẵn có) chứa cấu hình dạng mới; correctAnswer lưu chuỗi đã chuẩn hóa.

Ví dụ answerData:
- NUMERIC_INPUT: { accepted: ["3/4"], tolerance: 0, unit: "cm" | null, requireSimplified: false }
- TRUE_FALSE: { statements: [{ text, truth: true }] }
- MULTI_SELECT: { options: [..], correct: [1,3] }
- FILL_BLANK: { blanks: [{ accepted: ["1/4"] }, ...] } với thẻ {1}, {2} trong đề
- ORDERING: { items: [..], order: [2,0,1] } (hiển thị xáo trộn cố định theo seed của lượt làm)
- SHORT_TEXT: { accepted: ["..", ".."] }

5. Các bước triển khai

Bước 1. Nền tảng (không đổi hành vi người dùng)
- Thêm cột schema và migration; cập nhật hai schema, tests/global-setup, scripts/e2e-prepare.
- Tạo src/lib/question-types: types.ts, registry.ts, mcq.ts (bọc logic hiện tại), rồi các dạng mới. Viết unit test từng dạng trước khi gắn vào dịch vụ.
- grading.ts: GradeInput thêm questionType, answerData; gọi registry.grade. MCQ cho kết quả y hệt hiện nay (test cũ phải pass không sửa).

Bước 2. Máy chủ
- attempts.ts: saveAnswer nhận chuỗi tùy dạng, kiểm tra bằng registry.parseResponse (từ chối định dạng sai, giới hạn độ dài). Mở bài trả cấu hình hiển thị nhưng không lộ đáp án đúng. Nộp bài và trang xem lại dùng grade mới, hiển thị đáp án của bé và đáp án đúng theo displayCorrect.
- review.ts: answerReviewQuestion chấp nhận mọi dạng; Smart Review/Similar vẫn chọn câu theo skill.
- xp.ts, skills.ts, progress.ts, progress-backup.ts: chỉ chỉnh chỗ nhận biết "đã trả lời" và isCorrect; định dạng sao lưu phiên bản 1 vẫn đọc được. Kiểm tra khôi phục không hỏng.

Bước 3. Máy sinh đề
- Mở rộng Built: trường kind tùy chọn, mặc định MCQ nên template cũ không phải sửa.
- Thêm template mới ở src/lib/gen/templates: nhập số (phép tính, phần trăm, đo lường), đúng/sai (phân số, thập phân, chu vi), điền chỗ trống (dãy số, phân số tương đương), sắp xếp (số, phân số, thập phân), chọn tất cả (bội, ước, phân số bằng nhau). Mỗi template có verify độc lập như hiện nay.
- engine.ts: nhánh riêng cho dạng không cần đáp án nhiễu; fingerprint/skeleton tính theo cả dạng; tránh câu trùng.
- Cấu hình tỷ lệ dạng trong một bài (ví dụ 70% MCQ, còn lại xen kẽ) do admin chỉnh ở Generator/Cài đặt; mặc định 100% MCQ để không đổi bài đang chạy.

Bước 4. Kiểm tra ngân hàng
- validate/question.ts và bank.ts: kiểm tra theo dạng qua registry.validateDefinition (MULTI_SELECT có ít nhất 1 đáp án đúng; NUMERIC_INPUT đáp án parse được và verifyExpr khớp; ORDERING thứ tự hợp lệ; FILL_BLANK số thẻ {n} khớp số ô). Quy tắc "4 đáp án khác nhau" chỉ áp dụng cho MCQ.
- Câu phải pass kiểm tra mới được Publish như hiện nay.

Bước 5. CSV và trình quản lý admin
- Thêm cột tùy chọn question_type và answer_data (JSON) vào EXTRA_COLUMNS. File cũ không có cột này được hiểu là MCQ; xuất luôn kèm hai cột; vòng nhập-xuất phải khép kín.
- Cập nhật COLUMN_DESCRIPTIONS, file mẫu CSV kèm ví dụ cho mỗi dạng.
- QuestionManager.tsx: chọn dạng câu hỏi, form sửa theo dạng, xem trước như học sinh thấy, validate từng câu.

Bước 6. Giao diện học sinh
- TestRunner.tsx và ReviewRunner.tsx: tách thành phần nhập theo dạng (QuestionInput), giữ khung chung (hẹn giờ, điều hướng, đánh dấu, lưu tự động). Vùng bấm lớn, hỗ trợ bàn phím, cảm ứng và đọc màn hình.
- Trang results/[id]/review: hiển thị đáp án theo từng dạng.
- Demo tĩnh: thêm dạng mới ở mức tối thiểu hoặc ghi rõ demo chỉ có MCQ.

Bước 7. Kiểm thử và tài liệu: xem mục 6. Cập nhật README, QA_REPORT.md và mục "Kết quả triển khai" cuối file này.

6. Kiểm thử

- Unit: từng dạng (parse, chuẩn hóa, chấm, hiển thị đáp án đúng); nhiều biến thể nhập (0.5, 1/2, ".50", khoảng trắng, dấu phẩy thập phân, đơn vị); đầu vào độc hại (JSON hỏng, quá dài, sai kiểu).
- Unit máy sinh: mỗi template mới qua verify, không tạo câu trùng, tỷ lệ dạng đúng cấu hình.
- Integration: nộp bài hỗn hợp các dạng; lưu trả lời từng dạng; làm lại bài; XP, sao, kỹ năng đúng với dạng mới; sao lưu và khôi phục; Smart Review với dạng mới; nhập CSV cũ (không có cột mới) và CSV mới khép kín.
- E2E: học sinh làm một bài có đủ dạng, kết quả đúng; admin tạo/sửa câu theo từng dạng và publish; chuyển EN/VI.
- Hồi quy: toàn bộ test hiện có phải pass không sửa.
- Không có PostgreSQL thật trong môi trường này: migration kiểm tra bằng prisma validate/migrate diff, chạy trên PostgreSQL cục bộ nếu có; nếu không thì ghi rõ chưa kiểm thử trên Neon.

7. Thứ tự ưu tiên dạng câu hỏi

Hạ tầng (bước 1) làm một lần trước. Sau đó mỗi dạng làm trọn gói (sinh đề, kiểm tra, CSV, admin, học sinh, test) rồi mới sang dạng kế:
1. NUMERIC_INPUT (giá trị học tập cao nhất, giảm đoán mò)
2. TRUE_FALSE
3. MULTI_SELECT
4. FILL_BLANK
5. ORDERING
6. SHORT_TEXT (nếu còn thấy cần)

8. Rủi ro và lưu ý

- Không lộ đáp án: API mở bài chỉ trả cấu hình hiển thị, không trả trường correct/accepted.
- So khớp đáp án nhập tay: dùng bộ parse sẵn có ở src/lib/math/parse.ts; cần quy tắc rõ (phân số tương đương được chấp nhận; câu nào cần dạng rút gọn thì đặt requireSimplified).
- Migration phải thuần cộng thêm, chạy tự động khi deploy Vercel; thử trên bản sao trước.
- Thời gian làm bài: câu nhập số/điền chỗ trống/sắp xếp tốn thời gian hơn, xem lại giới hạn 1800 giây mặc định khi bài có nhiều dạng.
- Không gây quá tải cho bé: bài mới bắt đầu chỉ xen 1-2 dạng, không dùng cùng lúc tất cả.
- Dạng nhập tay dễ gây nản vì sai chính tả/định dạng: hiện gợi ý định dạng, chấp nhận nhiều cách viết, lỗi định dạng báo trước khi nộp chứ không tính sai.

9. Giai đoạn 2 (sau, chưa làm bây giờ)

Câu hỏi có hình/sơ đồ (SVG sinh từ code cho hình học, đường thẳng số, bảng biểu), ghép cặp, kéo thả, điền trên đường thẳng số, chấm điểm từng phần, câu đọc hiểu có đoạn văn dài.

10. Câu hỏi cần chốt trước khi làm

1) "Plain text trước" có đúng là chỉ chữ/số, để hình và kéo thả cho giai đoạn 2?
2) Dạng nào ưu tiên đầu tiên (đề xuất NUMERIC_INPUT trước)?
3) Bài hiện có giữ 100% MCQ, admin tự bật dạng mới cho bài mới: đồng ý không?
4) Có cần chấm điểm từng phần cho MULTI_SELECT/FILL_BLANK không (đề xuất không, giữ đúng/sai tuyệt đối)?
5) Có cần migration SQLite không, hay chỉ PostgreSQL như v3 (test dùng prisma db push)?
