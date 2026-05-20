CREATE TABLE "LicenseCode" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "codeHash" TEXT NOT NULL,
  "codePreview" TEXT NOT NULL,
  "customerName" TEXT,
  "customerContact" TEXT,
  "status" TEXT NOT NULL DEFAULT 'unused',
  "maxActivations" INTEGER NOT NULL DEFAULT 1,
  "activationCount" INTEGER NOT NULL DEFAULT 0,
  "machineHash" TEXT,
  "activatedAt" DATETIME,
  "lastVerifiedAt" DATETIME,
  "expiresAt" DATETIME,
  "disabledAt" DATETIME,
  "notes" TEXT,
  "createdAt" DATETIME NOT NULL,
  "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "LicenseCode_codeHash_key" ON "LicenseCode"("codeHash");

CREATE TABLE "LicenseActivationLog" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "licenseCodeId" TEXT,
  "codeHash" TEXT NOT NULL,
  "machineHash" TEXT,
  "result" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "clientName" TEXT,
  "createdAt" DATETIME NOT NULL,
  CONSTRAINT "LicenseActivationLog_licenseCodeId_fkey" FOREIGN KEY ("licenseCodeId") REFERENCES "LicenseCode" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "LicenseActivationLog_licenseCodeId_idx" ON "LicenseActivationLog"("licenseCodeId");
CREATE INDEX "LicenseActivationLog_codeHash_idx" ON "LicenseActivationLog"("codeHash");
