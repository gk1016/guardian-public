import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { canManageAdministration } from "@/lib/roles";
import { prisma } from "@/lib/prisma";

type ProviderModel = {
  modelId: string;
  displayName: string;
  category: string;
};

// ---------------------------------------------------------------------------
// Categorization — resilient to new model families
// ---------------------------------------------------------------------------

function categorizeAnthropic(id: string): string {
  if (/haiku/i.test(id)) return "fast";
  if (/opus/i.test(id)) return "reasoning";
  return "chat"; // sonnet and anything new defaults to chat
}

function categorizeOpenAI(id: string): string {
  if (/^o\d/.test(id)) return "reasoning"; // o3, o4, o5, etc.
  if (/nano/i.test(id)) return "fast";
  if (/mini/i.test(id)) return "fast";
  return "chat";
}

function categorizeGoogle(id: string): string {
  if (/flash|lite/i.test(id)) return "fast";
  if (/pro|ultra/i.test(id)) return "reasoning";
  return "chat";
}

function categorizeOllama(id: string): string {
  const lower = id.toLowerCase();
  if (/deepseek-r1|qwq/i.test(lower)) return "reasoning";
  if (/maverick/i.test(lower)) return "reasoning";
  if (/\b(1b|3b|7b)\b/.test(lower)) return "fast";
  return "chat";
}

// ---------------------------------------------------------------------------
// Display name formatting
// ---------------------------------------------------------------------------

function formatModelName(modelId: string): string {
  return modelId
    .replace(/-(\d)/g, " $1") // claude-sonnet-4-6 → claude sonnet 4 6
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bGpt\b/g, "GPT")
    .replace(/\bO(\d)/g, "o$1"); // keep o3, o4 lowercase per convention
}

function formatOllamaName(id: string, size: string): string {
  // llama4:scout → Llama 4 Scout
  const name = id
    .replace(/:/g, " ")
    .replace(/(\d)([a-z])/gi, "$1 $2")
    .replace(/([a-z])(\d)/gi, "$1 $2")
    .replace(/\b\w/g, (c) => c.toUpperCase());
  return size ? `${name} (${size})` : name;
}

// ---------------------------------------------------------------------------
// Provider-specific model fetchers
// ---------------------------------------------------------------------------

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
    if (!m.id || m.id.startsWith("claude-instant")) continue;
    const name = m.display_name ?? formatModelName(m.id);
    models.push({
      modelId: m.id,
      displayName: name,
      category: categorizeAnthropic(m.id),
    });
  }
  return models;
}

async function fetchOpenAIModels(
  apiKey: string,
  baseUrl: string,
): Promise<ProviderModel[]> {
  const url = `${baseUrl || "https://api.openai.com"}/v1/models`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) return [];
  const data = await res.json();
  const models: ProviderModel[] = [];
  for (const m of data.data ?? []) {
    const id: string = m.id;
    // Accept chat, reasoning, and code models — skip embeddings, tts, dall-e, whisper, etc.
    if (
      id.startsWith("gpt-") ||
      id.startsWith("o3") ||
      id.startsWith("o4") ||
      id.startsWith("o5") ||
      id.startsWith("chatgpt-")
    ) {
      models.push({
        modelId: id,
        displayName: formatModelName(id),
        category: categorizeOpenAI(id),
      });
    }
  }
  return models;
}

async function fetchGoogleModels(apiKey: string): Promise<ProviderModel[]> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
  );
  if (!res.ok) return [];
  const data = await res.json();
  const models: ProviderModel[] = [];
  for (const m of data.models ?? []) {
    const id: string = m.name?.replace("models/", "") ?? "";
    if (!id.startsWith("gemini-")) continue;
    const name = m.displayName ?? formatModelName(id);
    models.push({
      modelId: id,
      displayName: name,
      category: categorizeGoogle(id),
    });
  }
  return models;
}

async function fetchOllamaModels(
  baseUrl: string,
  apiKey: string | null,
): Promise<ProviderModel[]> {
  if (!baseUrl) return [];
  const headers: Record<string, string> = {};
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;
  const res = await fetch(`${baseUrl}/api/tags`, { headers });
  if (!res.ok) return [];
  const data = await res.json();
  const models: ProviderModel[] = [];
  for (const m of data.models ?? []) {
    const id: string = m.name ?? m.model ?? "";
    if (!id) continue;
    const size = m.details?.parameter_size ?? "";
    models.push({
      modelId: id,
      displayName: formatOllamaName(id, size),
      category: categorizeOllama(id),
    });
  }
  return models;
}

// ---------------------------------------------------------------------------
// Fetch models for a single provider
// ---------------------------------------------------------------------------

