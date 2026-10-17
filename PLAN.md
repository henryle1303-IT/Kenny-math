# Cải tiến quản lý nhiều user — triển khai theo kế hoạch đã duyệt

Ngày lập: 17/10/2026. **Trạng thái: đã được người dùng yêu cầu triển khai. Đã triển khai production trên Vercel, áp dụng migration PostgreSQL và giữ dữ liệu cũ. Kiểm thử 116 tests và 19 E2E đã đạt; chi tiết phát hành tại `qa/admin-functional-report.md`.**

## 1. Mục tiêu và phạm vi

- Bổ sung đăng nhập bằng username/password cho phần học sinh; mỗi user có hồ sơ, mật khẩu, cấu hình và tiến độ độc lập.
- Admin có thẻ **User Profiles** để quản lý từng user, gán ngân hàng câu hỏi, import ngân hàng riêng và xem tiến độ riêng.
- Khởi tạo bốn tài khoản dưới đây, cùng sử dụng ngân hàng câu hỏi hiện có. Việc tạo tài khoản nằm trong giai đoạn triển khai sau duyệt.

| Username | Tên hiển thị ban đầu | Mật khẩu ban đầu | Ngân hàng ban đầu | Tiến độ ban đầu |
|---|---|---|---|---|
| `kenny` | Kenny | `123` | Ngân hàng hiện có đang kích hoạt | Giữ toàn bộ lịch sử Kenny |
| `henry` | Henry | `123` | Cùng ngân hàng với Kenny | Trống |
| `xoai` | Xoai | `123` | Cùng ngân hàng với Kenny | Trống |
| `moon` | Moon | `123` | Cùng ngân hàng với Kenny | Trống |

Mật khẩu `123` được áp dụng cho bốn tài khoản khởi tạo theo yêu cầu; mỗi tài khoản lưu hash riêng và có thể đổi mật khẩu độc lập. Không thay đổi tài khoản hay chính sách mật khẩu admin.

## 2. Hiện trạng đã kiểm tra

- `src/lib/services/core.ts` cố định `STUDENT_ID = 'kenny'`; `getStudent()` tự tìm/tạo Kenny và cấu hình học tập lấy từ setting chung `learningConfig`.
- Schema đã liên kết bài làm, phiên ôn tập, sự kiện kỹ năng và tiến độ với `studentId`; chưa có username, password hoặc session học sinh.
- Ngân hàng đang dùng `QuestionBank.isActive` toàn hệ thống; chưa có quyền sở hữu và ngân hàng đang học theo user.
- Admin Settings chỉnh tên một học sinh và cấu hình chung; Student Progress hiển thị một học sinh. Trang này cũng đang có phần backup tiến độ cần chuyển sang đúng user được chọn.
- Có SQLite cho local và schema/migrations PostgreSQL riêng cho triển khai; thay đổi dữ liệu phải đồng bộ cả hai.

## 3. Thiết kế giao diện dự kiến

### 3.1. Admin → User Profiles

- Danh sách user: username, tên hiển thị, trạng thái hoạt động, ngân hàng được gán, hoạt động gần nhất; có nút tạo user và mở hồ sơ.
- Hồ sơ từng user có các thẻ:
  - **Profile:** tên hiển thị, username duy nhất, ngôn ngữ EN/VI, trạng thái tài khoản.
  - **Learning Settings:** cấu hình khoảng ôn tập riêng, khởi tạo từ cấu hình hiện tại; thay đổi một user chỉ áp dụng cho user đó. Dùng quy tắc áp dụng hiện tại: lần cập nhật kỹ năng tiếp theo.
  - **Password:** admin đặt/reset mật khẩu; không hiển thị mật khẩu đã lưu. Đổi/reset mật khẩu thu hồi session học sinh cũ.
  - **Question Banks:** chọn ngân hàng chung được phép dùng, import ngân hàng riêng cho user, xem phiên bản và chọn ngân hàng đang học.
  - **Progress:** số bài hoàn thành, số lượt làm, điểm trung bình, biểu đồ điểm, kỹ năng, lịch sử bài làm và Smart Review.
- Giữ thao tác lưu/xuất/khôi phục/xóa tiến độ, nhưng tất cả phải ghi rõ user đích và chỉ tác động user đó. Thao tác thay thế/xóa giữ cơ chế xác nhận hiện có.
- Admin tiếp tục có phần quản trị ngân hàng chung và đổi mật khẩu admin như hiện tại.

