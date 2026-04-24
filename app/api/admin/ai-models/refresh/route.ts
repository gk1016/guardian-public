import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { canManageAdministration } from "@/lib/roles";
import { prisma } from "@/lib/prisma";

type ProviderModel = {
  modelId: string;
  displayName: string;
  category: string;
};

// Provider-specific model fetchers

async function fetchAnthropicModels(apiKey: string): Promise<ProviderModel[]> {
  const res = await fetch("https://api.anthropic.com/v1/models?limit=100", {
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
  });
  if (!res.ok) return [];
  const data = await res.json();
  const models: ProviderModel[] = [];
  for (const m of data.data ?? []) {
    // Filter to chat/completion models only
    if (!m.id || m.id.startsWith("claude-instant")) continue;
    const name = m.display_name ?? formatModelName(m.id);
    const cat = m.id.includes("haiku") ? "fast" : m.id.includes("opus") ? "reasoning" : "chat";
    models.push({ modelId: m.id, displayName: name, category: cat });
  }
  return models;
}

async function fetchOpenAIModels(apiKey: string, baseUrl: string): Promise<ProviderModel[]> {
  const url = `${baseUrl || "https://api.openai.com"}/v1/models`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) return [];
  const data = await res.json();
  const models: ProviderModel[] = [];
  for (const m of data.data ?? []) {
    const id: string = m.id;
    // Filter to useful chat/reasoning models
    if (
      id.startsWith("gpt-") ||
      id.startsWith("o3") ||
      id.startsWith("o4") ||
      id.startsWith("chatgpt-")
    ) {
      const cat = id.startsWith("o") ? "reasoning" : id.includes("mini") || id.includes("nano") ? "fast" : "chat";
      models.push({ modelId: id, displayName: formatModelName(id), category: cat });
    }
  }
  return models;
}

async function fetchGoogleModels(apiKey: string): Promise<ProviderModel[]> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
  );
  if (!res.ok) return [];
  const data = await res.json();
  const models: ProviderModel[] = [];
  for (const m of data.models ?? []) {
    const id: string = m.name?.replace("models/", "") ?? "";
    if (!id.startsWith("gemini-")) continue;
    const name = m.displayName ?? formatModelName(id);
    const cat = id.includes("flash") || id.includes("lite") ? "fast" : id.includes("pro") ? "reasoning" : "chat";
    models.push({ modelId: id, displayName: name, category: cat });
  }
  return models;
}

async function fetchOllamaModels(baseUrl: string): Promise<ProviderModel[]> {
  if (!baseUrl) return [];
  const res = await fetch(`${baseUrl}/api/tags`);
  if (!res.ok) return [];
  const data = await res.json();
  const models: ProviderModel[] = [];
  for (const m of data.models ?? []) {
    const id: string = m.name ?? m.model ?? "";
    if (!id) continue;
    const size = m.details?.parameter_size ?? "";
    const displayName = size ? `${id} (${size})` : id;
    models.push({ modelId: id, displayName, category: "chat" });
  }
  return models;
}

function formatModelName(modelId: string): string {
  return modelId
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export async function POST(request: Request) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  if (!canManageAdministration(session.role)) {
    return NextResponse.json({ error: "Admin authority required." }, { status: 403 });
  }

  const body = await request.json();
  const provider: string = body.provider;

  if (!provider) {
    return NextResponse.json({ error: "Provider is required." }, { status: 400 });
  }

  // Get the current AI config to retrieve API key and base URL
  const aiConfig = await prisma.aiConfig.findFirst({
    where: { provider },
    select: { apiKey: true, baseUrl: true },
  });

  let fetched: ProviderModel[] = [];
  let source = "api";

  try {
    switch (provider) {
      case "anthropic":
        if (!aiConfig?.apiKey) {
          return NextResponse.json({ error: "Configure an Anthropic API key first." }, { status: 400 });
        }
        fetched = await fetchAnthropicModels(aiConfig.apiKey);
        break;

      case "openai":
        if (!aiConfig?.apiKey) {
          return NextResponse.json({ error: "Configure an OpenAI API key first." }, { status: 400 });
        }
        fetched = await fetchOpenAIModels(aiConfig.apiKey, aiConfig.baseUrl ?? "");
        break;

      case "google":
        if (!aiConfig?.apiKey) {
          return NextResponse.json({ error: "Configure a Google API key first." }, { status: 400 });
        }
        fetched = await fetchGoogleModels(aiConfig.apiKey);
        break;

      case "ollama_cloud":
      case "ollama_local": {
        const url = aiConfig?.baseUrl || (provider === "ollama_local" ? "http://localhost:11434" : "");
        if (!url) {
          return NextResponse.json({ error: "Configure the Ollama base URL first." }, { status: 400 });
        }
        fetched = await fetchOllamaModels(url);
        source = "instance";
        break;
      }

      default:
        return NextResponse.json({ error: `Unknown provider: ${provider}` }, { status: 400 });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch models";
    return NextResponse.json({ error: `Provider API error: ${message}` }, { status: 502 });
  }

  if (fetched.length === 0) {
    return NextResponse.json({
      error: `No models returned from ${provider}. Check your API key and connectivity.`,
    }, { status: 404 });
  }

  // Upsert fetched models
  let upserted = 0;
  for (let i = 0; i < fetched.length; i++) {
    const m = fetched[i];
    await prisma.$executeRawUnsafe(
      `INSERT INTO "AiModelOption" (id, provider, "modelId", "displayName", category, "isDefault", "sortOrder", "createdAt", "updatedAt")
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, false, $5, NOW(), NOW())
       ON CONFLICT (provider, "modelId") DO UPDATE SET
         "displayName" = EXCLUDED."displayName",
         category = EXCLUDED.category,
         "updatedAt" = NOW()`,
      provider, m.modelId, m.displayName, m.category, (i + 1) * 10
    );
    upserted++;
  }

  return NextResponse.json({
    ok: true,
    source,
    provider,
    modelsFound: fetched.length,
    upserted,
  });
}
