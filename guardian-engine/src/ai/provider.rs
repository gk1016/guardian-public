//! AI Provider trait and implementations for all supported backends.
//!
//! Supported providers:
//! - Anthropic (Messages API)
//! - OpenAI (Chat Completions API)
//! - Google (Gemini generateContent API)
//! - Ollama Cloud (OpenAI-compatible API, remote)
//! - Ollama Local (OpenAI-compatible API, localhost)

use std::sync::Arc;
use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};

use super::config::AiConfig;

// ---------------------------------------------------------------------------
// Trait
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize)]
pub struct ChatMessage {
    pub role: String,   // "system", "user", "assistant"
    pub content: String,
}

#[derive(Debug, Clone)]
pub struct CompletionOptions {
    pub max_tokens: i32,
    pub temperature: f64,
}

#[async_trait::async_trait]
pub trait AiProvider: Send + Sync {
    /// Provider name for logging and DB storage.
    fn name(&self) -> &str;

    /// Model identifier.
    fn model(&self) -> &str;

    /// Send a completion request and return the response text.
    async fn complete(&self, messages: Vec<ChatMessage>, options: CompletionOptions) -> Result<String>;

    /// Quick connectivity check — returns Ok(()) if the provider is reachable.
    async fn health_check(&self) -> Result<()>;
}

/// Build the appropriate provider from config.
pub fn build_provider(cfg: &AiConfig) -> Result<Arc<dyn AiProvider>> {
    match cfg.provider.as_str() {
        "anthropic" => {
            let key = cfg.api_key.as_deref()
                .ok_or_else(|| anyhow!("Anthropic requires an API key"))?;
            Ok(Arc::new(AnthropicProvider::new(key, &cfg.model)))
        }
        "openai" => {
            let key = cfg.api_key.as_deref()
                .ok_or_else(|| anyhow!("OpenAI requires an API key"))?;
            let base = cfg.base_url.as_deref().unwrap_or("https://api.openai.com");
            Ok(Arc::new(OpenAiProvider::new(key, &cfg.model, base)))
        }
        "google" => {
            let key = cfg.api_key.as_deref()
                .ok_or_else(|| anyhow!("Google AI requires an API key"))?;
            Ok(Arc::new(GoogleProvider::new(key, &cfg.model)))
        }
        "ollama_cloud" => {
            let base = cfg.base_url.as_deref()
                .ok_or_else(|| anyhow!("Ollama Cloud requires a base URL"))?;
            let key = cfg.api_key.as_deref(); // optional for some cloud providers
            Ok(Arc::new(OllamaProvider::new(&cfg.model, base, key, "ollama_cloud")))
        }
        "ollama_local" => {
            let base = cfg.base_url.as_deref().unwrap_or("http://localhost:11434");
            Ok(Arc::new(OllamaProvider::new(&cfg.model, base, None, "ollama_local")))
        }
        other => Err(anyhow!("Unknown AI provider: {}", other)),
    }
}

// ---------------------------------------------------------------------------
// Anthropic (Messages API)
// ---------------------------------------------------------------------------

struct AnthropicProvider {
    client: reqwest::Client,
    api_key: String,
    model: String,
}

impl AnthropicProvider {
    fn new(api_key: &str, model: &str) -> Self {
        Self {
            client: reqwest::Client::new(),
            api_key: api_key.to_string(),
            model: model.to_string(),
        }
    }
}

#[derive(Serialize)]
struct AnthropicRequest {
    model: String,
    max_tokens: i32,
    temperature: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    system: Option<String>,
    messages: Vec<AnthropicMessage>,
}

#[derive(Serialize)]
struct AnthropicMessage {
    role: String,
    content: String,
}

#[derive(Deserialize)]
struct AnthropicResponse {
    content: Vec<AnthropicContent>,
}

#[derive(Deserialize)]
struct AnthropicContent {
    text: String,
}

#[async_trait::async_trait]
impl AiProvider for AnthropicProvider {
    fn name(&self) -> &str { "anthropic" }
    fn model(&self) -> &str { &self.model }

    async fn complete(&self, messages: Vec<ChatMessage>, options: CompletionOptions) -> Result<String> {
        // Extract system message if present
        let system = messages.iter()
            .find(|m| m.role == "system")
            .map(|m| m.content.clone());

        let msgs: Vec<AnthropicMessage> = messages.into_iter()
            .filter(|m| m.role != "system")
            .map(|m| AnthropicMessage { role: m.role, content: m.content })
            .collect();

        let body = AnthropicRequest {
            model: self.model.clone(),
            max_tokens: options.max_tokens,
            temperature: options.temperature,
            system,
            messages: msgs,
        };

        let resp = self.client
            .post("https://api.anthropic.com/v1/messages")
            .header("x-api-key", &self.api_key)
            .header("anthropic-version", "2023-06-01")
            .header("content-type", "application/json")
            .json(&body)
            .send()
            .await?;

        if !resp.status().is_success() {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            return Err(anyhow!("Anthropic API error {}: {}", status, text));
        }

        let data: AnthropicResponse = resp.json().await?;
        data.content.first()
            .map(|c| c.text.clone())
            .ok_or_else(|| anyhow!("Anthropic returned empty response"))
    }

