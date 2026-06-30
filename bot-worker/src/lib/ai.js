// AI router — senior orchestrator (Claude di chat) menugaskan 4 provider sebagai pendukung.
// Strategy: Cloudflare Workers AI primary (FREE, no training, same network),
//           Z.AI/Groq/OpenRouter sebagai pendukung sesuai keahlian role.
// Fitur: KV rate-limit blacklist 60s (skip provider yang baru kena 429).

const PROVIDERS = {
  groq: {
    type: "http",
    url: "https://api.groq.com/openai/v1/chat/completions",
    keyEnv: "GROQ_API_KEY",
  },
  zai: {
    type: "http",
    url: "https://api.z.ai/api/paas/v4/chat/completions",
    keyEnv: "ZAI_API_KEY",
  },
  openrouter: {
    type: "http",
    url: "https://openrouter.ai/api/v1/chat/completions",
    keyEnv: "OPENROUTER_API_KEY",
    extraHeaders: {
      "HTTP-Referer": "https://aegis-bot.asuyhung.workers.dev",
      "X-Title": "Aegis Bot",
    },
  },
  cf: {
    type: "binding",
    binding: "AI", // env.AI dari wrangler.toml — FREE 10rb neurons/hari
  },
};

// Distribusi cerdas — pilih PROVIDER YANG PALING PATUH JSON-strict untuk tool calling,
// CF Workers AI Llama bukan untuk decision-making (sering ngarang/skip tool).
const MODELS = {
  // Brain orchestrator — Groq PRIMARY (paling cepat & reliable utk JSON).
  // Z.AI sering abort/lambat utk prompt grounding besar.
  senior: [
    "groq/llama-3.3-70b-versatile",                  // primary: ULTRA FAST (~1-2s), JSON-mode support
    "zai/glm-4.7-flash",                             // backup: long context kalau Groq rate-limit
    "groq/meta-llama/llama-4-scout-17b-16e-instruct",
    "openrouter/meta-llama/llama-3.3-70b-instruct:free",
  ],
  // Reasoning panjang (analisis, perencanaan)
  reason: [
    "groq/llama-3.3-70b-versatile",                  // primary: fast
    "zai/glm-4.7-flash",                             // backup
    "openrouter/deepseek/deepseek-r1:free",          // alt: deep reasoning
    "groq/meta-llama/llama-4-scout-17b-16e-instruct",
  ],
  // JSON output (distill, classification)
  analyze: [
    "groq/llama-3.3-70b-versatile",                  // primary: cepat, JSON-mode
    "zai/glm-4.7-flash",
    "openrouter/qwen/qwen-2.5-72b-instruct:free",
    "groq/meta-llama/llama-4-scout-17b-16e-instruct",
  ],
  // Klasifikasi cepat — text simple, CF Workers AI cocok di sini
  fast: [
    "groq/llama-3.1-8b-instant",                     // primary: super cepat
    "zai/glm-4.5-flash",
    "cf/@cf/meta/llama-3.1-8b-instruct",             // CF here OK (output simple)
  ],
};

const splitModel = (full) => {
  const slash = full.indexOf("/");
  return { provider: full.slice(0, slash), model: full.slice(slash + 1) };
};

const isRateLimit = (status, text) =>
  status === 429 || /rate.?limit|too many|quota/i.test(text || "");

// KV-backed rate-limit blacklist (60s TTL). Cegah panggil model yang baru kena 429.
const rlKey = (full) => `rl:${full}`;
const isBlacklisted = async (env, full) => {
  try { return !!(await env.AEGIS_KV.get(rlKey(full))); } catch { return false; }
};
const markBlacklisted = async (env, full) => {
  try { await env.AEGIS_KV.put(rlKey(full), "1", { expirationTtl: 60 }); } catch {}
};

// CF Workers AI: panggil via binding env.AI.run() — beda dari HTTP.
const callCfWorkersAI = async (env, model, { messages, prompt, temperature, max_tokens }) => {
  const input = {
    messages: messages || [{ role: "user", content: prompt }],
    temperature,
    max_tokens,
  };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const data = await env.AI.run(model, input);
    return { content: (data.response || data.result?.response || "").trim() };
  } finally { clearTimeout(timer); }
};

// HTTP provider (Groq/Z.AI/OpenRouter): OpenAI-compatible chat completions.
const callHttp = async (cfg, apiKey, body) => {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(cfg.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        ...(cfg.extraHeaders || {}),
      },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    return res;
  } finally { clearTimeout(timer); }
};

export const aiCall = async (env, role, { prompt, messages, temperature = 0.2, max_tokens = 400, json = false }) => {
  const list = MODELS[role] || MODELS.fast;
  let lastErr = "";

  for (const full of list) {
    const { provider, model } = splitModel(full);
    const cfg = PROVIDERS[provider];
    if (!cfg) { lastErr = `provider tidak dikenal: ${provider}`; continue; }

    // Skip kalau di blacklist (baru kena 429 < 60 detik lalu)
    if (await isBlacklisted(env, full)) {
      lastErr = `${full}: skipped (rate-limited recently)`;
      continue;
    }

    try {
      if (cfg.type === "binding") {
        // Cloudflare Workers AI
        if (!env[cfg.binding]) { lastErr = `binding ${cfg.binding} kosong`; continue; }
        const { content } = await callCfWorkersAI(env, model, { messages, prompt, temperature, max_tokens });
        if (content) return { content, model: full };
        lastErr = `${full}: empty response`;
        continue;
      }

      // HTTP provider
      const apiKey = env[cfg.keyEnv];
      if (!apiKey) { lastErr = `key kosong: ${cfg.keyEnv}`; continue; }
      const body = {
        model,
        messages: messages || [{ role: "user", content: prompt }],
        temperature,
        max_tokens,
        ...(json ? { response_format: { type: "json_object" } } : {}),
      };
      const res = await callHttp(cfg, apiKey, body);
      if (res.ok) {
        const data = await res.json();
        return {
          content: data.choices?.[0]?.message?.content?.trim() || "",
          model: full,
          usage: data.usage,
        };
      }
      const errText = await res.text();
      lastErr = `${full}: ${res.status} ${errText.slice(0, 200)}`;
      if (isRateLimit(res.status, errText)) {
        await markBlacklisted(env, full);
        console.warn(`[ai] ${role}/${full} → 429, blacklist 60s`);
        continue;
      }
      // Non-rate-limit error — skip ke model berikutnya tapi jangan blacklist
      console.warn(`[ai] ${role}/${full} → ${res.status}, skip`);
    } catch (err) {
      lastErr = `${full}: ${err.message}`;
      // Timeout / network error → skip, jangan blacklist (sementara saja)
      console.warn(`[ai] ${role}/${full} → exception: ${err.message?.slice(0, 100)}`);
    }
  }
  throw new Error(`No model available for ${role}: ${lastErr}`);
};

export const safeJSON = (raw, fallback = {}) => {
  try { return JSON.parse(raw); } catch { return fallback; }
};

export const stripFences = (s) =>
  (s || "").replace(/```(?:json)?\s*([\s\S]*?)\s*```/g, "$1").trim();

export const parseFirstJSON = (raw) => {
  if (!raw) return null;
  const s = stripFences(raw);
  try { return JSON.parse(s); } catch {}
  const m = s.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch {} }
  return null;
};
