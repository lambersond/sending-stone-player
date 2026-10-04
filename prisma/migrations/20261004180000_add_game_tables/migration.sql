-- CreateTable
CREATE TABLE "game" (
    "id" TEXT NOT NULL,
    "origin" TEXT NOT NULL,
    "worldId" TEXT,
    "worldTitle" TEXT,
    "characters" JSONB NOT NULL DEFAULT '[]',
    "version" INTEGER NOT NULL DEFAULT 0,
    "lastEventAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "game_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_message" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL,
    "public" BOOLEAN NOT NULL,
    "readers" TEXT[],
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "combat" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "combatId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "combat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "game_origin_key" ON "game"("origin");

-- CreateIndex
CREATE INDEX "chat_message_gameId_sentAt_idx" ON "chat_message"("gameId", "sentAt");

-- CreateIndex
CREATE UNIQUE INDEX "chat_message_gameId_messageId_key" ON "chat_message"("gameId", "messageId");

-- CreateIndex
CREATE UNIQUE INDEX "combat_gameId_combatId_key" ON "combat"("gameId", "combatId");

-- AddForeignKey
ALTER TABLE "chat_message" ADD CONSTRAINT "chat_message_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "combat" ADD CONSTRAINT "combat_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

