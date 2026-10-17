Kế hoạch v4: Thêm các dạng câu hỏi khác nhau (giai đoạn 1: văn bản thuần)

Ngày lập: 17/10/2026. Trạng thái: ĐÃ TRIỂN KHAI một phần (xem mục 11).

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
f) SHORT_TEXT (ít dùng): trả lời chữ ngắn từ danh sách đáp án chấp nhận. Chỉ cho câu logic đơn giản; có thể hoãn. Áp dụng quy tắc chuẩn hóa chữ ở mục 3A.

Không làm ở giai đoạn 1: hình/sơ đồ, ghép cặp, kéo thả, vẽ trên đường thẳng số, chấm điểm từng phần.

3. Nguyên tắc thiết kế

- Tương thích ngược hoàn toàn: mọi câu hiện có là MCQ; cột mới có giá trị mặc định; file CSV cũ nhập vào vẫn chạy nguyên.
- Một "cửa" cho mỗi dạng: thư mục mới src/lib/question-types gồm registry; mỗi dạng cùng một giao diện: validateDefinition (kiểm tra cấu hình câu), parseResponse (chuẩn hóa trả lời của học sinh), grade (đúng/sai), displayCorrect (chuỗi đáp án đúng để hiển thị), nhập/xuất CSV, nhãn EN/VI. Các chỗ khác chỉ gọi registry, không rẽ nhánh theo dạng.
- Chấm trên máy chủ như hiện nay. Mỗi câu vẫn 1 điểm, đúng/sai tuyệt đối, nên XP, sao, kỹ năng, lịch sử không phải đổi.
- Cách lưu trả lời: giữ cột selectedAnswer kiểu chuỗi. MCQ vẫn là "A".."D"; dạng khác lưu chuỗi JSON đã chuẩn hóa (["B","D"], {"1":"3/4"}, [2,0,1]). Nhờ vậy backup, XP, lịch sử dùng lại được.
- Cấu hình và đáp án chấp nhận được lưu trong một cột JSON mới của Question (answerData), không nhồi vào optionA..D.
- Đề bài vẫn qua RichText/KaTeX; câu trả lời nhập tay hiển thị dạng text, không thực thi HTML.
- Mọi nhãn và hướng dẫn ("Chọn tất cả đáp án đúng", "Nhập số") có EN/VI qua src/lib/i18n.ts.

3A. Quy tắc cho mọi câu trả lời nhập chữ (YÊU CẦU BẮT BUỘC)

Áp dụng cho SHORT_TEXT, đơn vị của NUMERIC_INPUT và mọi ô nhập chữ về sau:
- Không phân biệt chữ hoa và chữ thường: "Hình Vuông", "hình vuông", "HÌNH VUÔNG" đều đúng.
- Bỏ khoảng trắng thừa đầu, cuối và gộp nhiều khoảng trắng liên tiếp thành một.
- Chuẩn hóa Unicode (NFC) trước khi so sánh để dấu tiếng Việt gõ bằng các bộ gõ khác nhau vẫn khớp.
- Mặc định vẫn phân biệt dấu tiếng Việt; admin liệt kê thêm biến thể không dấu trong danh sách accepted nếu muốn nhận (ví dụ "hinh vuong"). Có thể thêm tùy chọn ignoreDiacritics cho từng câu.
- Chuẩn hóa áp dụng cho cả đáp án học sinh nhập và danh sách accepted, nên admin không cần liệt kê từng cách viết hoa.
- Cần phân biệt hoa thường là ngoại lệ hiếm (ví dụ ký hiệu đơn vị): bật bằng cờ caseSensitive trong answerData, mặc định tắt.
- Hàm chuẩn hóa nằm một chỗ trong src/lib/question-types và có unit test (hoa/thường, khoảng trắng, dấu, Unicode).

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
- ORDERING: { items: [..] } liệt kê theo đúng thứ tự đúng (hiển thị xáo trộn cố định theo seed của lượt làm, không bao giờ trùng thứ tự đúng)
- SHORT_TEXT: { accepted: ["..", ".."], caseSensitive: false, ignoreDiacritics: false }

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

Bước 6A. Người dùng demo và ngân hàng demo đủ các dạng (YÊU CẦU BẮT BUỘC)

- Người dùng: username demo, mật khẩu 123 (hợp lệ với validateStudentPassword, tối thiểu 3 ký tự), tên hiển thị "Demo", ngôn ngữ mặc định vi.
- Ngân hàng: "Demo - tất cả dạng câu hỏi", source MANUAL, đã PUBLISHED, ownerId là người dùng demo và gán sẵn cho demo (cơ chế ngân hàng riêng của người dùng đã có ở banks.ts), nên không đổi ngân hàng chung đang active của Kenny, Henry, Xoai, Moon.
- Nội dung: viết tay, không sinh ngẫu nhiên, để ổn định khi chạy demo. Khoảng 3 bài ngắn (6-8 câu mỗi bài) ở các mức Beginner/Intermediate/Advanced, mỗi dạng (MCQ, NUMERIC_INPUT, TRUE_FALSE, MULTI_SELECT, FILL_BLANK, ORDERING, SHORT_TEXT) có ít nhất 2 câu, kèm giải thích, lỗi hay gặp, mẹo học, có cả câu thử nhập 0.5 / 1/2, chữ hoa/thường, cả câu đúng và câu dễ sai để minh họa. Mỗi câu pass validate; chạy thử toàn bộ 7 dạng và Smart Review trên bank này.
- Cách tạo: script idempotent npm run demo:seed (scripts/demo-seed.ts): tạo hoặc giữ người dùng demo (không ghi đè mật khẩu nếu đã đổi), tạo hoặc cập nhật ngân hàng demo theo questionId cố định, chạy lại không nhân đôi. Dữ liệu câu hỏi nằm trong một file dữ liệu riêng (ví dụ prisma/demo-bank.ts hoặc CSV mẫu có cột question_type/answer_data) để cũng dùng làm file mẫu nhập CSV.
- An toàn: mật khẩu 123 yếu nên KHÔNG tự chạy trong db:setup hay khi deploy Vercel/Neon production. Chỉ chạy khi gọi tay npm run demo:seed hoặc đặt DEMO_SEED=1; README ghi rõ cách xóa người dùng demo (nút xóa tiến độ/xóa ngân hàng trong admin) trước khi dùng thật.
- Test e2e dùng người dùng demo để chạy một bài đủ 7 dạng; thêm vào demo tĩnh (demo/model.ts) cùng bộ câu hỏi để Vercel demo cũng thấy đủ dạng.