### 3.2. Giao diện học sinh

- Thêm `/login`: username, password, thông báo sai thông tin và nút đăng nhập.
- Sau đăng nhập, hiển thị tên user đang dùng, đăng xuất và đổi mật khẩu cá nhân (cần mật khẩu hiện tại).
- Cá nhân hóa toàn bộ tên trên giao diện học sinh theo **tên hiển thị của user đang đăng nhập**: các chỗ đang ghi Kenny (tiêu đề, lời chào, điều hướng, nội dung hướng dẫn và nhãn liên quan) phải hiển thị đúng Kenny/Henry/Xoai/Moon hoặc tên mới do admin đặt. Rà soát cả bản tiếng Anh và tiếng Việt, tiêu đề trang và nhãn hỗ trợ truy cập; không cố định tên Kenny trong giao diện dùng chung.
- Tên hiển thị được lấy từ hồ sơ user, không suy ra từ username. Khi admin đổi tên hiển thị, giao diện phản ánh tên mới ở lần tải/làm mới tiếp theo; username đăng nhập giữ nguyên nếu admin chỉ đổi tên hiển thị.
- Giữ các luồng học hiện có: trang chủ, Tests, làm bài, Results, Review, Smart Review và My Progress; dữ liệu và cấu hình lấy từ session của user.
- Chưa đăng nhập thì chuyển đến trang đăng nhập; API học sinh trả lỗi xác thực. Không tự đăng nhập Kenny.
- Giai đoạn này chưa mở tự đăng ký, email khôi phục mật khẩu hoặc cho học sinh tự import. Admin import và quản lý ngân hàng riêng trong hồ sơ user.

## 4. Thiết kế dữ liệu và phân quyền dự kiến

| Thành phần | Thay đổi dự kiến |
|---|---|
| `Student` | Thêm `username` duy nhất, `passwordHash`, `isActive`; giữ `id`, tên và preferences hiện có |
| Cấu hình học tập | Lưu theo user bằng bản ghi riêng hoặc trường JSON đã kiểm tra; mỗi user nhận bản sao cấu hình hiện tại khi chuyển đổi |
| `StudentSession` | Session thuộc user, token hash, thời điểm tạo và hết hạn; cookie HttpOnly, SameSite, Secure trên production |
| `QuestionBank` | Thêm phạm vi chung/riêng và chủ sở hữu cho ngân hàng riêng; giữ nội dung và phiên bản hiện có |
| `StudentBankAssignment` | Liên kết user với ngân hàng được phép dùng và trạng thái đang học; tối đa một ngân hàng hoạt động cho mỗi user |
| `ImportJob` | Ghi nhận user đích và phạm vi từ bước upload đến commit; không được đổi user đích khi commit |
| Backup và audit | Khóa backup theo user; nhật ký có admin thao tác và user đích, không ghi mật khẩu/session token |

- Giữ `AdminUser` và cơ chế đăng nhập admin riêng; quyền admin không được suy ra từ username học sinh.
- Thay `getStudent()` cố định bằng lấy học sinh đã xác thực. API luôn lấy `studentId` từ session, không tin ID do trình duyệt gửi để xác định chủ dữ liệu.
- Kiểm tra quyền ở cả trang, API và service: bài làm, đáp án, kết quả, phiên ôn tập, dữ liệu kỹ năng và ngân hàng đều thuộc phạm vi user hợp lệ. User không đọc/sửa được dữ liệu user khác bằng cách đổi URL/ID.
- Kiểm tra quyền sở hữu của tài nguyên con (câu hỏi, đáp án) thông qua bài làm/phiên tương ứng; không gửi đáp án đúng trước thời điểm luồng học cho phép.
- Tận dụng cách băm mật khẩu, session token, kiểm tra origin và giới hạn thử đăng nhập của cơ chế admin hiện có cho cơ chế học sinh riêng.

## 5. Ngân hàng chung và import ngân hàng riêng