    async fn health_check(&self) -> Result<()> {
        // Light request — just check auth with a tiny completion
        let msgs = vec![ChatMessage { role: "user".into(), content: "ping".into() }];
        let opts = CompletionOptions { max_tokens: 5, temperature: 0.0 };
        self.complete(msgs, opts).await?;
        Ok(())
    }
}

// ---------------------------------------------------------------------------
// OpenAI (Chat Completions API)
// ---------------------------------------------------------------------------

struct OpenAiProvider {
    client: reqwest::Client,
    api_key: String,
    model: String,
    base_url: String,
}

impl OpenAiProvider {
    fn new(api_key: &str, model: &str, base_url: &str) -> Self {
        Self {
            client: reqwest::Client::new(),
            api_key: api_key.to_string(),
            model: model.to_string(),
            base_url: base_url.trim_end_matches('/').to_string(),
        }
    }
}

#[derive(Serialize)]
struct OpenAiRequest {
    model: String,
    messages: Vec<OpenAiMessage>,
    max_tokens: i32,
    temperature: f64,
}

#[derive(Serialize)]
struct OpenAiMessage {
    role: String,
    content: String,
}

#[derive(Deserialize)]
struct OpenAiResponse {
    choices: Vec<OpenAiChoice>,
}

#[derive(Deserialize)]
struct OpenAiChoice {
    message: OpenAiRespMessage,
}

#[derive(Deserialize)]
struct OpenAiRespMessage {
    content: Option<String>,
}

#[async_trait::async_trait]
impl AiProvider for OpenAiProvider {
    fn name(&self) -> &str { "openai" }
    fn model(&self) -> &str { &self.model }

    async fn complete(&self, messages: Vec<ChatMessage>, options: CompletionOptions) -> Result<String> {
        let msgs: Vec<OpenAiMessage> = messages.into_iter()
            .map(|m| OpenAiMessage { role: m.role, content: m.content })
            .collect();

        let body = OpenAiRequest {
            model: self.model.clone(),
            messages: msgs,
            max_tokens: options.max_tokens,
            temperature: options.temperature,
        };

        let url = format!("{}/v1/chat/completions", self.base_url);
        let resp = self.client
            .post(&url)
            .header("Authorization", format!("Bearer {}", self.api_key))
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await?;

        if !resp.status().is_success() {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            return Err(anyhow!("OpenAI API error {}: {}", status, text));
        }

        let data: OpenAiResponse = resp.json().await?;
        data.choices.first()
            .and_then(|c| c.message.content.clone())
            .ok_or_else(|| anyhow!("OpenAI returned empty response"))
    }

    async fn health_check(&self) -> Result<()> {
        let msgs = vec![ChatMessage { role: "user".into(), content: "ping".into() }];
        let opts = CompletionOptions { max_tokens: 5, temperature: 0.0 };
        self.complete(msgs, opts).await?;
        Ok(())
    }
}

// ---------------------------------------------------------------------------
// Google (Gemini generateContent API)
// ---------------------------------------------------------------------------

struct GoogleProvider {
    client: reqwest::Client,
    api_key: String,
    model: String,
}

impl GoogleProvider {
    fn new(api_key: &str, model: &str) -> Self {
        Self {
            client: reqwest::Client::new(),
            api_key: api_key.to_string(),
            model: model.to_string(),
        }
    }
}

#[derive(Serialize)]
struct GeminiRequest {
    contents: Vec<GeminiContent>,
    #[serde(rename = "systemInstruction", skip_serializing_if = "Option::is_none")]
    system_instruction: Option<GeminiContent>,
    #[serde(rename = "generationConfig")]
    generation_config: GeminiGenConfig,
}

#[derive(Serialize)]
struct GeminiContent {
    #[serde(skip_serializing_if = "Option::is_none")]
    role: Option<String>,
    parts: Vec<GeminiPart>,
}

#[derive(Serialize)]
struct GeminiPart {
    text: String,
}

#[derive(Serialize)]
struct GeminiGenConfig {
    #[serde(rename = "maxOutputTokens")]
    max_output_tokens: i32,
    temperature: f64,
}