Bước 7. Kiểm thử và tài liệu: xem mục 6. Cập nhật README, QA_REPORT.md và mục "Kết quả triển khai" cuối file này.

6. Kiểm thử

- Unit: từng dạng (parse, chuẩn hóa, chấm, hiển thị đáp án đúng); nhiều biến thể nhập (0.5, 1/2, ".50", khoảng trắng, dấu phẩy thập phân, đơn vị, chữ hoa/thường, dấu tiếng Việt); đầu vào độc hại (JSON hỏng, quá dài, sai kiểu).
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
5) Người dùng demo/mật khẩu 123 chỉ tạo khi gọi tay (không chạy khi deploy production): đồng ý không?
6) Có cần migration SQLite không, hay chỉ PostgreSQL như v3 (test dùng prisma db push)?

11. Kết quả triển khai và khác biệt so với kế hoạch

Các câu hỏi mở ở mục 10 được làm theo mặc định đề xuất: chỉ chữ/số, dạng nhập số làm trước, bài hiện có giữ 100% trắc nghiệm, đúng/sai tuyệt đối (không chấm từng phần), người dùng demo chỉ tạo khi gọi tay, có cả migration SQLite và PostgreSQL, answer_data dùng JSON.

Đã làm:
- Schema và migration (SQLite và PostgreSQL, chỉ thêm cột có mặc định): Question.questionType, Question.answerData.
- src/lib/question-types: 6 dạng mới (NUMERIC_INPUT, TRUE_FALSE, MULTI_SELECT, FILL_BLANK, ORDERING, SHORT_TEXT) cộng MCQ, gồm kiểm tra cấu hình, chuẩn hóa trả lời, chấm, hiển thị đáp án đúng, và chế độ xem cho học sinh không lộ đáp án. Mục 3A: không phân biệt hoa/thường, bỏ khoảng trắng thừa, chuẩn hóa Unicode, tùy chọn ignoreDiacritics và caseSensitive.
- Chấm bài, lưu trả lời (saveAnswer kiểm tra theo dạng), trang xem lại kết quả, XP/kỹ năng không đổi.
- Kiểm tra ngân hàng theo dạng; CSV nhập/xuất (cột question_type, answer_data), file mẫu có 6 ví dụ mới; admin sửa answer_data của câu đã có.
- Giao diện học sinh: QuestionInput cho 7 dạng, lưu tự động (xếp hàng đợi), EN/VI.
- Người dùng demo (demo / 123) và ngân hàng "Demo - all question types" (18 câu, đủ 7 dạng) qua npm run demo:seed; không chạy khi deploy.
- Sao lưu tiến độ: nhận bài có ít hơn 30 câu và đáp án nhiều dạng; chữ ký ngân hàng giữ nguyên với câu trắc nghiệm nên sao lưu cũ vẫn khôi phục được.

Khác biệt so với kế hoạch (chưa làm, cần ghi nhận):
- Máy sinh đề chưa có template cho dạng mới và chưa có tỷ lệ dạng trong bài; ngân hàng sinh vẫn 100% trắc nghiệm. Câu dạng mới hiện thêm bằng CSV.
- Smart Review và "Try a Similar Question" vẫn chỉ trắc nghiệm (câu hỏi ôn tập sinh từ template).
- Demo tĩnh trên Vercel (demo/) vẫn chỉ trắc nghiệm; dạng mới xem được bằng người dùng demo trong ứng dụng đầy đủ.
- Trình quản lý admin chưa có form tạo mới từng dạng, chỉ sửa answerData bằng JSON; chưa có xem trước tương tác như học sinh.
- Ngân hàng demo không đủ 30 x 30 nên bước Validate trong admin báo thiếu bài; nó được publish trực tiếp bởi script.
- Chưa kiểm thử trên PostgreSQL/Neon thật: schema PostgreSQL qua prisma validate đạt, SQL migration đọc lại bằng mắt.

Kiểm thử đã chạy: typecheck, lint, vitest (unit và integration, có test mới cho từng dạng, CSV, demo, sao lưu, import/export), Playwright (27 test, gồm bài mới chạy đủ các dạng bằng người dùng demo, và 2 test demo tĩnh). Hai test cũ phải đổi số kỳ vọng vì tiêu đề CSV có thêm 2 cột và file mẫu có 9 ví dụ thay vì 3.