1. Khi chuyển đổi, gán cùng ngân hàng hiện có đang kích hoạt cho cả bốn user bằng liên kết; không nhân bản 900 câu hỏi cho từng user.
2. Nếu chưa có ngân hàng hợp lệ đang kích hoạt, kiểm tra và báo admin chọn ngân hàng hiện có trước khi hoàn tất khởi tạo; không tự tạo nội dung thay thế.
3. Admin chọn user trước khi import. Mặc định import thành ngân hàng riêng của user đó và hiển thị rõ đích trước khi lưu.
4. Tái sử dụng luồng CSV hiện tại: upload → kiểm tra → preview/báo lỗi → commit bản nháp → publish → gán/kích hoạt cho user đích.
5. Giữ quy tắc CSV hiện tại: ngân hàng đầy đủ 30 đề × 30 câu; cập nhật một phần tạo bản nháp từ ngân hàng nguồn được phép dùng. Không mở rộng định dạng import trong đợt này.
6. Nếu lấy ngân hàng chung làm nguồn cập nhật riêng, tạo bản sao riêng trước khi sửa. Việc kích hoạt ngân hàng riêng chỉ đổi liên kết user đích; không đổi ngân hàng của các user khác.
7. Bài làm đã bắt đầu giữ ngân hàng/câu hỏi gốc và thời hạn gốc. Lịch sử vẫn đọc được khi user được chuyển sang ngân hàng khác; kiểm tra quyền theo chủ bài làm và tham chiếu gốc.
8. Ngân hàng riêng chỉ được gán cho chủ sở hữu; admin có quyền quản lý tất cả. Không cho archive/xóa ngân hàng nếu làm hỏng lượt làm đang chạy hoặc lịch sử tham chiếu.

## 6. Bảo toàn dữ liệu và khởi tạo tài khoản

- Sao lưu dữ liệu trước migration; rà soát cả hai schema và tiến trình seed/build hiện có.
- Giữ nguyên `Student.id = 'kenny'`, nối tài khoản đăng nhập vào hồ sơ Kenny đang có để bảo toàn attempts, review, mastery, lịch ôn và backup hiện tại.
- Tạo Henry, Xoai, Moon với tiến độ trống; không sao chép tiến độ Kenny.
- Tách cấu hình chung hiện tại thành cấu hình khởi tạo riêng cho từng user; giữ ngôn ngữ Kenny và dùng giá trị mặc định ứng dụng cho user mới.
- Khởi tạo bốn tài khoản theo cơ chế chạy lặp an toàn: lần đầu đặt mật khẩu `123`; các lần seed/build sau không reset mật khẩu, cấu hình, ngân hàng đã gán hoặc tiến độ. Nếu gặp username trùng hồ sơ khác phải báo lỗi để xử lý, không tự gộp.
- Backup/restore phải kiểm tra user đích, các ngân hàng tham chiếu và phiên bản định dạng. File cũ của Kenny cần tương thích có kiểm soát; không cho khôi phục chéo user ngoài ý muốn.

## 7. Trình tự thực hiện sau khi duyệt

1. **Dữ liệu:** sao lưu, migration SQLite/PostgreSQL, tài khoản/session, cấu hình và liên kết ngân hàng; chuyển dữ liệu Kenny.
2. **Đăng nhập học sinh:** login/logout/đổi mật khẩu, bảo vệ toàn bộ trang và API, loại bỏ các chỗ cố định Kenny.
3. **Admin profiles:** danh sách/hồ sơ user, cấu hình và reset mật khẩu; xem tiến độ và quản lý backup theo user.
4. **Ngân hàng riêng:** phân quyền ngân hàng, import gắn user, publish/gán/kích hoạt riêng và giữ lịch sử.
5. **Khởi tạo bốn user:** gán ngân hàng đang có và kiểm tra bảo toàn dữ liệu cũ.
6. **Kiểm thử và bàn giao:** chạy kiểm tra phù hợp, cập nhật hướng dẫn; triển khai theo phạm vi được duyệt.

## 8. Tiêu chí nghiệm thu

