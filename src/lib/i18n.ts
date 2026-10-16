export type Lang = 'en' | 'vi';

const vi: Record<string, string> = {
  'Home': 'Trang chủ',
  'Math Tests': 'Bài kiểm tra',
  'Smart Review': 'Ôn tập thông minh',
  'My Progress': 'Tiến bộ của tôi',
  'Kenny Math Challenge': 'Thử thách Toán của Kenny',
  'Start': 'Bắt đầu',
  'Retry': 'Làm lại',
  'Resume': 'Tiếp tục',
  'Beginner': 'Cơ bản',
  'Intermediate': 'Trung bình',
  'Advanced': 'Nâng cao',
  'Latest score': 'Điểm gần nhất',
  'Best score': 'Điểm cao nhất',
  'Practice My Mistakes': 'Luyện lại các lỗi của tôi',
  'Ready for Review': 'Sẵn sàng ôn lại',
  'Previous': 'Trước',
  'Next': 'Tiếp',
  'Submit': 'Nộp bài',
  'Time left': 'Thời gian còn lại',
  'questions': 'câu hỏi',
  'minutes': 'phút',
  'Completed': 'Đã làm',
  'Not started': 'Chưa làm',
  'Correct': 'Đúng',
  'Incorrect': 'Sai',
  'Unanswered': 'Chưa trả lời',
  'Try a Similar Question': 'Thử một câu tương tự',
  'Skills needing practice': 'Kỹ năng cần luyện thêm',
  'Tests completed': 'Bài đã hoàn thành',
  'Average score': 'Điểm trung bình',
  'Welcome back': 'Chào mừng trở lại',
  'Language': 'Ngôn ngữ',
};

export function tr(lang: Lang, key: string): string {
  return lang === 'vi' ? (vi[key] ?? key) : key;
}
