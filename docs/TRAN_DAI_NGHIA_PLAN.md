KẾ HOẠCH: CHUYÊN MỤC "TRẦN ĐẠI NGHĨA CHALLENGE"
Ngày lập: 17/10/2026
Trạng thái: CHỜ DUYỆT. Chưa viết code, chưa đổi database, chưa tạo migration.
Phạm vi tài liệu: chỉ phân tích và lập kế hoạch kỹ thuật.

======================================================================
0. TÓM TẮT VÀ CÁC ĐIỂM CẦN BẠN QUYẾT ĐỊNH
======================================================================

Đề xuất cốt lõi: xây chuyên mục mới như một "module song song" với bảng dữ liệu riêng
(tiền tố Tdn), route riêng (/tdn), service riêng. Tái sử dụng: đăng nhập học sinh, hồ sơ
user, KaTeX/RichText, thư viện toán Fraction/evalExpr, cơ chế mastery/spaced review,
recharts, i18n, quy trình admin (nháp -> kiểm định -> xuất bản), cách ghi tiến độ SkillEvent.
KHÔNG sửa bảng Question/Test/QuestionBank, KHÔNG đổi định dạng CSV 20 cột hiện có,
nên 30 bài kiểm tra hiện tại (xem mục 0.1) không bị ảnh hưởng.

Lý do không nhét vào bảng Question hiện tại: Question cố định 4 phương án A-D, 1 đáp án chữ,
testNumber 1-30, position 1-30, 1 điểm/câu, validator chỉ hiểu số học thuần. Bài Trần Đại Nghĩa
có nhiều ý a, b, đáp số, tự luận, hình vẽ, thang điểm lẻ. Mở rộng Question sẽ chạm vào
validator, import, export, chấm điểm, Smart Review và 116 test hiện có: rủi ro cao.

0.1 Điểm cần xác nhận về "Set 1, Set 2, Set 3"
Trong mã nguồn KHÔNG có khái niệm "Set 1/2/3". Cái gần nhất là 30 bài Math Test chia 3 mức:
Beginner (bài 1-10), Intermediate (11-20), Advanced (21-30), mỗi bài 30 câu, 30 phút.
Kế hoạch này giữ nguyên toàn bộ 30 bài/900 câu đó. Nếu "Set 1-3" là thứ khác (ví dụ
ngân hàng/bank phiên bản 1-3, hoặc 3 file khác ngoài repo), xin cho biết để tôi bảo vệ đúng thứ đó.

0.2 Điểm cần xác nhận về tên project
Bạn nhắc project "test"; thư mục thực tế là repo Kenny-math (package kenny-math-challenge).
Kế hoạch lập cho repo này.

0.3 Các quyết định cần bạn chọn (mục 11 có chi tiết)
 1) Ai thấy chuyên mục: chỉ user trandainghia (và user admin bật), hay mọi học sinh.
 2) Chấm tự luận: học sinh tự chấm theo barem (đề xuất), hay phụ huynh/admin chấm.
 3) Bản quyền nội dung đề: lưu nguyên văn đề chính thức, hay chỉ lưu bản diễn đạt lại/biến thể.
 4) Mật khẩu 123 cho trandainghia (theo yêu cầu) có chấp nhận trên bản production hay không.
 5) Cho phép tôi nhập đề từ nguồn nào, vì sandbox hiện chặn 2 link nguồn (mục 2).

======================================================================
1. ĐÁNH GIÁ HỆ THỐNG KENNY MATH HIỆN TẠI
======================================================================

1.1 Công nghệ
- Next.js 15 (App Router) + React 19 + TypeScript + Tailwind; một codebase gồm cả giao diện
  và API (route handlers trong src/app/api). Không có backend riêng.
- Prisma 6. Local: SQLite (prisma/schema.prisma). Production (Vercel + Neon): PostgreSQL
  schema RIÊNG tại prisma/postgres/schema.prisma với migration riêng. Mọi thay đổi bảng phải làm
  ở cả hai nơi và có test kiểm tra đồng nhất (tests/deployment/postgres.test.ts).
- Thư viện: KaTeX (công thức), recharts (biểu đồ), PapaParse (CSV), zod (kiểm tra dữ liệu),
  bcryptjs (mật khẩu), Vitest (unit + integration), Playwright (E2E).
- Có "static demo" không DB (thư mục demo/, scripts/build-demo.mjs): module mới không cần hỗ trợ demo này.

1.2 Cấu trúc ngân hàng câu hỏi
- QuestionBank (version, status DRAFT/VALIDATING/READY_FOR_REVIEW/PUBLISHED/ARCHIVED, isActive,
  ownerId cho bank riêng của một user) -> Test (30 bài/bank) -> Question (30 câu/bài).
- Question: questionText, optionA-D, correctAnswer (A-D), explanation, commonMistake,
  learningTip, difficulty 1-5, topic, skill, verifyExpr, validationStatus
  (PENDING/VERIFIED/NEEDS_REVIEW/INVALID/MANUAL_OK).
- Bank đã PUBLISHED là bất biến; sửa phải clone ra bank mới. Mỗi học sinh được gán 1 bank
  (StudentBankAssignment). Bài đang làm giữ nguyên câu hỏi dù bank đổi.