async function fetchForProvider(
  provider: string,
): Promise<{ models: ProviderModel[]; source: string; error?: string }> {
  const aiConfig = await prisma.aiConfig.findFirst({
    where: { provider },
    select: { apiKey: true, baseUrl: true },
  });

  try {
    switch (provider) {
      case "anthropic": {
        if (!aiConfig?.apiKey)
          return { models: [], source: "api", error: "No API key configured." };
        return { models: await fetchAnthropicModels(aiConfig.apiKey), source: "api" };
      }
      case "openai": {
        if (!aiConfig?.apiKey)
          return { models: [], source: "api", error: "No API key configured." };
        return {
          models: await fetchOpenAIModels(aiConfig.apiKey, aiConfig.baseUrl ?? ""),
          source: "api",
        };
      }
      case "google": {
        if (!aiConfig?.apiKey)
          return { models: [], source: "api", error: "No API key configured." };
        return { models: await fetchGoogleModels(aiConfig.apiKey), source: "api" };
      }
      case "ollama_cloud":
      case "ollama_local": {
        const url =
          aiConfig?.baseUrl ||
          (provider === "ollama_local" ? "http://localhost:11434" : "");
        if (!url)
          return { models: [], source: "instance", error: "No base URL configured." };
        return {
          models: await fetchOllamaModels(url, aiConfig?.apiKey ?? null),
          source: "instance",
        };
      }
      default:
        return { models: [], source: "api", error: `Unknown provider: ${provider}` };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Fetch failed";
    return { models: [], source: "api", error: message };
  }
}

// ---------------------------------------------------------------------------
// Upsert + prune for a provider
// ---------------------------------------------------------------------------

async function syncModels(
  provider: string,
  fetched: ProviderModel[],
): Promise<{ upserted: number; pruned: number }> {
  const fetchedIds = new Set(fetched.map((m) => m.modelId));

  // Upsert
  let upserted = 0;
  for (let i = 0; i < fetched.length; i++) {
    const m = fetched[i];
    const sortOrder = (i + 1) * 10;
    await prisma.$executeRaw`
      INSERT INTO "AiModelOption" (id, provider, "modelId", "displayName", category, "isDefault", "sortOrder", "createdAt", "updatedAt")
      VALUES (gen_random_uuid()::text, ${provider}, ${m.modelId}, ${m.displayName}, ${m.category}, false, ${sortOrder}, NOW(), NOW())
      ON CONFLICT (provider, "modelId") DO UPDATE SET
        "displayName" = EXCLUDED."displayName",
        category = EXCLUDED.category,
        "sortOrder" = EXCLUDED."sortOrder",
        "updatedAt" = NOW()
    `;
    upserted++;
  }

  // Prune models that are no longer returned by the provider API.
  // Keep models that are currently selected in AiConfig to avoid breaking active config.
  const activeModels = await prisma.aiConfig.findMany({
    where: { provider },
    select: { model: true },
  });
  const activeModelIds = new Set(activeModels.map((c) => c.model));

  const existing = await prisma.aiModelOption.findMany({
    where: { provider },
    select: { id: true, modelId: true },
  });

  const toDelete = existing.filter(
    (e) => !fetchedIds.has(e.modelId) && !activeModelIds.has(e.modelId),
  );

  if (toDelete.length > 0) {
    await prisma.aiModelOption.deleteMany({
      where: { id: { in: toDelete.map((d) => d.id) } },
    });
  }

  return { upserted, pruned: toDelete.length };
}

// ---------------------------------------------------------------------------
// POST handler — supports single provider or "all"
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  }
  if (!canManageAdministration(session.role)) {
    return NextResponse.json(
      { error: "Admin authority required." },
      { status: 403 },
    );
  }

  const body = await request.json();
  const provider: string = body.provider;

  if (!provider) {
    return NextResponse.json(
      { error: "Provider is required. Use a provider name or 'all'." },
      { status: 400 },
    );
  }

  // --- Refresh all configured providers ---
  if (provider === "all") {
    // Find all providers that have a config row
    const configs = await prisma.aiConfig.findMany({
      select: { provider: true },
    });
    const providers = configs.map((c) => c.provider);

    const results: Record<
      string,
      { modelsFound: number; upserted: number; pruned: number; error?: string }
    > = {};

    for (const p of providers) {
      const { models, error } = await fetchForProvider(p);
      if (error || models.length === 0) {
        results[p] = { modelsFound: 0, upserted: 0, pruned: 0, error: error || "No models returned" };
        continue;
      }
      const { upserted, pruned } = await syncModels(p, models);
      results[p] = { modelsFound: models.length, upserted, pruned };
    }

    return NextResponse.json({ ok: true, provider: "all", results });
  }

  // --- Single provider refresh ---
  const { models: fetched, source, error } = await fetchForProvider(provider);

  if (error) {
    return NextResponse.json(
      { error: `Provider error: ${error}` },
      { status: 502 },
    );
  }

  if (fetched.length === 0) {
    return NextResponse.json(
      {
        error: `No models returned from ${provider}. Check your API key and connectivity.`,
      },
      { status: 404 },
    );
  }

  const { upserted, pruned } = await syncModels(provider, fetched);

  return NextResponse.json({
    ok: true,
    source,
    provider,
    modelsFound: fetched.length,
    upserted,
    pruned,
  });
}
