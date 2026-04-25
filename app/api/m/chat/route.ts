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
 * Normalizes all provider streams to OpenAI-compatible SSE format
 * so the G2 client only needs one parser.
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

    // Build provider-specific request
    const isAnthropic = aiConfig.provider === "anthropic";
    const providerUrl = getProviderUrl(aiConfig.provider, aiConfig.baseUrl);
    const providerHeaders = getProviderHeaders(aiConfig.provider, aiConfig.apiKey);

    let providerBody: Record<string, unknown>;

    if (isAnthropic) {
      // Anthropic Messages API: system is a top-level param, not in messages
      providerBody = {
        model: aiConfig.model,
        max_tokens: aiConfig.maxTokens || 1024,
        temperature: aiConfig.temperature ?? 0.7,
        stream: true,
        system: systemPrompt,
        messages: [
          { role: "user", content: payload.data.message },
        ],
      };
    } else {
      // OpenAI-compatible (OpenAI, Ollama, etc.)
      providerBody = {
        model: aiConfig.model,
        max_tokens: aiConfig.maxTokens || 1024,
        temperature: aiConfig.temperature ?? 0.7,
        stream: true,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: payload.data.message },
        ],
      };
    }

    const providerRes = await fetch(providerUrl, {
      method: "POST",
      headers: providerHeaders,
      body: JSON.stringify(providerBody),
    });

    if (!providerRes.ok) {
      const errText = await providerRes.text().catch(() => "Unknown error");
      log.error("AI provider error", {
        status: providerRes.status,
        provider: aiConfig.provider,
        error: errText.slice(0, 200),
      });
      return NextResponse.json(
        { error: `AI provider returned ${providerRes.status}` },
        { status: 502 },
      );
    }

    const sessionId = payload.data.sessionId || crypto.randomUUID();

    const responseHeaders = new Headers({
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Session-Id": sessionId,
    });

    if (isAnthropic) {
      // Transform Anthropic SSE stream → OpenAI-compatible SSE
      const transformedStream = transformAnthropicStream(providerRes.body!);
      return new Response(transformedStream, {
        status: 200,
        headers: responseHeaders,
      });
    }

    // OpenAI/Ollama: pass through directly
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

/**
 * Transform Anthropic Messages API SSE stream into OpenAI-compatible format.
 *
 * Anthropic sends:
 *   event: content_block_delta
 *   data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello"}}
 *
 *   event: message_stop
 *   data: {"type":"message_stop"}
 *
 * We transform to:
 *   data: {"choices":[{"delta":{"content":"Hello"}}]}
 *   data: [DONE]
 */
function transformAnthropicStream(
  sourceBody: ReadableStream<Uint8Array>,
): ReadableStream<Uint8Array> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = sourceBody.getReader();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            // Emit final [DONE]
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6).trim();
            if (!data || data === "[DONE]") continue;

            try {
              const parsed = JSON.parse(data);

              if (parsed.type === "content_block_delta") {
                const text = parsed.delta?.text;
                if (text) {
                  // Emit as OpenAI-compatible SSE
                  const openaiChunk = JSON.stringify({
                    choices: [{ delta: { content: text } }],
                  });
                  controller.enqueue(
                    encoder.encode(`data: ${openaiChunk}\n\n`),
                  );
                }
              } else if (parsed.type === "message_stop") {
                controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                controller.close();
                return;
              }
              // Ignore message_start, content_block_start, content_block_stop, ping
            } catch {
              // Skip unparseable lines
            }
          }
        }
      } catch (err) {
        controller.error(err);
      }
    },
  });
}

function getProviderUrl(provider: string, baseUrl: string | null): string {
  if (baseUrl) {
    const base = baseUrl.replace(/\/$/, "");
    // If custom baseUrl is set for Anthropic, still use Messages API path
    if (provider === "anthropic") {
      return base + "/v1/messages";
    }
    return base + "/v1/chat/completions";
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
