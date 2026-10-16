-- CreateTable
CREATE TABLE "Student" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "preferences" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "QuestionBank" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "source" TEXT NOT NULL DEFAULT 'GENERATED',
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "parentBankId" TEXT,
    "notes" TEXT NOT NULL DEFAULT '',
    "validationJson" TEXT,
    "validatedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" DATETIME,
    "activatedAt" DATETIME
);

-- CreateTable
CREATE TABLE "Test" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bankId" TEXT NOT NULL,
    "testNumber" INTEGER NOT NULL,
    "level" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "timeLimitSec" INTEGER NOT NULL DEFAULT 1800,
    CONSTRAINT "Test_bankId_fkey" FOREIGN KEY ("bankId") REFERENCES "QuestionBank" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "questionId" TEXT NOT NULL,
    "bankId" TEXT NOT NULL,
    "testNumber" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "level" TEXT NOT NULL,
    "difficulty" INTEGER NOT NULL,
    "topic" TEXT NOT NULL,
    "skill" TEXT NOT NULL,
    "questionText" TEXT NOT NULL,
    "optionA" TEXT NOT NULL,
    "optionB" TEXT NOT NULL,
    "optionC" TEXT NOT NULL,
    "optionD" TEXT NOT NULL,
    "correctAnswer" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "commonMistake" TEXT NOT NULL,
    "learningTip" TEXT NOT NULL,
    "validationStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "validationNotes" TEXT NOT NULL DEFAULT '',
    "verifyExpr" TEXT,
    "templateId" TEXT,
    CONSTRAINT "Question_bankId_fkey" FOREIGN KEY ("bankId") REFERENCES "QuestionBank" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TestAttempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "bankId" TEXT NOT NULL,
    "testNumber" INTEGER NOT NULL,
    "questionOrder" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "submittedAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "inProgressKey" TEXT,
    "score" INTEGER,
    "correctCount" INTEGER,
    "incorrectCount" INTEGER,
    "unansweredCount" INTEGER,
    "timeUsedSec" INTEGER,
    CONSTRAINT "TestAttempt_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TestAttempt_bankId_fkey" FOREIGN KEY ("bankId") REFERENCES "QuestionBank" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StudentAnswer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "attemptId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "selectedAnswer" TEXT,
    "isCorrect" BOOLEAN,
    "answeredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StudentAnswer_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "TestAttempt" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StudentAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReviewSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'SMART',
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "score" INTEGER,
    "total" INTEGER NOT NULL DEFAULT 0,
    "sourceQuestionId" TEXT,
    CONSTRAINT "ReviewSession_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReviewQuestion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "skillId" TEXT NOT NULL,
    "tier" INTEGER NOT NULL,
    "generatedQuestionData" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "selectedAnswer" TEXT,
    "correctAnswer" TEXT NOT NULL,
    "isCorrect" BOOLEAN,
    "answeredAt" DATETIME,
    "explanation" TEXT NOT NULL,
    CONSTRAINT "ReviewQuestion_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ReviewSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SkillEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL,
    "source" TEXT NOT NULL,
    "sessionKey" TEXT NOT NULL,
    "tier" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SkillEvent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SkillProgress" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "totalAttempts" INTEGER NOT NULL DEFAULT 0,
    "totalCorrect" INTEGER NOT NULL DEFAULT 0,
    "recentAccuracy" REAL,
    "recentCount" INTEGER NOT NULL DEFAULT 0,
    "sessionCount" INTEGER NOT NULL DEFAULT 0,
    "masteryStatus" TEXT NOT NULL DEFAULT 'NOT_ENOUGH_DATA',
    "previousAccuracy" REAL,
    "streakSessions" INTEGER NOT NULL DEFAULT 0,
    "lastTier" INTEGER,
    "lastEventAt" DATETIME,
    "nextReviewDate" DATETIME,
    CONSTRAINT "SkillProgress_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AdminSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "adminId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    CONSTRAINT "AdminSession_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "AdminUser" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AdminAuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "adminId" TEXT,
    "operation" TEXT NOT NULL,
    "details" TEXT NOT NULL DEFAULT '{}',
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdminAuditLog_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "AdminUser" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ImportJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "filename" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "baseBankId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'VALIDATED',
    "reportJson" TEXT NOT NULL,
    "rowsJson" TEXT NOT NULL,
    "resultBankId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "QuestionBank_version_key" ON "QuestionBank"("version");

-- CreateIndex
CREATE INDEX "QuestionBank_status_idx" ON "QuestionBank"("status");

-- CreateIndex
CREATE INDEX "QuestionBank_isActive_idx" ON "QuestionBank"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Test_bankId_testNumber_key" ON "Test"("bankId", "testNumber");

-- CreateIndex
CREATE INDEX "Question_bankId_topic_idx" ON "Question"("bankId", "topic");

-- CreateIndex
CREATE INDEX "Question_bankId_skill_idx" ON "Question"("bankId", "skill");

-- CreateIndex
CREATE UNIQUE INDEX "Question_bankId_questionId_key" ON "Question"("bankId", "questionId");

-- CreateIndex
CREATE UNIQUE INDEX "Question_bankId_testNumber_position_key" ON "Question"("bankId", "testNumber", "position");

-- CreateIndex
CREATE UNIQUE INDEX "TestAttempt_inProgressKey_key" ON "TestAttempt"("inProgressKey");

-- CreateIndex
CREATE INDEX "TestAttempt_studentId_testNumber_idx" ON "TestAttempt"("studentId", "testNumber");

-- CreateIndex
CREATE INDEX "TestAttempt_studentId_status_idx" ON "TestAttempt"("studentId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "StudentAnswer_attemptId_questionId_key" ON "StudentAnswer"("attemptId", "questionId");

-- CreateIndex
CREATE INDEX "ReviewSession_studentId_startedAt_idx" ON "ReviewSession"("studentId", "startedAt");

-- CreateIndex
CREATE INDEX "ReviewQuestion_skillId_idx" ON "ReviewQuestion"("skillId");

-- CreateIndex
CREATE INDEX "ReviewQuestion_fingerprint_idx" ON "ReviewQuestion"("fingerprint");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewQuestion_sessionId_position_key" ON "ReviewQuestion"("sessionId", "position");

-- CreateIndex
CREATE INDEX "SkillEvent_studentId_skillId_createdAt_idx" ON "SkillEvent"("studentId", "skillId", "createdAt");

-- CreateIndex
CREATE INDEX "SkillEvent_sessionKey_idx" ON "SkillEvent"("sessionKey");

-- CreateIndex
CREATE UNIQUE INDEX "SkillProgress_studentId_skillId_key" ON "SkillProgress"("studentId", "skillId");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_email_key" ON "AdminUser"("email");

-- CreateIndex
CREATE UNIQUE INDEX "AdminSession_tokenHash_key" ON "AdminSession"("tokenHash");

-- CreateIndex
CREATE INDEX "AdminAuditLog_timestamp_idx" ON "AdminAuditLog"("timestamp");
