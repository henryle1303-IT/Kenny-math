# Kiểm thử admin và triển khai Vercel — 17/10/2026

## Lỗi đã tái hiện và sửa

1. Export bỏ qua bộ lọc sai (`abc`, `0`, `31`, danh sách trộn đúng/sai), dẫn đến xuất toàn bộ ngân hàng. Nay kiểm tra đầy đủ trên form và API, báo lỗi tại chỗ; bộ lọc hợp lệ được sắp xếp và loại trùng.
2. Import NEW_BANK/REPLACE_ACTIVE kiểm tra nhầm ngân hàng nguồn đang ẩn trong form, nên có thể từ chối import chung khi lựa chọn cũ là ngân hàng riêng. Nay chỉ dùng ngân hàng nguồn ở chế độ UPDATE_SELECTED.
3. Import thay thế lưu ngân hàng và đánh dấu job đã commit trước khi bước publish báo thiếu xác nhận duyệt. Nay toàn bộ tạo ngân hàng, chèn câu hỏi, kiểm tra, publish và commit job cùng một transaction: lỗi sẽ hoàn tác, có thể sửa xác nhận rồi thử lại cùng job.
4. Hai yêu cầu commit cùng job có thể tạo hai ngân hàng. Nay có bước nhận quyền commit trong transaction và retry giới hạn khi xung đột; chỉ một yêu cầu thành công.
5. Bộ lọc danh sách câu hỏi sai kiểu/phân trang sai gây lỗi Prisma. Nay trả lỗi 400; ngân hàng không tồn tại trả 404.
6. Settings nhận JSON null gây lỗi không được xử lý; giá trị ngày null/rỗng/thập phân có thể được chấp nhận sai. Nay kiểm tra schema ở phía server và dùng form required/step ở giao diện.
7. Đổi mật khẩu admin không thu hồi phiên khác. Nay thu hồi các phiên khác, giữ phiên đang thực hiện và không ghi mật khẩu vào audit log.
8. Nút Validate ghi đè báo cáo chi tiết thành “Validated.”. Nay giữ số câu đúng, số câu cần duyệt và lỗi cấp ngân hàng.
9. Form sửa câu hỏi đóng khi lưu lỗi, làm mất phần nhập sửa; kết quả tìm kiếm cũ cũng có thể đè kết quả mới. Nay giữ form và dữ liệu khi lưu lỗi, khóa nút lưu lúc đang gửi, bỏ qua phản hồi đã lỗi thời và xóa trạng thái cũ khi đổi ngân hàng.
10. Tạo user kết hợp điều hướng và refresh có thể giữ cả hồ sơ cũ lẫn mới trong trang. Nay điều hướng đầy đủ đến hồ sơ vừa tạo; E2E kiểm tra hồ sơ cũ đã biến mất.
11. Bộ lọc chủ đề cũ còn được gửi khi chuyển từ ngân hàng nháp sang tạo ngân hàng mới, khiến sinh thiếu 900 câu. Nay xóa và bỏ qua bộ lọc đó khi tạo ngân hàng mới.
12. Giới hạn CSV 5 MB không phù hợp giới hạn request 4,5 MB của Vercel Functions. Nay dùng giới hạn file 4 MB ở form/API và chặn file lớn trước khi upload; đủ khoảng trống cho multipart. Xem [giới hạn Vercel Functions](https://vercel.com/docs/functions/limitations#request-body-size).

## Phạm vi kiểm tra

| Nhóm | Trường hợp đã bổ sung |
|---|---|
| Export | Toàn bộ 900 câu, một đề, dải/danh sách đề, bộ lọc sai, BOM, dấu phẩy/dấu nháy/xuống dòng/Tiếng Việt |
| Import | NEW_BANK, REPLACE_ACTIVE, UPDATE_SELECTED; ngân hàng chung và riêng; file trống/sai đuôi/quá lớn/thiếu cột/trùng ID; xác nhận sai/thiếu duyệt; hai commit đồng thời; UTF-16 và dấu chấm phẩy |
| Template/báo lỗi | Download template, bỏ qua/bao gồm ví dụ, tải CSV lỗi có BOM và thông tin cột thiếu |
| Ngân hàng | Clone, Validate, Publish/Activate, rollback, không xóa ngân hàng đang dùng, từ chối tên xác nhận xóa sai, xóa nháp đúng tên |
| Câu hỏi | Tìm kiếm, phân trang, preview, sửa trên nháp, giữ form khi server lỗi rồi thử lại, giữ nguyên ngân hàng nguồn |
| Generator | Sinh đủ 900 câu sau khi chuyển từ lựa chọn chủ đề cũ |
| User/progress | Tạo user, trùng username, cấu hình riêng, backup/export, từ chối restore chéo user, CLEAR sai/đúng và restore đúng chủ |
| Settings/auth | Ngày trống/thập phân/null, lưu hợp lệ, mật khẩu hiện tại sai, đổi mật khẩu và thu hồi phiên khác |
| Mobile | Dashboard, Import/Export, User Profiles, Banks, Questions, Settings, Generator ở chiều rộng 375 px |

## Kết quả và môi trường

- Toàn bộ Vitest: **14 files / 116 tests đạt**.
- Sau khi điều chỉnh giới hạn file: bộ kiểm tra tập trung **15 tests** được chạy lại.
- Production build local đã đạt, bao gồm TypeScript và ESLint; Vercel build dùng PostgreSQL và môi trường production.
- E2E mở rộng: **19/19 bài đạt** trong 2,7 phút trên bản mã nguồn cuối.
- Các bài kiểm tra có thay đổi dữ liệu sử dụng `prisma/test.db` và `prisma/e2e.db`, tách khỏi `prisma/dev.db` và production.
- Ảnh mobile đã được kiểm tra; các lần chạy mới lưu ảnh dưới `test-results/` bằng Playwright `testInfo.outputPath`, không commit ảnh sinh tự động.

## Triển khai

- Project: `dla-s-projects/kenny-math` (`prj_qZtOuwEUQXQHPu5JgCbOWkSqkDfl`), Next.js / Node 24 / Functions `sin1`.
- Nguồn: working tree chứa các thay đổi đã kiểm tra; Git HEAD nền `430a9e8`, không đồng nghĩa chỉ riêng commit cũ được deploy.
- Snapshot trước migration: `snap-small-frog-ao5j27h9`, tên `before-multi-user-admin-fixes-2026-10-17`.
- Neon production: `hidden-haze-41988434`, branch `br-divine-resonance-aojxvk9s`, database `kenny_math`.
- Migration `20261017000100_multi_user` đã áp dụng thành công. Sau migration: **4 user, 1 ngân hàng, 900 câu hỏi, 1 lượt làm bài, 30 skill events, 2 migrations**. Lượt làm bài và skill events cũ được giữ nguyên.
- Bốn tài khoản dùng chung ngân hàng hiện có, mật khẩu khởi tạo `123`; mật khẩu admin production được giữ nguyên.
- Đã xác minh đăng nhập, tên trang cá nhân và đăng xuất cả bốn tài khoản trên bản staged qua quyền Vercel hiện có. Không tắt Deployment Protection.
- Bản production cuối: `dpl_8iuJcuBvzJLjuVQodt5jsAx6cCYB`, trạng thái **READY**, build 1 phút 46 giây. Đã promote thành công và xác minh domain chính trỏ đúng deployment này.

### Kết quả phát hành

- Domain chính: https://kenny-math-dla-s-projects.vercel.app
- Admin: https://kenny-math-dla-s-projects.vercel.app/admin/login
- Cả bốn tài khoản đã đăng nhập, hiển thị đúng tên trang và đăng xuất thành công trên deployment cuối. Trang admin login tải thành công. Kiểm thử admin có ghi dữ liệu thực hiện trong môi trường E2E tách biệt; không thay mật khẩu admin production.
- Sau promote: domain chính trả HTTP 200 cho `/login`, nội dung trang đăng nhập đúng ứng dụng; CLI inspect xác nhận deployment ID nêu trên.
- Log query `level:error AND environment:production` trên deployment cuối trong 10 phút kiểm tra trả 0 bản ghi. Đây là kiểm tra tại thời điểm phát hành; không cấu hình thêm log drain hoặc giám sát liên tục.
- Kiểm tra lại dữ liệu production: 4 user, 1 bank, 900 questions, 1 attempt, 30 skill events, 2 migrations.
- Giữ nguyên Deployment Protection hiện có. Việc kiểm tra từ CLI dùng quyền Vercel đã đăng nhập.
- Mã nguồn được deploy từ working tree local; các thay đổi được đưa vào đợt đồng bộ GitHub theo yêu cầu người dùng sau phát hành.


### Sửa truy cập công khai sau phản hồi người dùng

Cấu hình cũ `all_except_custom_domains` đã chặn cả domain production vercel.app với Vercel SSO. Đã đổi sang Standard Protection (`prod_deployment_urls_and_all_previews`) để domain chính truy cập công khai, vẫn bảo vệ URL deployment và preview. Xác minh bằng HTTP client mới, không cookie hoặc bypass: `/login` trả 200 đúng trang học sinh, `/` chuyển đến `/login`, `/admin/login` trả 200 đúng trang admin; không chuyển sang vercel.com. Đăng nhập và quyền truy cập trong ứng dụng vẫn áp dụng.


### Sửa chuyển hồ sơ user / Question Banks

Tái hiện trên production bằng thao tác User Profiles → Henry: điều hướng phía client giữ cả section Profile for Kenny cũ và section Henry mới, có trùng ID tab/panel. Tab trên hồ sơ cũ không còn phản hồi. Bài `profile-navigation.spec.ts` thất bại trước sửa (hồ sơ Kenny vẫn còn sau 15 giây). Đổi link thẻ user sang điều hướng trang đầy đủ để hủy toàn bộ form của user trước. Bài kiểm tra chuyển Henry → Moon → Kenny → Henry, chỉ có một panel, đúng tên, tab Question Banks và nút Assign đúng user.

Kết quả sau sửa: production build local đạt TypeScript/ESLint; 4/4 E2E liên quan đạt (48,7 giây), gồm test mới và ba luồng multi-user/import private. Deployment `dpl_6Yx5g8z8dPJRYaRFA9kLMrJq7QfN` READY, build 2 phút 3 giây, đã promote. Xác minh trên `luyentoankids.vercel.app` bằng trình duyệt: Kenny → Henry chỉ còn hồ sơ Henry, tab Question Banks hiển thị lựa chọn ngân hàng và Assign bank to Henry. Không thay ngân hàng hoặc tiến độ production. Ảnh xác minh cũ được bỏ khỏi nhánh hiện tại khi dọn repository; có thể xem lại trong lịch sử Git.