#[derive(Deserialize)]
struct GeminiResponse {
    candidates: Option<Vec<GeminiCandidate>>,
}

#[derive(Deserialize)]
struct GeminiCandidate {
    content: GeminiRespContent,
}

#[derive(Deserialize)]
struct GeminiRespContent {
    parts: Vec<GeminiRespPart>,
}

#[derive(Deserialize)]
struct GeminiRespPart {
    text: Option<String>,
}

#[async_trait::async_trait]
impl AiProvider for GoogleProvider {
    fn name(&self) -> &str { "google" }
    fn model(&self) -> &str { &self.model }

    async fn complete(&self, messages: Vec<ChatMessage>, options: CompletionOptions) -> Result<String> {
        let system_instruction = messages.iter()
            .find(|m| m.role == "system")
            .map(|m| GeminiContent {
                role: None,
                parts: vec![GeminiPart { text: m.content.clone() }],
            });

        let contents: Vec<GeminiContent> = messages.into_iter()
            .filter(|m| m.role != "system")
            .map(|m| GeminiContent {
                role: Some(if m.role == "assistant" { "model".into() } else { "user".into() }),
                parts: vec![GeminiPart { text: m.content }],
            })
            .collect();

        let body = GeminiRequest {
            contents,
            system_instruction,
            generation_config: GeminiGenConfig {
                max_output_tokens: options.max_tokens,
                temperature: options.temperature,
            },
        };

        let url = format!(
            "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}",
            self.model, self.api_key
        );

        let resp = self.client
            .post(&url)
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await?;

        if !resp.status().is_success() {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            return Err(anyhow!("Google AI API error {}: {}", status, text));
        }

        let data: GeminiResponse = resp.json().await?;
        data.candidates
            .and_then(|c| c.into_iter().next())
            .and_then(|c| c.content.parts.into_iter().next())
            .and_then(|p| p.text)
            .ok_or_else(|| anyhow!("Google AI returned empty response"))
    }

    async fn health_check(&self) -> Result<()> {
        let msgs = vec![ChatMessage { role: "user".into(), content: "ping".into() }];
        let opts = CompletionOptions { max_tokens: 5, temperature: 0.0 };
        self.complete(msgs, opts).await?;
        Ok(())
    }
}

// ---------------------------------------------------------------------------
// Ollama (OpenAI-compatible — works for both cloud and local)
// ---------------------------------------------------------------------------

struct OllamaProvider {
    client: reqwest::Client,
    model: String,
    base_url: String,
    api_key: Option<String>,
    provider_name: String,
}

impl OllamaProvider {
    fn new(model: &str, base_url: &str, api_key: Option<&str>, name: &str) -> Self {
        Self {
            client: reqwest::Client::new(),
            model: model.to_string(),
            base_url: base_url.trim_end_matches('/').to_string(),
            api_key: api_key.map(String::from),
            provider_name: name.to_string(),
        }
    }
}

#[async_trait::async_trait]
impl AiProvider for OllamaProvider {
    fn name(&self) -> &str { &self.provider_name }
    fn model(&self) -> &str { &self.model }

    async fn complete(&self, messages: Vec<ChatMessage>, options: CompletionOptions) -> Result<String> {
        // Ollama supports OpenAI-compatible /v1/chat/completions
        let msgs: Vec<OpenAiMessage> = messages.into_iter()
            .map(|m| OpenAiMessage { role: m.role, content: m.content })
            .collect();

        let body = OpenAiRequest {
            model: self.model.clone(),
            messages: msgs,
            max_tokens: options.max_tokens,
            temperature: options.temperature,
        };

        let url = format!("{}/v1/chat/completions", self.base_url);
        let mut req = self.client
            .post(&url)
            .header("Content-Type", "application/json")
            .json(&body);

        if let Some(key) = &self.api_key {
            req = req.header("Authorization", format!("Bearer {}", key));
        }

        let resp = req.send().await?;

        if !resp.status().is_success() {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            return Err(anyhow!("{} API error {}: {}", self.provider_name, status, text));
        }

        let data: OpenAiResponse = resp.json().await?;
        data.choices.first()
            .and_then(|c| c.message.content.clone())
            .ok_or_else(|| anyhow!("{} returned empty response", self.provider_name))
    }

    async fn health_check(&self) -> Result<()> {
        // For Ollama, check the /api/tags endpoint (lighter than a completion)
        let url = format!("{}/api/tags", self.base_url);
        let resp = self.client.get(&url).send().await?;
        if !resp.status().is_success() {
            return Err(anyhow!("{} health check failed: {}", self.provider_name, resp.status()));
        }
        Ok(())
    }
}