- 900 câu hiện được SINH TỰ ĐỘNG từ ~14 nhóm template (src/lib/gen/templates/*), mỗi template có
  expression kiểm chứng độc lập (verify) và tùy chọn check() brute-force. Có fingerprint chống trùng.

1.3 Database schema (tóm tắt)
Student, StudentSession, StudentBankAssignment, QuestionBank, Test, Question, TestAttempt
(questionOrder JSON, hạn giờ lưu ở server, inProgressKey chống mở 2 lượt), StudentAnswer,
ReviewSession/ReviewQuestion (Smart Review), SkillEvent, SkillProgress, AdminUser/AdminSession/
AdminAuditLog, ImportJob, Setting. Student.preferences là chuỗi JSON (hiện có {lang}).

1.4 API hiện tại (src/app/api)
- Học sinh: /api/student/{login,logout,password,lang}, /api/attempts (+ /[id], /[id]/answer, /[id]/submit),
  /api/review/{smart,answer,similar}. Danh tính lấy từ cookie phiên (requireStudent), kiểm tra Origin chống CSRF.
- Admin: /api/admin/{login,logout,settings,users,progress,banks,import,template}, trong đó banks có
  publish/activate/archive/clone/validate/generate/export/questions.

1.5 Hệ thống chấm bài (src/lib/grading.ts, services/attempts.ts)
- Chỉ trắc nghiệm A-D: 1 điểm/câu đúng, không trừ điểm. Chấm ở server khi nộp/hết giờ,
  idempotent, ghi SkillEvent để cập nhật mastery. Không có khái niệm điểm theo ý, điểm lẻ,
  đáp số tự nhập, tự luận.

1.6 Import/export CSV
- 16 cột lõi + 4 cột tùy chọn (bank_id, bank_version, verify_expr, validation_status),
  PapaParse, tự nhận mã hóa (UTF-8/BOM/UTF-16/Windows-1252), chống CSV injection (sanitizeCell),
  giới hạn kích thước. Quy trình: upload -> báo cáo kiểm tra (ImportJob) -> commit thành bank nháp
  -> publish. Mỗi dòng = 1 câu 4 đáp án => KHÔNG biểu diễn được bài nhiều ý/đáp số/tự luận/hình.

1.7 Hình ảnh và SVG
- Không hỗ trợ. RichText/TestRunner chỉ render văn bản + KaTeX (\( ... \)) qua dangerouslySetInnerHTML
  sau khi KaTeX/escape. Không có SVG, không upload ảnh, không có kho lưu file (Vercel không có ổ ghi bền).
  Các câu hình học hiện nay mô tả bằng chữ.

1.8 Học tập thích ứng (tái sử dụng được)
- SkillEvent -> computeSkillState (mastery, ôn lặp theo khoảng ngày, cấu hình riêng từng user),
  planSession chọn bài yếu, adaptive.chooseTier. Smart Review dùng generator template,
  tách biệt với bank chính thức.
- Lưu ý: review.ts lọc SkillProgress theo skill có trong registry hiện tại. Nếu dùng skillId tiền tố
  "tdn." thì Smart Review cũ sẽ tự bỏ qua => hai hệ thống không lẫn dữ liệu (có lợi).

1.9 Điểm mạnh cần giữ / hạn chế
Giữ: auth đa user, kiểm định tự động, bất biến khi publish, test đầy đủ, hai schema DB đồng bộ.
Hạn chế: ràng buộc cứng 30x30 A-D; validator chỉ hiểu số học; không SVG; CSV phẳng; nhiều chỗ mặc định
STUDENT_ID='kenny' (phải luôn truyền studentId của phiên khi gọi service mới).

======================================================================
2. NGHIÊN CỨU ĐỀ THI TRẦN ĐẠI NGHĨA (TRẠNG THÁI: CHƯA KIỂM CHỨNG)
======================================================================

2.1 Tình trạng truy cập nguồn
Hai link bạn đưa (cmath.edu.vn, thuvienphapluat.vn) không mở được từ môi trường hiện tại
(lỗi phân giải tên miền). Vì vậy CHƯA có câu nào được đối chiếu với đề/đáp án chính thức.
Theo nguyên tắc của bạn, mọi thông tin dưới đây là giả định để thiết kế, KHÔNG phải dữ liệu nội dung.

2.2 Thông tin sơ bộ (từ kết quả tìm kiếm báo chí, cần đối chiếu đề gốc)
- Đề khảo sát gồm phần trắc nghiệm và tự luận; tổng 90 phút (30 phút trắc nghiệm, 60 phút tự luận)
  theo cấu trúc công bố cho năm 2024-2025.
- Toán thuộc "toán học và tư duy logic", nằm chủ yếu ở phần tự luận; có năm báo chí ghi nhận nhiều câu
  Toán ở phần trắc nghiệm. Tỷ lệ điểm trắc nghiệm/tự luận từng được nêu 40/60 (chưa rõ phần Toán chiếm bao nhiêu).
- Một dạng bài được nhắc: bài giải bóng đá (thắng 3 điểm, hòa 1 điểm, tìm số trận thắng/hòa).
Hệ quả thiết kế: cấu trúc đề mô phỏng phải CẤU HÌNH ĐƯỢC (mục 9, MockTemplate JSON), không viết cứng.

2.3 Quy trình nghiên cứu nội dung (sẽ thực hiện ở Giai đoạn 0, khi có truy cập nguồn)
Với mỗi đề 2022-2026: ghi năm, nguồn, link, loại nguồn (đề chính thức Sở/Trường, báo, trung tâm),
có đáp án chính thức/thang điểm hay không; từng bài: chuyên đề, số ý, dạng đáp án, thang điểm, có hình không.
Mỗi bài được gắn nhãn tin cậy:
 - OFFICIAL_VERIFIED: đề + đáp án chính thức, tôi tự giải lại và khớp.
 - REPORTED: nguồn thứ cấp (báo/trung tâm), tôi tự giải lại và khớp, chưa có đáp án chính thức.
 - AUTHORED: do chúng ta tự soạn theo dạng, có solver kiểm chứng.
Bài đáp án khác nhau giữa các nguồn => đánh dấu CONFLICT, không đưa vào đề thi thử cho tới khi giải quyết.
Kết quả giai đoạn này là bảng "Bản đồ chuyên đề" (số bài/năm/chuyên đề) để bạn duyệt, trước khi nhập nội dung.

2.4 Tám nhóm chuyên đề (mã dự kiến, tiền tố tdn.)
 1 pattern      Quy luật số và quy luật hình
 2 digits       Đếm chữ số, chia hết, phép chia có dư
 3 logic        Suy luận logic và mã hóa ký hiệu
 4 counting     Đếm cách, tổ hợp đơn giản
 5 geometry     Hình học ghép hình, tính diện tích
 6 backward     Tư duy ngược và toán nhiều bước
 7 tables       Bảng số và quy luật vị trí
 8 realworld    Toán thực tế, chuyển động
Mỗi nhóm có 3-6 kỹ năng con (skillId dạng tdn.pattern.seq-diff...), danh sách cụ thể chốt sau khi có bản đồ ở 2.3.

======================================================================
3. SO SÁNH HIỆN TRẠNG VỚI YÊU CẦU MỚI
======================================================================

Yêu cầu                               | Hiện có                         | Cần làm
--------------------------------------+---------------------------------+------------------------------
Tài khoản trandainghia / 123          | Có cơ chế user; seed 4 user    | Thêm vào seed (idempotent), bật tính năng
Luyện theo chuyên đề, 3 mức khó       | Có skill + tier 1-5 (Smart Rev) | Trang chọn chuyên đề, 3 mức riêng, bài tự soạn
Gợi ý khi làm sai                     | Chỉ có giải thích sau khi xong  | Gợi ý nhiều bậc theo từng ý
Lời giải chi tiết                     | Có explanation (text)           | Lời giải từng ý + hình minh họa
Thi thử đúng cấu trúc thật            | Cố định 30 câu A-D 30 phút      | MockTemplate cấu hình được, đề gồm bài nhiều ý
Bài nhiều ý a, b                      | Không                           | Bảng Part
Điền đáp số                           | Không                           | answerType số/phân số/danh sách/văn bản
Hình ảnh/SVG                          | Không                           | Mô tả hình bằng JSON -> SVG an toàn (mục 5)
Tự luận                               | Không                           | Rubric + tự chấm có hướng dẫn (mục 6)
Chấm theo từng ý                      | 1 điểm/câu                      | Điểm theo ý, điểm lẻ
Ngân hàng 300 bài chất lượng          | 900 câu sinh tự động            | Ngân hàng Tdn riêng, có gốc/biến thể
Lưu nguồn, năm, mức khó, lời giải     | Không có nguồn/năm              | Trường nguồn đầy đủ
Kiểm tra đáp án tự động               | Có cho số học                   | Solver theo bài + chạy lại chấm trên đáp án
Không trộn câu chưa kiểm định vào đề  | Có (chỉ bank PUBLISHED)         | Trạng thái APPROVED mới được vào đề
Lịch sử, thống kê lỗi, đề xuất, tiến bộ| Có cho 30 bài + Smart Review   | Trang tiến độ Tdn riêng, dùng lại mastery

======================================================================
4. THIẾT KẾ CẤU TRÚC NGÂN HÀNG CÂU HỎI (TDN)
======================================================================

Nguyên tắc: bảng mới, chỉ thêm (additive), không đụng bảng cũ. Khóa ngoại tới Student để thống kê.
Nội dung lưu dạng văn bản/JSON-string như phong cách hiện tại (tương thích SQLite và PostgreSQL).

4.1 Bảng đề xuất
TdnProblem  (một bài toán; có thể gồm nhiều ý)
  id, code (ví dụ TDN-PAT-0012, duy nhất), topicId, skillId, difficulty (1=Cơ bản, 2=Khá, 3=Nâng cao),
  kind (ORIGINAL | VARIANT), parentProblemId (null nếu là bài gốc), variantParams (JSON, tham số sinh biến thể),
  statement (văn bản + KaTeX), figureSpec (JSON mô tả hình, có thể rỗng), totalPoints (thang điểm tổng, ví dụ 2.0),
  solution (lời giải đầy đủ), commonMistake, learningTip,
  sourceKind (OFFICIAL_VERIFIED | REPORTED | AUTHORED), sourceName, sourceYear, sourceUrl, sourceRef (số bài trong đề),
  status (DRAFT | AUTO_VERIFIED | NEEDS_REVIEW | APPROVED | RETIRED), validationJson, validatedAt, reviewedBy/At,
  createdAt, updatedAt, contentHash (phát hiện sửa sau khi duyệt).
TdnPart  (một ý a, b, c... ; bài một ý thì có đúng 1 part label "")
  id, problemId, label, position, prompt, figureSpec (tùy chọn),
  answerType (NUMBER | FRACTION | TEXT_SHORT | CHOICE | LIST | ESSAY),
  answerKey (JSON: giá trị chính + các dạng chấp nhận + đơn vị + dung sai),
  points, rubric (JSON, bắt buộc với ESSAY: các bước + điểm từng bước),
  hints (JSON: 1-3 gợi ý tăng dần), solution (lời giải riêng của ý).
TdnMockTemplate  (cấu trúc đề thi thử, cấu hình được)
  id, name, durationSec, sections (JSON: danh sách phần, số bài, phân bố chuyên đề/độ khó, điểm), version, isActive.
TdnMockAttempt / TdnMockAnswer  (bài thi thử của học sinh)
  Attempt: studentId, templateId, problemOrder (JSON snapshot), startedAt, expiresAt, submittedAt, status,
  score, maxScore, selfGradePending (số ý tự luận chưa tự chấm).
  Answer (theo từng Part): attemptId, partId, rawAnswer, normalizedAnswer, awardedPoints, maxPoints,
  isCorrect, gradedBy (AUTO | SELF | ADMIN), rubricChecks (JSON), gradedAt.
TdnPracticeSession / TdnPracticeAnswer  (luyện theo chuyên đề)
  Session: studentId, topicId, difficulty, startedAt, completedAt, score.
  Answer: partId, attempts (số lần thử), hintsUsed, finalCorrect, points (giảm khi dùng gợi ý), revealedSolution.
Hình: không cần bảng riêng nếu dùng figureSpec JSON (mục 5).

Tái sử dụng bảng sẵn có (không đổi cấu trúc):
 - SkillEvent: source là String => ghi source='TDN', skillId 'tdn.<topic>.<skill>'. (Chỉ đổi kiểu TypeScript
   SkillEventInput.source từ 'TEST'|'REVIEW' thành thêm 'TDN'; không đổi database.)
 - SkillProgress: mastery/ôn lặp cho kỹ năng Tdn dùng chung hạ tầng.
 - AdminAuditLog: ghi lại thao tác admin trên ngân hàng Tdn.
 - Student.preferences (JSON): cờ {"tdn":true} để bật chuyên mục (xem mục 11). updateUser hiện đã giữ
   các khóa lạ trong preferences khi lưu; cần test xác nhận.

4.2 Bài gốc và biến thể
- Bài gốc (ORIGINAL): từ đề thật hoặc tự soạn theo dạng; do người duyệt cuối cùng.
- Biến thể (VARIANT): hai kiểu. (a) Tham số hóa: giữ nguyên cấu trúc, đổi số liệu qua variantParams, đáp án
  tính lại bằng solver => kiểm chứng tự động hoàn toàn. (b) Soạn tay biến thể về ngữ cảnh/hình: phải duyệt như bài gốc.
- parentProblemId cho phép: luyện "bài tương tự", truy vết lỗi gốc, thống kê phủ biến thể trên mỗi bài gốc.
- Chống trùng: fingerprint từ statement chuẩn hóa + tham số (cơ chế fingerprintOf hiện có làm mẫu).

4.3 Mục tiêu 300 bài (đề xuất phân bổ, điều chỉnh sau khi có bản đồ ở 2.3)
 - 8 chuyên đề x 3 mức khó. Ngưỡng nghiệm thu theo cổng: 60 bài (Giai đoạn 2) -> 150 (Giai đoạn 4) -> 300 (Giai đoạn 6).
 - Cơ cấu mục tiêu: khoảng 80-100 bài gốc (đề thật đã đối chiếu + bài tự soạn đúng dạng) và 200-220 biến thể.
 - Chất lượng trước số lượng: nếu chưa đạt chuẩn kiểm định thì dừng ở số bài đạt, không "độn" cho đủ 300.
 - Mỗi chuyên đề có tối thiểu 12 bài APPROVED ở mỗi mức khó trước khi mở cho học sinh.

4.4 Lưu nguồn và bản quyền
Trường sourceKind/sourceName/sourceYear/sourceUrl/sourceRef bắt buộc cho bài ORIGINAL. Đề thi do cơ quan giáo dục
công bố vẫn có thể có bản quyền trình bày/lời giải của bên thứ ba. Đề xuất: lưu nội dung đề đã chuẩn hóa và tự viết lời
giải; KHÔNG sao chép nguyên văn lời giải/đáp án từ trang thương mại. Bạn cần chọn mức ở mục 11 (câu hỏi 3).

4.5 Lưu trữ nội dung và nhập liệu
- Nguồn sự thật cho nội dung soạn thảo: file JSON trong repo (content/tdn/<chuyên đề>.json), có review qua Git,
  nhập vào DB bằng script/Admin (upsert theo code). Lý do: bài nhiều ý + hình + barem không hợp CSV phẳng.
- CSV: thêm định dạng CSV MỚI cho Tdn (mỗi dòng 1 ý; cột: problem_code, part_label, topic, skill, difficulty, kind,
  parent_code, statement, figure_spec_json, prompt, answer_type, answer_key_json, points, rubric_json, hint1-3,
  solution, source_*...). Bộ nhập/xuất CSV cũ giữ nguyên, tái dùng decode/chống CSV injection/giới hạn kích thước.
- Xuất ngân hàng Tdn ra JSON và CSV để sao lưu.

======================================================================
5. PHƯƠNG ÁN HỖ TRỢ HÌNH ẢNH / SVG
======================================================================

Ràng buộc: Vercel không có ổ ghi bền; chưa có kho file; hiện không có SVG; cần an toàn (không XSS) và dễ sinh biến thể.

Phương án đề xuất (A) - "Hình mô tả bằng JSON, render thành SVG ở server" (khuyến nghị)
 - figureSpec là JSON có kiểm tra bằng zod, ví dụ phần tử: lưới ô vuông, đoạn thẳng, đa giác, hình chữ nhật/tam giác/
   đường tròn/cung, điểm có nhãn, tô màu/hatch, kích thước ghi chú, bảng số, dãy hình quy luật.
 - Thành phần mới src/components/Figure.tsx + src/lib/figure/render.ts: JSON -> chuỗi SVG tự dựng từ danh sách
   phần tử cho phép (không nhận SVG thô từ người dùng) => không có script/event handler/ảnh ngoài.
 - Ưu điểm: an toàn, nhẹ, sắc nét mọi kích cỡ, hợp biến thể tham số (đổi kích thước là hình đổi theo),
   kiểm chứng được (ví dụ diện tích tính từ chính figureSpec để đối chiếu đáp án), in/đọc màn hình (kèm alt text).
 - Nhược: phải viết bộ vẽ; hình phức tạp ghép tay lâu hơn.

Phương án dự phòng (B) - SVG thô qua danh sách cho phép
 - Admin dán SVG, server làm sạch theo allowlist (svg,g,path,line,polyline,polygon,rect,circle,ellipse,text,defs?),
   cấm script, foreignObject, on*, href ngoài, style nguy hiểm; giới hạn kích thước (ví dụ 20KB).
 - Dùng cho hình đặc biệt mà bộ vẽ A chưa có. Phải có test XSS.

Không chọn (C) - Ảnh upload (PNG/JPG): cần dịch vụ lưu file (Vercel Blob/Neon storage), chi phí, quyền, backup;
 chỉ cân nhắc sau nếu có đề scan không thể vẽ lại.

Tích hợp: RichText hiện chỉ hỗ trợ \( ... \); sẽ thêm TdnStatement dựng từ RichText + Figure. Mỗi hình bắt buộc có altText.
Cần kiểm tra hiển thị trên điện thoại (viewBox co giãn) và in đề.

======================================================================
6. CÂU HỎI NHIỀU Ý VÀ TỰ LUẬN
======================================================================

6.1 Bài nhiều ý
- Problem chứa danh sách Part (a, b, c). Màn làm bài hiển thị đề chung + hình, rồi từng ý với ô nhập riêng.
- Điểm bài = tổng điểm các ý. Có thể có ý phụ thuộc ý trước (b dùng kết quả a): cho phép "carry-forward" -
  nếu a sai nhưng b đúng theo kết quả sai của a thì chỉ cho điểm khi rubric ghi rõ (mặc định không).

6.2 Kiểu đáp án
 - NUMBER: số nguyên/thập phân (nhận dấu phẩy kiểu Việt "3,5" và dấu chấm "3.5"), đơn vị tùy chọn, dung sai tùy chọn.
 - FRACTION: nhận a/b, hỗn số, số thập phân tương đương; so bằng Frac (đã có).
 - TEXT_SHORT: từ khóa/chuỗi ngắn, chuẩn hóa chữ hoa/dấu cách/bỏ dấu tùy cấu hình, danh sách đáp án chấp nhận.
 - CHOICE: trắc nghiệm A-D như hiện nay.
 - LIST: nhiều giá trị (ví dụ "7, 12, 19"), có thứ tự hoặc không thứ tự.
 - ESSAY: trình bày lời giải; xem 6.3.

6.3 Tự luận (không dùng AI trả phí)
- Hệ thống không tự chấm được văn bản tự do một cách đáng tin. Đề xuất: ESSAY gồm (1) ô nhập đáp số cuối (chấm tự động
  như NUMBER, thường chiếm phần lớn điểm), (2) ô trình bày (lưu văn bản, không bắt buộc), (3) sau khi nộp: lời giải mẫu +
  barem từng bước; học sinh/phụ huynh tích chọn các bước đã làm đúng => điểm tự chấm.
- Mọi điểm tự chấm được gắn nhãn "tự chấm" và hiển thị tách khỏi điểm tự động; thống kê tiến bộ chỉ dùng điểm tự động
  theo mặc định (có công tắc gộp). Admin có thể xem lại và chỉnh nếu chọn phương án chấm bởi admin.
- Giai đoạn sau (không nằm trong phạm vi hiện tại): chấm có hỗ trợ AI, cần quyết định chi phí và quyền riêng tư.

======================================================================
7. CƠ CHẾ CHẤM ĐIỂM VÀ KIỂM ĐỊNH ĐÁP ÁN
======================================================================

7.1 Chấm điểm (module thuần, src/lib/tdn/grading.ts, có unit test, không phụ thuộc DB)
 - gradePart(part, rawAnswer) -> {normalized, awarded, max, status}. Chuẩn hóa: cắt khoảng trắng, đổi dấu phẩy thập phân,
   bỏ dấu ngăn nghìn, chuẩn hóa phân số/hỗn số, so sánh bằng Frac để tránh sai số số thực.
 - Điểm theo ý, cho phép điểm lẻ (0.25, 0.5...). Lưu bằng số nguyên "phần trăm điểm" (x100) để tránh sai số thập phân.
 - Không trừ điểm khi sai. Thi thử: đáp số đúng nhưng thiếu trình bày (ESSAY) -> điểm phần đáp số tự động + phần còn lại do tự chấm.
 - Chấm ở server, idempotent, đồng hồ ở server, nộp trễ ân hạn như attempts.ts (tái dùng mẫu startAttempt/saveAnswer/finalizeAttempt).
 - Chế độ luyện: sai -> hiện gợi ý bậc 1 -> thử lại -> bậc 2 -> bậc 3 -> xem lời giải. Điểm luyện = điểm ý trừ theo số gợi ý
   đã dùng (tham số cấu hình). Mỗi lần thử ghi nhận để thống kê "sai ở đâu".

7.2 Kiểm định đáp án trước khi vào ngân hàng (cổng chất lượng)
Trạng thái bài: DRAFT -> AUTO_VERIFIED -> APPROVED (hoặc NEEDS_REVIEW/RETIRED).
 Lớp 1 - Cấu trúc: zod kiểm tra đủ trường, KaTeX hợp lệ, hình render được, tổng điểm các ý = totalPoints, có >=1 gợi ý mỗi ý
   ở mức Cơ bản/Khá, ESSAY có rubric cộng đúng điểm ý.
 Lớp 2 - Chấm lại: đưa chính answerKey qua gradePart phải ra điểm tối đa; đưa các "đáp án sai điển hình" khai báo kèm bài phải ra 0.
 Lớp 3 - Solver độc lập: mỗi bài ORIGINAL (hoặc template biến thể) có một hàm giải bằng cách khác lời giải mẫu
   (brute-force/duyệt/mô phỏng), đặt trong src/lib/tdn/solvers/<chuyên đề>.ts; kết quả phải khớp answerKey. Bài chưa viết được solver
   chỉ được phép ở NEEDS_REVIEW và phải có người duyệt tay.
 Lớp 4 - Đối chiếu nguồn: với sourceKind OFFICIAL_VERIFIED/REPORTED, so đáp số với đề/đáp án gốc; lệch => CONFLICT, khóa lại.
 Lớp 5 - Duyệt người: APPROVED chỉ cấp khi lớp 1-4 qua và có người duyệt (admin hoặc bạn) ghi reviewedBy/At.
 Lớp 6 - Bất biến: contentHash lưu lúc APPROVED; sửa nội dung => tự về DRAFT và phải kiểm định lại.
 Biến thể tham số: sinh -> chạy solver -> chạy lớp 1-2 -> chỉ nhận nếu qua; kế thừa APPROVED của template chỉ khi
 template đã APPROVED và mọi biến thể qua solver.
7.3 Không trộn câu chưa kiểm định
 - Dịch vụ ghép đề thi thử CHỈ truy vấn status=APPROVED (ràng buộc ở tầng service + test chặn).
 - Luyện theo chuyên đề cũng chỉ lấy APPROVED. Admin có chế độ "xem thử bài nháp" tách riêng, không ghi tiến độ.
 - Đề đã giao cho học sinh lưu snapshot (problemOrder + nội dung hash), bài bị RETIRED sau này không làm đổi bài đang làm.
7.4 Báo cáo chất lượng: lệnh npm run tdn:qa (mới) sinh qa/tdn-content-report.md: số bài theo chuyên đề x mức khó x trạng thái, bài thiếu
 solver/gợi ý, bài lệch nguồn, bài trùng fingerprint.

======================================================================
8. KẾ HOẠCH TRIỂN KHAI THEO GIAI ĐOẠN
======================================================================
Mỗi giai đoạn nhỏ, merge được độc lập, không phá chức năng cũ; sau mỗi giai đoạn chạy toàn bộ npm test, typecheck, lint
(và E2E khi đụng giao diện). Chỉ bắt đầu giai đoạn k+1 khi bạn duyệt giai đoạn k.

Giai đoạn 0 - Nghiên cứu nội dung (không đổi code)
 - Mở được nguồn (cung cấp file PDF/ảnh đề nếu sandbox vẫn chặn), lập bản đồ chuyên đề + bảng tin cậy nguồn (mục 2.3).
 - Chốt danh sách kỹ năng con, cấu trúc đề mô phỏng, mức khó 1-3, tiêu chí barem.
 - Đầu ra: docs/TDN_CONTENT_MAP.md để bạn duyệt. Chưa có DB.

Giai đoạn 1 - Nền tảng dữ liệu và lõi thuần (CẦN BẠN DUYỆT MIGRATION)
 - Thêm các bảng Tdn* vào cả hai schema + migration SQLite và PostgreSQL (chỉ CREATE TABLE/INDEX, không ALTER/DROP bảng cũ).
 - Module thuần: tdn/types, tdn/grading, tdn/normalize, figure spec schema; unit test.
 - Seed user trandainghia (idempotent) + cờ bật tính năng. Chưa có giao diện.
 - Tiêu chí xong: test cũ vẫn đạt nguyên vẹn; test deployment kiểm đồng nhất schema đạt; migration chạy trên bản sao dữ liệu.

Giai đoạn 2 - Hình SVG và ngân hàng mẫu (khoảng 60 bài)
 - Figure renderer + sanitizer dự phòng + test XSS; trình xem trước trong admin.
 - Importer JSON/CSV Tdn + validator 6 lớp (mục 7.2) + admin xem/duyệt bài.
 - Nhập 60 bài đầu (8 chuyên đề, ưu tiên dạng thường gặp), có solver.
 
Giai đoạn 3 - Luyện theo chuyên đề (học sinh)
 - /tdn, /tdn/practice: chọn chuyên đề + 3 mức, làm từng ý, gợi ý nhiều bậc, lời giải chi tiết, ghi SkillEvent.
 - Nút "bài tương tự" dùng biến thể.

Giai đoạn 4 - Thi thử (mô phỏng cấu trúc thật; ngân hàng khoảng 150 bài)
 - MockTemplate cấu hình được; ghép đề từ bài APPROVED theo phân bố chuyên đề/độ khó, không trùng đề gần đây.
 - Màn làm bài nhiều ý, nhập đáp số, hình, tự luận; đồng hồ ở server; chấm theo ý; trang kết quả + tự chấm barem.

Giai đoạn 5 - Theo dõi kết quả
 - /tdn/progress: lịch sử, lỗi theo chuyên đề, xu hướng điểm, kỹ năng yếu, đề xuất bài luyện (dựa planSession/mastery),
   biểu đồ recharts; trang tổng quan admin cho user này.

Giai đoạn 6 - Hoàn thiện ngân hàng 300 bài và nghiệm thu
 - Bổ sung đến mục tiêu bằng bài gốc + biến thể đạt chuẩn; báo cáo chất lượng; E2E toàn luồng; i18n Việt/Anh cho giao diện;
   cập nhật README/PLAN; rà soát truy cập/phân quyền; chạy thử trên nhánh Neon rồi mới production.

Ước lượng thô (1 người + Claude, chưa gồm thời gian soạn/duyệt nội dung): G1 ~2-3 buổi, G2 ~3-4, G3 ~2-3, G4 ~3-4, G5 ~2, G6 phụ thuộc tốc độ duyệt bài.
Nút thắt thật sự là soạn và đối chiếu nội dung chứ không phải code.

======================================================================
9. CÁC TỆP CODE CẦN SỬA HOẶC TẠO MỚI (DỰ KIẾN)
======================================================================

9.1 Tạo mới
 prisma/migrations/<ts>_tdn_core/migration.sql                 (SQLite)
 prisma/postgres/migrations/<ts>_tdn_core/migration.sql        (PostgreSQL)
 src/lib/tdn/types.ts, topics.ts (8 nhóm + skill), normalize.ts, grading.ts, rubric.ts
 src/lib/tdn/solvers/*.ts, src/lib/tdn/variants/*.ts           (solver và template biến thể)
 src/lib/tdn/validate.ts                                       (6 lớp kiểm định)
 src/lib/tdn/import.ts, export.ts, csv.ts                      (JSON/CSV Tdn)
 src/lib/figure/{schema,render,sanitize}.ts
 src/lib/services/tdn-bank.ts, tdn-practice.ts, tdn-mock.ts, tdn-progress.ts
 src/components/Figure.tsx, tdn/{PartInput,PracticeRunner,MockRunner,ResultView,SelfGrade,TdnProgress}.tsx
 src/app/(student)/tdn/{page,practice/page,practice/[sid]/page,mock/page,mock/[id]/page,results/[id]/page,progress/page}.tsx
 src/app/api/tdn/{practice,mock,answer,submit,progress}/...    (route handlers dùng requireStudent)
 src/app/admin/(protected)/tdn/{page,problems,import,quality}/...  và /api/admin/tdn/...
 content/tdn/*.json                                            (nội dung bài)
 scripts/tdn-import.ts, tdn-qa.ts
 tests/unit/tdn-*.test.ts, tests/integration/tdn-*.test.ts, tests/e2e/tdn.spec.ts
 docs/TDN_CONTENT_MAP.md (G0), qa/tdn-content-report.md

9.2 Sửa (thay đổi nhỏ, có kiểm soát)
 prisma/schema.prisma, prisma/postgres/schema.prisma   thêm model Tdn* và quan hệ ngược từ Student
 prisma/seed.ts, src/lib/services/users.ts             thêm trandainghia vào khởi tạo idempotent (không đặt lại mật khẩu đã có)
 src/lib/services/skills.ts                            mở rộng kiểu source thêm 'TDN' (không đổi DB)
 src/components/Nav.tsx, src/lib/i18n.ts               mục menu "Trần Đại Nghĩa" (hiện theo cờ bật), chuỗi Việt/Anh
 src/app/(student)/page.tsx                            thẻ vào chuyên mục
 src/app/admin/(protected)/layout (menu) và trang hồ sơ user  công tắc bật/tắt chuyên mục
 package.json                                          script tdn:import, tdn:qa
 tests/deployment/postgres.test.ts                     mở rộng kiểm đồng nhất schema cho Tdn
 README.md, PLAN.md                                    mô tả chuyên mục
KHÔNG sửa: src/lib/grading.ts, csv/*, validate/*, gen/*, services/attempts.ts, banks.ts, importer.ts, review.ts và các test hiện có.

======================================================================
10. RỦI RO ẢNH HƯỞNG DỮ LIỆU VÀ CHỨC NĂNG CŨ
======================================================================

Rủi ro                                              | Mức  | Biện pháp
----------------------------------------------------+------+-------------------------------------------------------------
Migration trên Neon production                       | Cao  | Chỉ CREATE mới; thử trên nhánh Neon/bản sao; snapshot Neon trước khi áp dụng; cần bạn duyệt riêng
Lệch schema SQLite và PostgreSQL                     | TB   | Test đồng nhất sẵn có mở rộng; viết migration song song
Build Vercel tự chạy migrate + seed                  | TB   | Seed idempotent, không đặt lại mật khẩu/tiến độ; test seed chạy 2 lần
Làm hỏng test/E2E hiện có (116 + 19)                 | TB   | Không sửa module cũ; chạy full suite mỗi giai đoạn; nhánh riêng
Smart Review/mastery lẫn skill Tdn                   | Thấp | Tiền tố tdn.; review.ts đã lọc theo registry; thêm test chặn
preferences JSON ghi đè cờ                           | Thấp | updateUser giữ khóa lạ; thêm test; cân nhắc cột riêng nếu cần
XSS qua SVG/văn bản bài                              | Cao  | Phương án A không nhận SVG thô; allowlist + test XSS cho B; KaTeX trust:false
Đáp án sai trong ngân hàng                           | Cao  | Cổng 6 lớp, solver độc lập, đối chiếu nguồn, người duyệt, bất biến theo hash
Nội dung nguồn không xác minh được                   | Cao  | Nhãn tin cậy; CONFLICT bị khóa; không bịa bài "đề thật"
Bản quyền đề/lời giải                                | TB   | Tự viết lời giải; ghi nguồn; bạn quyết mức lưu nguyên văn (câu hỏi 3)
Tự luận chấm chủ quan                                | TB   | Tách điểm tự động/tự chấm; hiển thị rõ; mặc định thống kê chỉ dùng điểm tự động
Mật khẩu 123 cho trandainghia trên production        | TB   | Theo yêu cầu của bạn; khuyến nghị đổi sau khi triển khai; có giới hạn thử sai 5 lần/15 phút sẵn
Mặc định STUDENT_ID='kenny' trong service            | TB   | Mọi service Tdn bắt buộc truyền studentId từ phiên; test truy cập chéo user
Hình SVG nặng/không hiển thị trên di động            | Thấp | viewBox co giãn, kiểm tra Playwright mobile
Quy mô: 300 bài soạn/duyệt chậm                      | TB   | Cổng 60/150/300; chấp nhận ít bài hơn nhưng đạt chuẩn
Cấu trúc đề thật khác giả định                       | TB   | MockTemplate là cấu hình, chỉnh không cần sửa code

Nguyên tắc không phá hủy: không xóa/sửa dữ liệu cũ; không đổi bảng cũ; mọi thay đổi DB là thêm mới và cần duyệt;
mọi nhập/xóa ngân hàng Tdn có audit log và xuất sao lưu JSON trước khi thay thế.

======================================================================
11. CÂU HỎI CẦN BẠN QUYẾT ĐỊNH TRƯỚC KHI LÀM
======================================================================
 1) Hiển thị chuyên mục: (a) chỉ user trandainghia và user được admin bật [đề xuất]; (b) mọi học sinh.
 2) Tự luận: (a) học sinh/phụ huynh tự chấm theo barem [đề xuất]; (b) admin chấm; (c) chỉ chấm đáp số cuối.
 3) Nội dung đề: (a) lưu nguyên văn đề chính thức đã đối chiếu + lời giải tự viết; (b) chỉ lưu bản diễn đạt lại và biến thể [an toàn hơn về bản quyền].
 4) Mật khẩu 123 cho trandainghia trên production: chấp nhận hay đặt mật khẩu mạnh hơn.
 5) Nguồn đề: nếu sandbox tiếp tục không truy cập được cmath.edu.vn và thuvienphapluat.vn, bạn có thể gửi file PDF/ảnh đề + đáp án
    (hoặc chọn nguồn khác) để Giai đoạn 0 làm trên dữ liệu thật?
 6) "Set 1, Set 2, Set 3" là gì (mục 0.1)?
 7) Ngôn ngữ nội dung bài: chỉ tiếng Việt [đề xuất, vì đề thật là tiếng Việt] hay song ngữ Việt/Anh.
 8) Thứ tự ưu tiên nếu thời gian hạn chế: Luyện theo chuyên đề (G3) trước hay Thi thử (G4) trước.

Chưa có hạng mục nào được thực hiện. Sau khi bạn trả lời mục 11 và duyệt, tôi bắt đầu từ Giai đoạn 0 (không đổi code) rồi Giai đoạn 1.

======================================================================
12. QUYẾT ĐỊNH ĐÃ CHỐT (17/10/2026) - GHI ĐÈ CÁC MỤC TRƯỚC NẾU MÂU THUẪN
======================================================================
 1) "Set 1-3" = 30 bài Beginner/Intermediate/Advanced hiện có: giữ nguyên hoàn toàn.
 2) Hiển thị chuyên mục: chỉ user trandainghia và user được admin bật (cờ trong Student.preferences).
 3) KHÔNG chấm tự luận. Hệ quả: bỏ cơ chế tự chấm theo barem (mục 6.3) và cột gradedBy=SELF/ADMIN, rubric không bắt buộc.
    Ý tự luận chỉ hiển thị đề, ô nhập nháp (tùy chọn, không chấm) và lời giải mẫu sau khi nộp; không tính vào điểm/mastery.
    Điểm tự động chỉ gồm các ý có đáp số (NUMBER/FRACTION/TEXT_SHORT/CHOICE/LIST).
 4) Nội dung: chỉ lưu BIẾN THỂ/bản diễn đạt lại, không lưu nguyên văn đề chính thức. Bài gốc chỉ được ghi dạng
    "mô tả dạng bài + nguồn tham khảo" (không chép đề); bài lưu trong ngân hàng là bài tự soạn theo dạng, có số liệu/ngữ cảnh khác.
    sourceKind chuyển thành: DERIVED_FROM_OFFICIAL (biến thể từ dạng đề thật), AUTHORED. Đối chiếu đáp án nguồn dùng cho dạng, không chép lời giải.
 5) Mật khẩu 123 cho trandainghia trên production: chấp nhận.
 6) Nguồn đề: không có file; nghiên cứu qua tìm kiếm web. Kết quả và giới hạn: docs/TDN_CONTENT_MAP.md.

 7) Đã nhận PDF đề chính thức 2022, 2023, 2025 (và đáp án 2022, 2023). Chi tiết và đáp số tự giải lại: docs/TDN_CONTENT_MAP.md.
    Điều chỉnh: điểm phần Toán tự luận là 15 (không phải 20); bài cuối chấm theo bước. Đề xuất chuyển bài "trình bày" thành bài dẫn từng bước có đáp số (mục 4a của bản đồ).
Trạng thái: các quyết định trên chưa phải là phê duyệt triển khai code. Giai đoạn 1 (migration) vẫn chờ duyệt riêng.
