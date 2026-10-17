-- AlterTable
ALTER TABLE "Question" ADD COLUMN "answerData" TEXT;
ALTER TABLE "Question" ADD COLUMN "questionType" TEXT NOT NULL DEFAULT 'MCQ';
