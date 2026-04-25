import { NextResponse } from "next/server";
import { z } from "zod";
import { requireMobileSession } from "@/lib/mobile-auth";
import { getOrgForUser } from "@/lib/guardian-data";
import { prisma } from "@/lib/prisma";
import { log } from "@/lib/logger";

/**
 * POST /api/m/chat
 * AI chat proxy for G2 glasses — commander role only.
 * Streams SSE responses from the configured AI provider.
 * Injects ops context into the system prompt.
 */

const chatSchema = z.object({
  message: z.string().trim().min(1).max(2000),
  sessionId: z.string().max(100).optional(),
});

const COMMANDER_ROLES = new Set(["commander", "director", "admin"]);

export async function POST(request: Request) {
  const session = await requireMobileSession(request);
  if (session instanceof NextResponse) return session;

  if (!COMMANDER_ROLES.has(session.role)) {
    return NextResponse.json(
      { error: "AI chat requires command authority." },
      { status: 403 },
    );
  }

  const body = await request.json();
  const payload = chatSchema.safeParse(body);
  if (!payload.success) {
    return NextResponse.json(
      { error: "Invalid chat payload." },
      { status: 400 },
    );
  }

  try {
    const org = await getOrgForUser(session.userId);
    if (!org) {
      return NextResponse.json(
        { error: "No organization found." },
        { status: 400 },
      );
    }

    // Load AI config
    const aiConfig = await prisma.aiConfig.findFirst({
      where: { orgId: org.id, enabled: true },
    });

    if (!aiConfig || !aiConfig.apiKey) {
      return NextResponse.json(
        { error: "AI is not configured for this organization. Set it up in the Guardian web interface." },
        { status: 503 },
      );
    }

    // Gather ops context for system prompt
    const [activeMissions, activeIntel, qrfReady, recentNotifications] =
      await Promise.all([
        prisma.mission.findMany({
          where: {
            orgId: org.id,
            status: { in: ["planning", "ready", "active"] },
          },
          take: 6,
          select: {
            callsign: true,
            title: true,
            status: true,
            priority: true,
            areaOfOperation: true,
          },
        }),
        prisma.intelReport.findMany({
          where: { orgId: org.id, isActive: true },
          orderBy: { severity: "desc" },
          take: 6,
          select: {
            title: true,
            severity: true,
            reportType: true,
            hostileGroup: true,
            locationName: true,
          },
        }),
        prisma.qrfReadiness.count({
          where: { orgId: org.id, status: { in: ["redcon1", "redcon2"] } },
        }),
        prisma.notification.findMany({
          where: { orgId: org.id, status: "unread" },
          orderBy: { createdAt: "desc" },
          take: 4,
          select: { title: true, severity: true },
        }),
      ]);

    const opsContext = [
      `Organization: ${org.name}`,
      `Active missions: ${activeMissions.length}`,
      ...activeMissions.map(
        (m) =>
          `  - ${m.callsign}: ${m.title} [${m.status}/${m.priority}]${m.areaOfOperation ? ` AO: ${m.areaOfOperation}` : ""}`,
      ),
      `Active intel reports: ${activeIntel.length}`,
      ...activeIntel.map(
        (i) =>
          `  - ${i.title} [sev ${i.severity}/${i.reportType}]${i.hostileGroup ? ` hostile: ${i.hostileGroup}` : ""}${i.locationName ? ` at ${i.locationName}` : ""}`,
      ),
      `QRF ready assets: ${qrfReady}`,
      `Unread alerts: ${recentNotifications.length}`,
      ...recentNotifications.map((n) => `  - [${n.severity}] ${n.title}`),
    ].join("\n");

    const systemPrompt = [
      "You are Guardian AI, the operational intelligence assistant for a Star Citizen organization.",
      "You have access to real-time operational data shown below.",
      "Answer questions about missions, threats, intel, QRF status, and operational readiness.",
      "Be concise — responses are displayed on smart glasses with limited screen space (~380 chars per page).",
      "Use military/aviation brevity where appropriate.",
      "",
      "CURRENT OPS STATUS:",
      opsContext,
    ].join("\n");

    // Build provider request
    const providerUrl = getProviderUrl(aiConfig.provider, aiConfig.baseUrl);
    const providerHeaders = getProviderHeaders(
      aiConfig.provider,
      aiConfig.apiKey,
    );

    const providerBody = {
      model: aiConfig.model,
      max_tokens: aiConfig.maxTokens,
      temperature: aiConfig.temperature,
      stream: true,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: payload.data.message },
      ],
    };

    const providerRes = await fetch(providerUrl, {
      method: "POST",
      headers: providerHeaders,
      body: JSON.stringify(providerBody),
    });

    if (!providerRes.ok) {
      const errText = await providerRes.text().catch(() => "Unknown error");
      log.error("AI provider error", {
        status: providerRes.status,
        error: errText.slice(0, 200),
      });
      return NextResponse.json(
        { error: `AI provider returned ${providerRes.status}` },
        { status: 502 },
      );
    }

    // Stream the response through as SSE
    const sessionId = payload.data.sessionId || crypto.randomUUID();

    const responseHeaders = new Headers({
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Session-Id": sessionId,
    });

    // Pass through the provider's SSE stream directly
    return new Response(providerRes.body, {
      status: 200,
      headers: responseHeaders,
    });
  } catch (error) {
    log.error("Mobile chat failed", {
      err: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Chat request failed." },
      { status: 500 },
    );
  }
}

function getProviderUrl(provider: string, baseUrl: string | null): string {
  if (baseUrl) {
    // Ollama or custom endpoint
    return baseUrl.replace(/\/$/, "") + "/v1/chat/completions";
  }

  switch (provider) {
    case "anthropic":
      return "https://api.anthropic.com/v1/messages";
    case "openai":
      return "https://api.openai.com/v1/chat/completions";
    case "ollama":
      return "http://localhost:11434/v1/chat/completions";
    default:
      return "https://api.openai.com/v1/chat/completions";
  }
}

function getProviderHeaders(
  provider: string,
  apiKey: string,
): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  switch (provider) {
    case "anthropic":
      headers["x-api-key"] = apiKey;
      headers["anthropic-version"] = "2023-06-01";
      break;
    default:
      headers["Authorization"] = `Bearer ${apiKey}`;
      break;
  }

  return headers;
}