- Bốn username `kenny`, `henry`, `xoai`, `moon` đăng nhập lần đầu với `123`; đổi mật khẩu một user không tác động user khác. Đăng xuất/reset mật khẩu làm session cũ mất hiệu lực theo thiết kế.
- Cả bốn truy cập cùng ngân hàng hiện có ngay sau khởi tạo; bài làm/điểm/ôn tập của từng người độc lập.
- Admin thay tên/ngôn ngữ/khoảng ôn tập/ngân hàng của Henry không thay cấu hình Kenny, Xoai, Moon.
- Khi đăng nhập từng user, mọi vị trí từng ghi Kenny trên giao diện học sinh phải hiển thị tên tương ứng của user đó. Đổi tên hiển thị Henry thành tên khác rồi tải lại phải thấy tên mới; chuyển tài khoản không còn hiển thị tên của user trước. Kiểm tra cả EN/VI và giao diện di động.
- Import và kích hoạt ngân hàng riêng cho Moon chỉ tác động Moon; lỗi CSV không tạo ngân hàng đã kích hoạt hay mất dữ liệu.
- Admin xem đúng tiến độ, backup, restore và xóa theo từng user; lịch sử Kenny trước chuyển đổi được giữ nguyên.
- User A không đọc hoặc ghi bài làm, kết quả, review, ngân hàng riêng của B qua URL/API; người chưa đăng nhập không gọi được API học sinh.
- Đổi ngân hàng giữa lúc làm bài không đổi câu hỏi hoặc timer của bài đang làm; đăng nhập user khác không hiện lại dữ liệu user trước trong giao diện/cache.
- Seed chạy lại không reset tài khoản; migration SQLite và PostgreSQL đều được kiểm tra. Chạy typecheck/lint, các kiểm thử đơn vị/tích hợp liên quan và E2E nhiều user cùng hồi quy luồng học/admin hiện có.

## 9. Phạm vi đã duyệt triển khai

Người dùng đã yêu cầu “implement plan.md”, bao gồm mục 1–8 và bổ sung cá nhân hóa tên giao diện. Admin quản lý/import ngân hàng cho từng user; học sinh đăng nhập, đổi mật khẩu và học theo cấu hình được gán. Các bước kiểm tra được ghi tại `qa/multi-user-report.md`.

---

# Kiến trúc và quyết định thiết kế trước cải tiến (tài liệu tham chiếu)

Phần dưới mô tả phiên bản một học sinh trước kế hoạch trên; các mục “completed” chỉ thuộc phiên bản cũ, không phải trạng thái của cải tiến nhiều user.

# Kenny Math Challenge – plan and design decisions

This document records the architecture and the decisions behind the implementation. It was written first and updated as the build progressed; where the final code differs from the first draft the final decision is what is described here.

## 1. Architecture

Single Next.js 15 application (App Router, TypeScript, React 19, Tailwind 3) with server components for read pages, route handlers for JSON APIs, and Prisma on SQLite.

```
src/lib/math      exact rational arithmetic (Frac), safe expression evaluator, option/TeX parsing
src/lib/gen       question generator: templates, engine, curriculum plan, 108 templates / 62 skills
src/lib/validate  question-level and bank-level validation (pure, no DB)
src/lib/csv       CSV export (BOM, formula escaping), import (encoding detection, papaparse, zod)
src/lib/learning  mastery, spaced review, adaptive difficulty, Smart Review planner (pure)
src/lib/services  database services (attempts, banks, importer, review, progress, admin-auth)
src/app           student pages, /admin pages, /api routes
tests/            unit (pure logic), integration (services + temp SQLite), e2e (Playwright)
```

Principles: pure logic is separated from database code so it can be unit-tested exhaustively; every state change that must be consistent (submitting a test, activating a bank, recording a review answer) is a single database transaction with an idempotent guard.

## 2. Technology choices

| Need | Choice | Why |
|---|---|---|
| Framework | Next.js 15 App Router, TypeScript | one deployable app for UI, API and admin |
| DB | SQLite + Prisma 6 | zero-ops for a single student; the schema uses only portable features (JSON stored as text, no SQLite-specific types) so moving to PostgreSQL means changing the provider and re-running migrations |
| Maths display | KaTeX (server-rendered) | fractions render correctly on phones, no layout shift |
| Charts | Recharts | simple, accessible enough with text alternatives |
| CSV | PapaParse | robust quoting/multiline/delimiter detection; no manual splitting |
| Validation | Zod (row schema) + own validators | |
| Passwords | bcryptjs (cost 12) | pure JS, no native build step |
| Tests | Vitest, Playwright | as specified |

No paid AI API is used anywhere. All maths content is produced and checked by deterministic code.

