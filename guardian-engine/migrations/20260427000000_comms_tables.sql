-- Tactical comms tables
-- Channel hierarchy: Net > Group > Team > Direct
-- Clearance tiers: Full > Tactical > Customer
-- Classification: Internal > Restricted > Unclass

CREATE TABLE IF NOT EXISTS "ChatChannel" (
    id TEXT PRIMARY KEY,
    "orgId" TEXT NOT NULL REFERENCES "Organization"(id) ON DELETE CASCADE,
    "channelType" TEXT NOT NULL DEFAULT 'group',
    scope TEXT NOT NULL DEFAULT 'local',
    "refType" TEXT,
    "refId" TEXT,
    name TEXT NOT NULL,
    encrypted BOOLEAN NOT NULL DEFAULT false,
    "parentChannelId" TEXT REFERENCES "ChatChannel"(id) ON DELETE SET NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "ChatChannel_orgId_idx" ON "ChatChannel"("orgId");
CREATE INDEX IF NOT EXISTS "ChatChannel_ref_idx" ON "ChatChannel"("orgId", "refType", "refId");
CREATE INDEX IF NOT EXISTS "ChatChannel_parent_idx" ON "ChatChannel"("parentChannelId");

CREATE TABLE IF NOT EXISTS "ChatMessage" (
    id TEXT PRIMARY KEY,
    "channelId" TEXT NOT NULL REFERENCES "ChatChannel"(id) ON DELETE CASCADE,
    "senderId" TEXT,
    "senderHandle" TEXT NOT NULL,
    "senderType" TEXT NOT NULL DEFAULT 'user',
    content TEXT NOT NULL,
    "messageType" TEXT NOT NULL DEFAULT 'text',
    classification TEXT NOT NULL DEFAULT 'unclass',
    encrypted BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "ChatMessage_channel_time_idx" ON "ChatMessage"("channelId", "createdAt" DESC);

CREATE TABLE IF NOT EXISTS "ChatParticipant" (
    id TEXT PRIMARY KEY,
    "channelId" TEXT NOT NULL REFERENCES "ChatChannel"(id) ON DELETE CASCADE,
    "userId" TEXT,
    handle TEXT NOT NULL,
    clearance TEXT NOT NULL DEFAULT 'customer',
    role TEXT NOT NULL DEFAULT 'member',
    "lastReadAt" TIMESTAMPTZ,
    "joinedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS "ChatParticipant_channel_user_uniq" ON "ChatParticipant"("channelId", "userId") WHERE "userId" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "ChatParticipant_userId_idx" ON "ChatParticipant"("userId");

CREATE TABLE IF NOT EXISTS "ChatChannelKey" (
    id TEXT PRIMARY KEY,
    "channelId" TEXT NOT NULL REFERENCES "ChatChannel"(id) ON DELETE CASCADE,
    "keyHex" TEXT NOT NULL,
    "revokedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "ChatChannelKey_channel_idx" ON "ChatChannelKey"("channelId");

CREATE TABLE IF NOT EXISTS "ChatInviteToken" (
    id TEXT PRIMARY KEY,
    "channelId" TEXT NOT NULL REFERENCES "ChatChannel"(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    clearance TEXT NOT NULL DEFAULT 'customer',
    handle TEXT,
    "maxUses" INTEGER NOT NULL DEFAULT 1,
    "useCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMPTZ NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "ChatInviteToken_token_idx" ON "ChatInviteToken"(token);
