-- CreateTable
CREATE TABLE "StudentSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    CONSTRAINT "StudentSession_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StudentBankAssignment" (
    "studentId" TEXT NOT NULL PRIMARY KEY,
    "bankId" TEXT NOT NULL,
    CONSTRAINT "StudentBankAssignment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StudentBankAssignment_bankId_fkey" FOREIGN KEY ("bankId") REFERENCES "QuestionBank" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Student" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "username" TEXT,
    "passwordHash" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "learningConfig" TEXT,
    "preferences" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Student" ("createdAt", "id", "name", "preferences") SELECT "createdAt", "id", "name", "preferences" FROM "Student";
DROP TABLE "Student";
ALTER TABLE "new_Student" RENAME TO "Student";
CREATE UNIQUE INDEX "Student_username_key" ON "Student"("username");
CREATE TABLE "new_QuestionBank" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "source" TEXT NOT NULL DEFAULT 'GENERATED',
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "ownerId" TEXT,
    "parentBankId" TEXT,
    "notes" TEXT NOT NULL DEFAULT '',
    "seed" TEXT NOT NULL DEFAULT '',
    "validationJson" TEXT,
    "validatedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" DATETIME,
    "activatedAt" DATETIME,
    CONSTRAINT "QuestionBank_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Student" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_QuestionBank" ("activatedAt", "createdAt", "id", "isActive", "name", "notes", "parentBankId", "publishedAt", "seed", "source", "status", "validatedAt", "validationJson", "version") SELECT "activatedAt", "createdAt", "id", "isActive", "name", "notes", "parentBankId", "publishedAt", "seed", "source", "status", "validatedAt", "validationJson", "version" FROM "QuestionBank";
DROP TABLE "QuestionBank";
ALTER TABLE "new_QuestionBank" RENAME TO "QuestionBank";
CREATE UNIQUE INDEX "QuestionBank_version_key" ON "QuestionBank"("version");
CREATE INDEX "QuestionBank_status_idx" ON "QuestionBank"("status");
CREATE INDEX "QuestionBank_isActive_idx" ON "QuestionBank"("isActive");
CREATE TABLE "new_ImportJob" (
    "targetStudentId" TEXT,
    "id" TEXT NOT NULL PRIMARY KEY,
    "filename" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "baseBankId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'VALIDATED',
    "reportJson" TEXT NOT NULL,
    "rowsJson" TEXT NOT NULL,
    "resultBankId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ImportJob_targetStudentId_fkey" FOREIGN KEY ("targetStudentId") REFERENCES "Student" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ImportJob" ("baseBankId", "createdAt", "filename", "id", "mode", "reportJson", "resultBankId", "rowsJson", "status") SELECT "baseBankId", "createdAt", "filename", "id", "mode", "reportJson", "resultBankId", "rowsJson", "status" FROM "ImportJob";
DROP TABLE "ImportJob";
ALTER TABLE "new_ImportJob" RENAME TO "ImportJob";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "StudentSession_tokenHash_key" ON "StudentSession"("tokenHash");

-- CreateIndex
CREATE INDEX "StudentSession_studentId_idx" ON "StudentSession"("studentId");

-- CreateIndex
CREATE INDEX "StudentBankAssignment_bankId_idx" ON "StudentBankAssignment"("bankId");

-- Preserve current learning defaults as an independent snapshot for legacy users.
UPDATE "Student" SET "learningConfig" = (SELECT "value" FROM "Setting" WHERE "key" = 'learningConfig') WHERE "learningConfig" IS NULL;