## 3. Database design

Tables: `Student`, `QuestionBank`, `Test`, `Question`, `TestAttempt`, `StudentAnswer`, `ReviewSession`, `ReviewQuestion`, `SkillEvent`, `SkillProgress`, `AdminUser`, `AdminSession`, `AdminAuditLog`, `ImportJob`, `Setting`.

Key decisions:
* `Question.questionId` is the stable human id (e.g. `T07-Q12`), unique **per bank**; the primary key is a separate cuid so the same id can exist in several banks. Matching for “update selected questions” uses `questionId`.
* A `TestAttempt` stores `bankId`, the **ordered list of question primary keys**, `startedAt` and `expiresAt`. Because published banks are immutable and attempts reference exact question rows, history can never change.
* `TestAttempt.inProgressKey` (`studentId:testNumber`, unique, nulled on submit) guarantees at most one open attempt per test, even with double clicks or two tabs.
* `StudentAnswer` is unique per (attempt, question); unanswered questions get a row at grading time.
* `SkillEvent` is an append-only log (one row per question answered, from tests and reviews). `SkillProgress` is a cache recomputed from the log, so rules can change without data loss.
* Only one `QuestionBank` has `isActive = true`; activation flips both flags inside one transaction.

## 4. Pages and navigation

Student: Home `/`, Math Tests `/tests`, test runner `/attempt/[id]`, results `/results/[id]`, answer review `/results/[id]/review`, Smart Review `/review` and `/review/[sid]`, My Progress `/progress`. The student UI has no admin links.

Admin (`/admin`, session cookie required): Dashboard, Question Manager, Question Generator, Import / Export, Bank Versions, Student Progress, Settings (spaced-review intervals, student name, password, activity log).

## 5. Question-generation strategy

* **Templates** (`src/lib/gen/templates/*`): 108 parameterised generators in 14 topics. Each takes a seeded RNG and a tier 1–5 and returns the question text, the correct option, hand-designed distractors that reflect typical mistakes, an independent verification expression, explanation steps, the common mistake and a learning tip.
* **Engine** (`engine.ts`) turns that into a finished question: exact-evaluates the verification expression (own evaluator, no `eval`), compares it with the marked option, runs an optional independent check (e.g. brute-force search for puzzle uniqueness), re-computes pure arithmetic from the displayed question text, rejects negative answers, builds three distinct distractors (padding numerically if needed, rejecting equal values such as `0.5` vs `1/2`), shuffles options and writes the structured explanation (“What it asks / Concept / Step n / Answer”).
* **Curriculum plan** (`curriculum.ts`, `bank.ts`): difficulty rating = f(test number, position band). Questions 1–10 / 11–20 / 21–25 / 26–30 form four bands; ratings rise across bands and across tests (Beginner ≈ 1–3, Intermediate ≈ 2–4, Advanced ≈ 3–5), so the first questions of Test 25 are harder than the first questions of Test 5. Each test contains a fixed topic mix (30 slots over 14 topics); topics are placed at positions where a suitable template exists, with a feasibility rule so harder topics never land on tier-1 positions. Templates are chosen by least-use balancing and avoiding repeated skills inside one test.
* **Uniqueness**: a fingerprint of (question text, correct option) must be new within the bank; generation retries with a different sub-seed otherwise.
* **Batches**: the admin UI generates three tests per request and shows progress; the plan is deterministic so batches are independent.
* **Smart Review** reuses the same templates, but through a separate path (`services/review.ts`), and never touches the official bank.

## 6. CSV import / export design

Columns: the 16 required stable columns, plus optional `bank_id`, `bank_version`, `verify_expr`, `validation_status`. `verify_expr` keeps the machine-checkable answer expression through a round trip so re-imported generated questions are verified again instead of being flagged for manual review. Export is UTF-8 with BOM, CRLF, quotes only when needed; cells beginning with `= + @ tab CR` (or `-` not followed by a digit) are prefixed with `'` and the importer reverses this.

