-- AlterTable
ALTER TABLE "Question" ADD COLUMN     "answerData" TEXT,
ADD COLUMN     "questionType" TEXT NOT NULL DEFAULT 'MCQ';
