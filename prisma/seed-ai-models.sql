-- Seed AI model registry with verified current models (April 2026)
-- Run: docker exec guardian-postgres psql -U guardian -d guardian -f /path/to/seed-ai-models.sql

CREATE TABLE IF NOT EXISTS "AiModelOption" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  provider TEXT NOT NULL,
  "modelId" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'chat',
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "sortOrder" INT NOT NULL DEFAULT 100,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(provider, "modelId")
);
CREATE INDEX IF NOT EXISTS "AiModelOption_provider_sortOrder_idx" ON "AiModelOption" (provider, "sortOrder");

INSERT INTO "AiModelOption" (id, provider, "modelId", "displayName", category, "isDefault", "sortOrder") VALUES
  -- Anthropic (docs.anthropic.com/en/docs/about-claude/models)
  (gen_random_uuid()::text, 'anthropic', 'claude-opus-4-7',          'Claude Opus 4.7',          'reasoning', true,  10),
  (gen_random_uuid()::text, 'anthropic', 'claude-sonnet-4-6',        'Claude Sonnet 4.6',        'chat',      false, 20),
  (gen_random_uuid()::text, 'anthropic', 'claude-haiku-4-5-20251001','Claude Haiku 4.5',         'fast',      false, 30),
  -- OpenAI (developers.openai.com/api/docs/models)
  (gen_random_uuid()::text, 'openai', 'gpt-5.4',       'GPT-5.4',       'chat',      true,  10),
  (gen_random_uuid()::text, 'openai', 'gpt-5.4-mini',  'GPT-5.4 Mini',  'fast',      false, 20),
  (gen_random_uuid()::text, 'openai', 'gpt-5.4-nano',  'GPT-5.4 Nano',  'fast',      false, 25),
  (gen_random_uuid()::text, 'openai', 'gpt-4.1',       'GPT-4.1',       'code',      false, 30),
  (gen_random_uuid()::text, 'openai', 'gpt-4.1-mini',  'GPT-4.1 Mini',  'code',      false, 35),
  (gen_random_uuid()::text, 'openai', 'gpt-4.1-nano',  'GPT-4.1 Nano',  'code',      false, 38),
  (gen_random_uuid()::text, 'openai', 'o3',            'o3',            'reasoning', false, 40),
  (gen_random_uuid()::text, 'openai', 'o3-pro',        'o3 Pro',        'reasoning', false, 45),
  (gen_random_uuid()::text, 'openai', 'o4-mini',       'o4 Mini',       'reasoning', false, 50),
  (gen_random_uuid()::text, 'openai', 'o3-mini',       'o3 Mini',       'reasoning', false, 55),
  -- Google (ai.google.dev/gemini-api/docs/models)
  (gen_random_uuid()::text, 'google', 'gemini-3.1-pro',       'Gemini 3.1 Pro',        'reasoning', true,  10),
  (gen_random_uuid()::text, 'google', 'gemini-3.1-flash-lite','Gemini 3.1 Flash Lite', 'fast',      false, 20),
  (gen_random_uuid()::text, 'google', 'gemini-2.5-flash',    'Gemini 2.5 Flash',      'chat',      false, 30),
  (gen_random_uuid()::text, 'google', 'gemini-2.5-pro',      'Gemini 2.5 Pro',        'chat',      false, 35),
  -- Ollama Cloud (common models, real list from /api/tags refresh)
  (gen_random_uuid()::text, 'ollama_cloud', 'llama4:scout',     'Llama 4 Scout',      'chat',      true,  10),
  (gen_random_uuid()::text, 'ollama_cloud', 'llama4:maverick',  'Llama 4 Maverick',   'reasoning', false, 15),
  (gen_random_uuid()::text, 'ollama_cloud', 'qwen3:30b',       'Qwen 3 30B',         'chat',      false, 20),
  (gen_random_uuid()::text, 'ollama_cloud', 'deepseek-r1:70b', 'DeepSeek R1 70B',    'reasoning', false, 25),
  (gen_random_uuid()::text, 'ollama_cloud', 'gemma3:27b',      'Gemma 3 27B',        'chat',      false, 30),
  (gen_random_uuid()::text, 'ollama_cloud', 'mistral:7b',      'Mistral 7B',         'fast',      false, 35),
  -- Ollama Local
  (gen_random_uuid()::text, 'ollama_local', 'llama4:scout',    'Llama 4 Scout',      'chat',      true,  10),
  (gen_random_uuid()::text, 'ollama_local', 'llama4:maverick', 'Llama 4 Maverick',   'reasoning', false, 15),
  (gen_random_uuid()::text, 'ollama_local', 'qwen3:30b',      'Qwen 3 30B',         'chat',      false, 20),
  (gen_random_uuid()::text, 'ollama_local', 'deepseek-r1:70b','DeepSeek R1 70B',    'reasoning', false, 25),
  (gen_random_uuid()::text, 'ollama_local', 'gemma3:27b',     'Gemma 3 27B',        'chat',      false, 30),
  (gen_random_uuid()::text, 'ollama_local', 'mistral:7b',     'Mistral 7B',         'fast',      false, 35),
  (gen_random_uuid()::text, 'ollama_local', 'llama3.2:3b',    'Llama 3.2 3B',       'fast',      false, 40)
ON CONFLICT (provider, "modelId") DO NOTHING;
