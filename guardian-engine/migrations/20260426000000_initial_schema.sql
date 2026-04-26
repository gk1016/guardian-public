-- Guardian Flight: Baseline schema migration
-- Generated from pg_dump of running Prisma-managed database
-- Fully idempotent: safe on both fresh and existing databases

-- ============================================================
-- TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS "Organization" (
    id text NOT NULL,
    name text NOT NULL,
    tag text NOT NULL,
    description text,
    "isPublic" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    CONSTRAINT "Organization_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "User" (
    id text NOT NULL,
    email text NOT NULL,
    handle text NOT NULL,
    "displayName" text,
    role text DEFAULT 'pilot'::text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "passwordHash" text,
    "sessionsInvalidatedAt" timestamp(3) without time zone,
    "totpSecret" text,
    "totpEnabled" boolean DEFAULT false NOT NULL,
    CONSTRAINT "User_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "ShipSpec" (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    "fleetyardsSlug" text NOT NULL,
    "scIdentifier" text,
    name text NOT NULL,
    manufacturer text NOT NULL,
    classification text NOT NULL,
    focus text,
    "sizeCategory" text,
    "crewMin" integer DEFAULT 1 NOT NULL,
    "crewMax" integer DEFAULT 1 NOT NULL,
    cargo integer DEFAULT 0 NOT NULL,
    "imageUrl" text,
    "inGame" boolean DEFAULT false NOT NULL,
    "rawData" jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT "ShipSpec_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "DoctrineTemplate" (
    id text NOT NULL,
    "orgId" text NOT NULL,
    code text NOT NULL,
    title text NOT NULL,
    category text NOT NULL,
    summary text NOT NULL,
    body text NOT NULL,
    escalation text,
    "isDefault" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    CONSTRAINT "DoctrineTemplate_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "AiAnalysis" (
    id text NOT NULL,
    "orgId" text NOT NULL,
    "analysisType" text NOT NULL,
    "targetId" text,
    summary text NOT NULL,
    provider text NOT NULL,
    model text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    CONSTRAINT "AiAnalysis_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "AiConfig" (
    id text NOT NULL,
    "orgId" text NOT NULL,
    provider text DEFAULT 'anthropic'::text NOT NULL,
    model text DEFAULT 'claude-sonnet-4-20250514'::text NOT NULL,
    "apiKey" text,
    "baseUrl" text,
    "maxTokens" integer DEFAULT 2048 NOT NULL,
    temperature double precision DEFAULT 0.3 NOT NULL,
    enabled boolean DEFAULT false NOT NULL,
    "tickIntervalSecs" integer DEFAULT 300 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    CONSTRAINT "AiConfig_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "AiModelOption" (
    id text NOT NULL,
    provider text NOT NULL,
    "modelId" text NOT NULL,
    "displayName" text NOT NULL,
    category text DEFAULT 'chat'::text NOT NULL,
    "isDefault" boolean DEFAULT false NOT NULL,
    "sortOrder" integer DEFAULT 100 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    CONSTRAINT "AiModelOption_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "AlertRule" (
    id text NOT NULL,
    "orgId" text NOT NULL,
    name text NOT NULL,
    metric text NOT NULL,
    operator text NOT NULL,
    threshold double precision NOT NULL,
    severity text DEFAULT 'warning'::text NOT NULL,
    "isEnabled" boolean DEFAULT true NOT NULL,
    "cooldownMinutes" integer DEFAULT 60 NOT NULL,
    "lastTriggeredAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    CONSTRAINT "AlertRule_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "Application" (
    id text NOT NULL,
    "orgId" text NOT NULL,
    handle text NOT NULL,
    name text NOT NULL,
    email text,
    message text DEFAULT ''::text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    CONSTRAINT "Application_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "AuditLog" (
    id text NOT NULL,
    "userId" text NOT NULL,
    "orgId" text,
    action text NOT NULL,
    "targetType" text NOT NULL,
    "targetId" text,
    metadata jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT "AuditLog_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "DiscordConfig" (
    id text NOT NULL,
    "orgId" text NOT NULL,
    "botToken" text,
    "guildId" text,
    enabled boolean DEFAULT false NOT NULL,
    "mainChannelId" text,
    "alertChannelId" text,
    "intelChannelId" text,
    "missionChannelId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    CONSTRAINT "DiscordConfig_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "FederatedIntel" (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    "sourceInstanceId" text NOT NULL,
    "sourceInstanceName" text NOT NULL,
    "remoteReportId" text NOT NULL,
    title text NOT NULL,
    "reportType" text NOT NULL,
    severity integer DEFAULT 3 NOT NULL,
    description text,
    "starSystem" text,
    "hostileGroup" text,
    "receivedAt" timestamp(3) without time zone DEFAULT now() NOT NULL,
    CONSTRAINT "FederatedIntel_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "FleetShip" (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    "userId" text NOT NULL,
    "orgId" text NOT NULL,
    "shipSpecId" text NOT NULL,
    "shipName" text,
    status text DEFAULT 'active'::text NOT NULL,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT "FleetShip_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "IntelReport" (
    id text NOT NULL,
    "orgId" text NOT NULL,
    "reportType" text DEFAULT 'sighting'::text NOT NULL,
    title text NOT NULL,
    description text,
    severity integer DEFAULT 3 NOT NULL,
    "locationName" text,
    "starSystem" text,
    "hostileGroup" text,
    confidence text DEFAULT 'medium'::text NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "isVerified" boolean DEFAULT false NOT NULL,
    tags text[],
    "observedAt" timestamp(3) without time zone,
    "expiresAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    CONSTRAINT "IntelReport_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "ManualEntry" (
    id text NOT NULL,
    "orgId" text NOT NULL,
    "authorId" text NOT NULL,
    title text NOT NULL,
    category text DEFAULT 'general'::text NOT NULL,
    body text DEFAULT ''::text NOT NULL,
    "entryType" text DEFAULT 'article'::text NOT NULL,
    "fileName" text,
    "fileSize" integer,
    "fileMimeType" text,
    "fileData" bytea,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    CONSTRAINT "ManualEntry_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "Mission" (
    id text NOT NULL,
    "orgId" text NOT NULL,
    callsign text NOT NULL,
    title text NOT NULL,
    "missionType" text NOT NULL,
    status text DEFAULT 'planning'::text NOT NULL,
    priority text DEFAULT 'routine'::text NOT NULL,
    "areaOfOperation" text,
    "missionBrief" text,
    "mettTc" jsonb,
    phases jsonb,
    "roeCode" text,
    "leadId" text,
    "startsAt" timestamp(3) without time zone,
    "completedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "aarSummary" text,
    "closeoutSummary" text,
    "revisionNumber" integer DEFAULT 1 NOT NULL,
    "doctrineTemplateId" text,
    CONSTRAINT "Mission_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "MissionIntelLink" (
    id text NOT NULL,
    "missionId" text NOT NULL,
    "intelId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT "MissionIntelLink_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "MissionLog" (
    id text NOT NULL,
    "missionId" text NOT NULL,
    "authorId" text,
    "entryType" text DEFAULT 'status'::text NOT NULL,
    message text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT "MissionLog_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "MissionParticipant" (
    id text NOT NULL,
    "missionId" text NOT NULL,
    handle text NOT NULL,
    role text NOT NULL,
    platform text,
    status text DEFAULT 'assigned'::text NOT NULL,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT "MissionParticipant_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "Notification" (
    id text NOT NULL,
    "orgId" text NOT NULL,
    "createdById" text,
    category text DEFAULT 'ops'::text NOT NULL,
    severity text DEFAULT 'info'::text NOT NULL,
    title text NOT NULL,
    body text NOT NULL,
    href text,
    status text DEFAULT 'unread'::text NOT NULL,
    "acknowledgedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    CONSTRAINT "Notification_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "OrgMember" (
    id text NOT NULL,
    "userId" text NOT NULL,
    "orgId" text NOT NULL,
    rank text DEFAULT 'member'::text NOT NULL,
    title text,
    "joinedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT "OrgMember_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "QrfReadiness" (
    id text NOT NULL,
    "orgId" text NOT NULL,
    callsign text NOT NULL,
    status text DEFAULT 'redcon4'::text NOT NULL,
    platform text,
    "locationName" text,
    "availableCrew" integer DEFAULT 1 NOT NULL,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    CONSTRAINT "QrfReadiness_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "QrfDispatch" (
    id text NOT NULL,
    "orgId" text NOT NULL,
    "qrfId" text NOT NULL,
    "missionId" text,
    "rescueId" text,
    "dispatchedById" text NOT NULL,
    status text DEFAULT 'tasked'::text NOT NULL,
    notes text,
    "dispatchedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "arrivedAt" timestamp(3) without time zone,
    "rtbAt" timestamp(3) without time zone,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    CONSTRAINT "QrfDispatch_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "RecruitConfig" (
    id text NOT NULL,
    "orgId" text NOT NULL,
    headline text DEFAULT 'Join the crew.'::text NOT NULL,
    description text DEFAULT 'We''re looking for new members. Submit an application below.'::text NOT NULL,
    "values" jsonb DEFAULT '[]'::jsonb NOT NULL,
    "ctaText" text DEFAULT 'Submit Application'::text NOT NULL,
    "isEnabled" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    CONSTRAINT "RecruitConfig_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "RescueRequest" (
    id text NOT NULL,
    "orgId" text NOT NULL,
    "requesterId" text NOT NULL,
    "operatorId" text,
    "survivorHandle" text NOT NULL,
    "locationName" text,
    status text DEFAULT 'open'::text NOT NULL,
    urgency text DEFAULT 'routine'::text NOT NULL,
    "threatSummary" text,
    "rescueNotes" text,
    "escortRequired" boolean DEFAULT false NOT NULL,
    "medicalRequired" boolean DEFAULT false NOT NULL,
    "offeredPayment" integer,
    "roeCode" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "outcomeSummary" text,
    "survivorCondition" text,
    CONSTRAINT "RescueRequest_pkey" PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS "Incident" (
    id text NOT NULL,
    "orgId" text NOT NULL,
    "missionId" text,
    "rescueId" text,
    "reporterId" text NOT NULL,
    "reviewerId" text,
    title text NOT NULL,
    category text DEFAULT 'contact'::text NOT NULL,
    severity integer DEFAULT 3 NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    summary text NOT NULL,
    "lessonsLearned" text,
    "actionItems" text,
    "publicSummary" text,
    "closedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    CONSTRAINT "Incident_pkey" PRIMARY KEY (id)
);

-- ============================================================
-- UNIQUE CONSTRAINTS (via ALTER TABLE, idempotent)
-- ============================================================

DO $$ BEGIN
    ALTER TABLE "AiModelOption" ADD CONSTRAINT "AiModelOption_provider_modelId_key" UNIQUE (provider, "modelId");
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "FederatedIntel" ADD CONSTRAINT "FederatedIntel_sourceInstanceId_remoteReportId_key" UNIQUE ("sourceInstanceId", "remoteReportId");
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "RecruitConfig" ADD CONSTRAINT "RecruitConfig_orgId_key" UNIQUE ("orgId");
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "ShipSpec" ADD CONSTRAINT "ShipSpec_fleetyardsSlug_key" UNIQUE ("fleetyardsSlug");
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS "AiAnalysis_orgId_analysisType_createdAt_idx" ON "AiAnalysis" ("orgId", "analysisType", "createdAt");
CREATE INDEX IF NOT EXISTS "AiAnalysis_targetId_idx" ON "AiAnalysis" ("targetId");
CREATE INDEX IF NOT EXISTS "AiConfig_orgId_idx" ON "AiConfig" ("orgId");
CREATE INDEX IF NOT EXISTS "AiModelOption_provider_sortOrder_idx" ON "AiModelOption" (provider, "sortOrder");
CREATE INDEX IF NOT EXISTS "AlertRule_orgId_isEnabled_idx" ON "AlertRule" ("orgId", "isEnabled");
CREATE INDEX IF NOT EXISTS "Application_orgId_createdAt_idx" ON "Application" ("orgId", "createdAt");
CREATE INDEX IF NOT EXISTS "Application_orgId_status_idx" ON "Application" ("orgId", status);
CREATE INDEX IF NOT EXISTS "AuditLog_orgId_createdAt_idx" ON "AuditLog" ("orgId", "createdAt");
CREATE INDEX IF NOT EXISTS "AuditLog_targetType_targetId_idx" ON "AuditLog" ("targetType", "targetId");
CREATE INDEX IF NOT EXISTS "AuditLog_userId_createdAt_idx" ON "AuditLog" ("userId", "createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "DiscordConfig_orgId_key" ON "DiscordConfig" ("orgId");
CREATE INDEX IF NOT EXISTS "DoctrineTemplate_orgId_category_idx" ON "DoctrineTemplate" ("orgId", category);
CREATE UNIQUE INDEX IF NOT EXISTS "DoctrineTemplate_orgId_code_key" ON "DoctrineTemplate" ("orgId", code);
CREATE INDEX IF NOT EXISTS "FederatedIntel_receivedAt_idx" ON "FederatedIntel" ("receivedAt");
CREATE INDEX IF NOT EXISTS "FederatedIntel_severity_idx" ON "FederatedIntel" (severity);
CREATE INDEX IF NOT EXISTS "FederatedIntel_sourceInstanceId_idx" ON "FederatedIntel" ("sourceInstanceId");
CREATE INDEX IF NOT EXISTS "FleetShip_orgId_idx" ON "FleetShip" ("orgId");
CREATE INDEX IF NOT EXISTS "FleetShip_orgId_status_idx" ON "FleetShip" ("orgId", status);
CREATE INDEX IF NOT EXISTS "FleetShip_userId_idx" ON "FleetShip" ("userId");
CREATE INDEX IF NOT EXISTS "Incident_missionId_idx" ON "Incident" ("missionId");
CREATE INDEX IF NOT EXISTS "Incident_orgId_status_idx" ON "Incident" ("orgId", status);
CREATE INDEX IF NOT EXISTS "Incident_rescueId_idx" ON "Incident" ("rescueId");
CREATE INDEX IF NOT EXISTS "Incident_severity_idx" ON "Incident" (severity);
CREATE INDEX IF NOT EXISTS "IntelReport_orgId_isActive_idx" ON "IntelReport" ("orgId", "isActive");
CREATE INDEX IF NOT EXISTS "IntelReport_severity_idx" ON "IntelReport" (severity);
CREATE INDEX IF NOT EXISTS "ManualEntry_orgId_category_idx" ON "ManualEntry" ("orgId", category);
CREATE INDEX IF NOT EXISTS "MissionIntelLink_intelId_idx" ON "MissionIntelLink" ("intelId");
CREATE INDEX IF NOT EXISTS "MissionIntelLink_missionId_idx" ON "MissionIntelLink" ("missionId");
CREATE UNIQUE INDEX IF NOT EXISTS "MissionIntelLink_missionId_intelId_key" ON "MissionIntelLink" ("missionId", "intelId");
CREATE INDEX IF NOT EXISTS "MissionLog_entryType_idx" ON "MissionLog" ("entryType");
CREATE INDEX IF NOT EXISTS "MissionLog_missionId_createdAt_idx" ON "MissionLog" ("missionId", "createdAt");
CREATE INDEX IF NOT EXISTS "MissionParticipant_missionId_idx" ON "MissionParticipant" ("missionId");
CREATE INDEX IF NOT EXISTS "Mission_doctrineTemplateId_idx" ON "Mission" ("doctrineTemplateId");
CREATE INDEX IF NOT EXISTS "Mission_missionType_idx" ON "Mission" ("missionType");
CREATE INDEX IF NOT EXISTS "Mission_orgId_status_idx" ON "Mission" ("orgId", status);
CREATE INDEX IF NOT EXISTS "Notification_orgId_status_createdAt_idx" ON "Notification" ("orgId", status, "createdAt");
CREATE INDEX IF NOT EXISTS "Notification_severity_idx" ON "Notification" (severity);
CREATE INDEX IF NOT EXISTS "OrgMember_orgId_idx" ON "OrgMember" ("orgId");
CREATE UNIQUE INDEX IF NOT EXISTS "OrgMember_userId_orgId_key" ON "OrgMember" ("userId", "orgId");
CREATE UNIQUE INDEX IF NOT EXISTS "Organization_tag_key" ON "Organization" (tag);
CREATE INDEX IF NOT EXISTS "QrfDispatch_missionId_idx" ON "QrfDispatch" ("missionId");
CREATE INDEX IF NOT EXISTS "QrfDispatch_orgId_status_idx" ON "QrfDispatch" ("orgId", status);
CREATE INDEX IF NOT EXISTS "QrfDispatch_qrfId_dispatchedAt_idx" ON "QrfDispatch" ("qrfId", "dispatchedAt");
CREATE INDEX IF NOT EXISTS "QrfDispatch_rescueId_idx" ON "QrfDispatch" ("rescueId");
CREATE INDEX IF NOT EXISTS "QrfReadiness_orgId_status_idx" ON "QrfReadiness" ("orgId", status);
CREATE INDEX IF NOT EXISTS "RescueRequest_orgId_status_idx" ON "RescueRequest" ("orgId", status);
CREATE INDEX IF NOT EXISTS "RescueRequest_urgency_idx" ON "RescueRequest" (urgency);
CREATE INDEX IF NOT EXISTS "ShipSpec_classification_idx" ON "ShipSpec" (classification);
CREATE INDEX IF NOT EXISTS "ShipSpec_name_idx" ON "ShipSpec" (name);
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User" (email);
CREATE UNIQUE INDEX IF NOT EXISTS "User_handle_key" ON "User" (handle);

-- ============================================================
-- FOREIGN KEYS (idempotent via DO/EXCEPTION)
-- ============================================================

DO $$ BEGIN
    ALTER TABLE "AiAnalysis" ADD CONSTRAINT "AiAnalysis_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"(id) ON UPDATE CASCADE ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "AiConfig" ADD CONSTRAINT "AiConfig_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"(id) ON UPDATE CASCADE ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "AlertRule" ADD CONSTRAINT "AlertRule_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"(id) ON UPDATE CASCADE ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "Application" ADD CONSTRAINT "Application_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"(id) ON UPDATE CASCADE ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"(id) ON UPDATE CASCADE ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"(id) ON UPDATE CASCADE ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "DiscordConfig" ADD CONSTRAINT "DiscordConfig_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"(id) ON UPDATE CASCADE ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "DoctrineTemplate" ADD CONSTRAINT "DoctrineTemplate_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"(id) ON UPDATE CASCADE ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "FleetShip" ADD CONSTRAINT "FleetShip_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "FleetShip" ADD CONSTRAINT "FleetShip_shipSpecId_fkey" FOREIGN KEY ("shipSpecId") REFERENCES "ShipSpec"(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "FleetShip" ADD CONSTRAINT "FleetShip_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "Incident" ADD CONSTRAINT "Incident_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission"(id) ON UPDATE CASCADE ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "Incident" ADD CONSTRAINT "Incident_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"(id) ON UPDATE CASCADE ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "Incident" ADD CONSTRAINT "Incident_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"(id) ON UPDATE CASCADE ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "Incident" ADD CONSTRAINT "Incident_rescueId_fkey" FOREIGN KEY ("rescueId") REFERENCES "RescueRequest"(id) ON UPDATE CASCADE ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "Incident" ADD CONSTRAINT "Incident_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"(id) ON UPDATE CASCADE ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "IntelReport" ADD CONSTRAINT "IntelReport_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"(id) ON UPDATE CASCADE ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "ManualEntry" ADD CONSTRAINT "ManualEntry_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"(id) ON UPDATE CASCADE ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "ManualEntry" ADD CONSTRAINT "ManualEntry_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"(id) ON UPDATE CASCADE ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "MissionIntelLink" ADD CONSTRAINT "MissionIntelLink_intelId_fkey" FOREIGN KEY ("intelId") REFERENCES "IntelReport"(id) ON UPDATE CASCADE ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "MissionIntelLink" ADD CONSTRAINT "MissionIntelLink_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission"(id) ON UPDATE CASCADE ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "MissionLog" ADD CONSTRAINT "MissionLog_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"(id) ON UPDATE CASCADE ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "MissionLog" ADD CONSTRAINT "MissionLog_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission"(id) ON UPDATE CASCADE ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "MissionParticipant" ADD CONSTRAINT "MissionParticipant_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission"(id) ON UPDATE CASCADE ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "Mission" ADD CONSTRAINT "Mission_doctrineTemplateId_fkey" FOREIGN KEY ("doctrineTemplateId") REFERENCES "DoctrineTemplate"(id) ON UPDATE CASCADE ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "Mission" ADD CONSTRAINT "Mission_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "User"(id) ON UPDATE CASCADE ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "Mission" ADD CONSTRAINT "Mission_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"(id) ON UPDATE CASCADE ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "Notification" ADD CONSTRAINT "Notification_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"(id) ON UPDATE CASCADE ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "Notification" ADD CONSTRAINT "Notification_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"(id) ON UPDATE CASCADE ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "OrgMember" ADD CONSTRAINT "OrgMember_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"(id) ON UPDATE CASCADE ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "OrgMember" ADD CONSTRAINT "OrgMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"(id) ON UPDATE CASCADE ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "QrfDispatch" ADD CONSTRAINT "QrfDispatch_dispatchedById_fkey" FOREIGN KEY ("dispatchedById") REFERENCES "User"(id) ON UPDATE CASCADE ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "QrfDispatch" ADD CONSTRAINT "QrfDispatch_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission"(id) ON UPDATE CASCADE ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "QrfDispatch" ADD CONSTRAINT "QrfDispatch_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"(id) ON UPDATE CASCADE ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "QrfDispatch" ADD CONSTRAINT "QrfDispatch_qrfId_fkey" FOREIGN KEY ("qrfId") REFERENCES "QrfReadiness"(id) ON UPDATE CASCADE ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "QrfDispatch" ADD CONSTRAINT "QrfDispatch_rescueId_fkey" FOREIGN KEY ("rescueId") REFERENCES "RescueRequest"(id) ON UPDATE CASCADE ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "QrfReadiness" ADD CONSTRAINT "QrfReadiness_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"(id) ON UPDATE CASCADE ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "RecruitConfig" ADD CONSTRAINT "RecruitConfig_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"(id) ON UPDATE CASCADE ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "RescueRequest" ADD CONSTRAINT "RescueRequest_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "User"(id) ON UPDATE CASCADE ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "RescueRequest" ADD CONSTRAINT "RescueRequest_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"(id) ON UPDATE CASCADE ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "RescueRequest" ADD CONSTRAINT "RescueRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"(id) ON UPDATE CASCADE ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;
