ALTER TABLE "Project" ADD COLUMN "ownerUserId" TEXT;
ALTER TABLE "Template" ADD COLUMN "ownerUserId" TEXT;
ALTER TABLE "AiJob" ADD COLUMN "userId" TEXT;
ALTER TABLE "AiSetting" ADD COLUMN "userId" TEXT;

ALTER TABLE "PlotState" ADD COLUMN "currentMap" TEXT NOT NULL DEFAULT '';
ALTER TABLE "PlotState" ADD COLUMN "shortTermGoal" TEXT NOT NULL DEFAULT '';
ALTER TABLE "PlotState" ADD COLUMN "currentEnemy" TEXT NOT NULL DEFAULT '';
ALTER TABLE "PlotState" ADD COLUMN "openThreads" JSON;
ALTER TABLE "PlotState" ADD COLUMN "resolvedThreads" JSON;
ALTER TABLE "PlotState" ADD COLUMN "nextStageGoal" TEXT NOT NULL DEFAULT '';
ALTER TABLE "PlotState" ADD COLUMN "powerSystemState" TEXT NOT NULL DEFAULT '';
ALTER TABLE "PlotState" ADD COLUMN "mapAndForces" TEXT NOT NULL DEFAULT '';
ALTER TABLE "PlotState" ADD COLUMN "resourceState" TEXT NOT NULL DEFAULT '';
ALTER TABLE "PlotState" ADD COLUMN "relationshipChanges" JSON;

CREATE TABLE IF NOT EXISTS "User" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "email" TEXT NOT NULL UNIQUE,
  "name" TEXT NOT NULL,
  "passwordSalt" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "plan" TEXT,
  "creditsBalance" INTEGER,
  "onboardingCompletedAt" DATETIME,
  "createdAt" DATETIME NOT NULL,
  "updatedAt" DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS "Session" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "token" TEXT NOT NULL UNIQUE,
  "createdAt" DATETIME NOT NULL,
  "expiresAt" DATETIME NOT NULL,
  "lastSeenAt" DATETIME NOT NULL,
  CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "CreditTransaction" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "balanceAfter" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "relatedJobId" TEXT,
  "orderId" TEXT,
  "createdAt" DATETIME NOT NULL
);

CREATE INDEX IF NOT EXISTS "Session_userId_idx" ON "Session" ("userId");
CREATE INDEX IF NOT EXISTS "Session_token_idx" ON "Session" ("token");
CREATE INDEX IF NOT EXISTS "CreditTransaction_userId_idx" ON "CreditTransaction" ("userId");
CREATE INDEX IF NOT EXISTS "CreditTransaction_relatedJobId_idx" ON "CreditTransaction" ("relatedJobId");
