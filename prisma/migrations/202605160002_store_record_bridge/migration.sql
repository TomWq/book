CREATE TABLE IF NOT EXISTS "StoreRecord" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "entityType" TEXT NOT NULL,
  "userId" TEXT,
  "ownerUserId" TEXT,
  "projectId" TEXT,
  "payload" JSON NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "StoreRecord_entityType_idx" ON "StoreRecord" ("entityType");
CREATE INDEX IF NOT EXISTS "StoreRecord_userId_idx" ON "StoreRecord" ("userId");
CREATE INDEX IF NOT EXISTS "StoreRecord_ownerUserId_idx" ON "StoreRecord" ("ownerUserId");
CREATE INDEX IF NOT EXISTS "StoreRecord_projectId_idx" ON "StoreRecord" ("projectId");
