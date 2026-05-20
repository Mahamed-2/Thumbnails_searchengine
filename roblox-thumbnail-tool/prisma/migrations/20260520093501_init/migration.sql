-- CreateTable
CREATE TABLE "thumbnails" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "localPath" TEXT,
    "cloudUrl" TEXT,
    "pHash" TEXT,
    "size" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "cropType" TEXT NOT NULL,
    "fileSizeKb" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "quality" INTEGER,
    "state" TEXT NOT NULL DEFAULT 'Completed',
    "isDuplicate" BOOLEAN NOT NULL DEFAULT false,
    "jobId" TEXT,
    "collectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "thumbnails_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "games" (
    "id" TEXT NOT NULL,
    "robloxId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "creatorId" INTEGER,
    "creatorType" TEXT,
    "thumbnailUrl" TEXT,
    "localThumbPath" TEXT,
    "maxPlayers" INTEGER,
    "playing" INTEGER,
    "visits" BIGINT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "games_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "robloxId" INTEGER NOT NULL,
    "name" TEXT,
    "displayName" TEXT,
    "isBanned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collection_jobs" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "strategy" TEXT NOT NULL,
    "config" TEXT NOT NULL,
    "totalItems" INTEGER NOT NULL DEFAULT 0,
    "processedItems" INTEGER NOT NULL DEFAULT 0,
    "successItems" INTEGER NOT NULL DEFAULT 0,
    "failedItems" INTEGER NOT NULL DEFAULT 0,
    "progress" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "checkpoint" TEXT,
    "errorLog" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "collection_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dlq_entries" (
    "id" TEXT NOT NULL,
    "jobId" TEXT,
    "queueName" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "error" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dlq_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dataset_exports" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "filters" TEXT NOT NULL,
    "recordCount" INTEGER NOT NULL DEFAULT 0,
    "filePath" TEXT,
    "fileSizeKb" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dataset_exports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collection_stats" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalThumbnails" INTEGER NOT NULL DEFAULT 0,
    "totalGames" INTEGER NOT NULL DEFAULT 0,
    "totalUsers" INTEGER NOT NULL DEFAULT 0,
    "storageUsedMb" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "duplicatesFound" INTEGER NOT NULL DEFAULT 0,
    "errorsTotal" INTEGER NOT NULL DEFAULT 0,
    "apiRequestsMade" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "collection_stats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "thumbnails_userId_idx" ON "thumbnails"("userId");

-- CreateIndex
CREATE INDEX "thumbnails_pHash_idx" ON "thumbnails"("pHash");

-- CreateIndex
CREATE INDEX "thumbnails_size_idx" ON "thumbnails"("size");

-- CreateIndex
CREATE INDEX "thumbnails_cropType_idx" ON "thumbnails"("cropType");

-- CreateIndex
CREATE INDEX "thumbnails_state_idx" ON "thumbnails"("state");

-- CreateIndex
CREATE INDEX "thumbnails_collectedAt_idx" ON "thumbnails"("collectedAt");

-- CreateIndex
CREATE UNIQUE INDEX "thumbnails_userId_size_cropType_key" ON "thumbnails"("userId", "size", "cropType");

-- CreateIndex
CREATE UNIQUE INDEX "games_robloxId_key" ON "games"("robloxId");

-- CreateIndex
CREATE INDEX "games_visits_idx" ON "games"("visits");

-- CreateIndex
CREATE INDEX "games_playing_idx" ON "games"("playing");

-- CreateIndex
CREATE UNIQUE INDEX "users_robloxId_key" ON "users"("robloxId");

-- CreateIndex
CREATE INDEX "users_robloxId_idx" ON "users"("robloxId");

-- CreateIndex
CREATE INDEX "collection_jobs_status_idx" ON "collection_jobs"("status");

-- CreateIndex
CREATE INDEX "collection_jobs_createdAt_idx" ON "collection_jobs"("createdAt");

-- CreateIndex
CREATE INDEX "dlq_entries_queueName_idx" ON "dlq_entries"("queueName");

-- CreateIndex
CREATE INDEX "dlq_entries_resolvedAt_idx" ON "dlq_entries"("resolvedAt");

-- CreateIndex
CREATE INDEX "dataset_exports_status_idx" ON "dataset_exports"("status");

-- CreateIndex
CREATE INDEX "collection_stats_date_idx" ON "collection_stats"("date");

-- AddForeignKey
ALTER TABLE "thumbnails" ADD CONSTRAINT "thumbnails_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("robloxId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "thumbnails" ADD CONSTRAINT "thumbnails_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "collection_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dlq_entries" ADD CONSTRAINT "dlq_entries_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "collection_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