Import pipeline: size/extension checks → encoding detection (BOM, UTF-16, UTF-8, Windows-1252 fallback) → PapaParse (delimiter auto-detected, `#` comment lines ignored) → required-column check → Zod row coercion → per-question validation → bank-level validation (900 questions, 30×30, unique ids/positions/texts, level mapping, rising difficulty) → report (rows valid/invalid/duplicate/missing/test-count/warnings/review) with preview and downloadable error CSV. The parsed rows are stored in an `ImportJob`; nothing touches question tables until the admin commits, and a failing full-bank file can never be committed. Modes: **A** new draft bank, **B** replace active (validated copy; publishing/activation additionally requires typing `REPLACE`), **C** update selected questions (matched by `question_id`, must keep test/position, saved as a new draft copy of the chosen bank).

## 7. Smart Review algorithm

* Every answered question (test or review) adds a `SkillEvent`.
* Per skill: recent accuracy over the latest 10 events; status thresholds <50 / 50–69 / 70–84 / ≥85 %; “Not Enough Data” below 3 attempts; “Mastered” also needs ≥5 attempts spread over ≥2 sessions.
* Spaced review: a session counts as correct if all its answers for the skill were correct; streak of correct sessions → next review after 0 / 1 / 3 / 7 days (configurable in Settings). Due skills appear under “Ready for Review”.
* Planner: priority = (1 − accuracy)·3 + 0.5·recent mistakes + 1 if due; picks up to 3 questions per skill, 10 in total, sorted from easier to harder tier; new students get a varied warm-up.
* Adaptive tier: accuracy bands map to tiers 1/2/3/4 and the tier may move by at most one step from the last tier used for that skill (first practice capped at 3).
* Sessions are untimed; answers are revealed one question at a time with an explanation for mistakes.

## 8. Admin authentication

* Admin users in the database with bcrypt hashes; the seed script takes `ADMIN_EMAIL` / `ADMIN_PASSWORD` or generates a random password and prints it once. Nothing is hard-coded in frontend code.
* Login creates a random 256-bit session token; only its SHA-256 is stored; cookie is `HttpOnly`, `SameSite=Lax`, `Secure` in production (override only for plain-HTTP deployments); sessions last 12 h.
* Every `/api/admin/*` handler calls `requireAdmin` (server side, database lookup) and rejects cross-site writes by comparing `Origin` with `Host`. Admin pages redirect to the login page when there is no valid session.
* Brute-force protection (5 failures per IP+email in 15 minutes), constant-time-ish login, upload limit 5 MB and extension check, audit log of every admin operation.

## 9. Testing strategy

* **Unit**: exact arithmetic, evaluator, option parsing, every template at every supported tier (valid, verified, consistent), bank plan (900 slots, topic mix, determinism, 900 distinct questions), difficulty rules, validators, CSV parsing/serialisation/round trip, grading, timer helpers, mastery, spaced review, adaptive difficulty, planner.
* **Integration** (real SQLite, services called directly): start/resume/save/submit, idempotency and concurrency, expiry auto-submit, attempt history, skill events, Smart Review sessions, similar questions, CSV round trip into a new bank, rejection of broken files, all three import modes, publishing rules, immutability of published banks, in-progress attempts surviving a bank switch, rollback, deletion safeguards, admin login/rate limit/CSRF/audit.
* **E2E** (Playwright, production build): the full student flow, mobile overflow check, admin protection, and the full admin flow (login → generate 900 → validate → export → import → publish → restore).
* **Content QA**: `npm run qa:report` validates all 900 reference questions and reports coverage, difficulty progression and flags.

## 10. Milestones (all completed – see QA_REPORT.md for evidence)

1. Math core + validators + template engine
2. Curriculum plan and 900-question generation
3. Database schema, services, seed
4. Student UI: dashboard, tests, runner with persisted timer, results, review
5. Smart Review: events, mastery, spaced review, planner, sessions, similar questions
6. Admin: auth, generator, question manager, CSV, import modes, versions, audit
7. Tests, QA report, documentation, Dockerfile

## Known limitations / future work

* Template-based questions are verified for **numerical correctness and internal consistency**, not for pedagogical taste; a teacher should skim the questions (the Question Manager previews them).
* Some questions share a template and wording with different numbers (a normal feature of generated workbooks); see the “re-used patterns” list in QA_REPORT.md.
* Single-student design (`Student` id `kenny`); the schema is multi-student ready but there is no student login.
* Vietnamese is provided for the main navigation and key student labels; question content is English.
* SQLite is a single-writer database; fine for one student and one admin.
