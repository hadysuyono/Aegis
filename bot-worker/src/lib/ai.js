// AI router — multi-provider (Groq + Z.AI) via fetch.
// Format model entry: "groq/<id>" atau "zai/<id>".

const PROVIDERS = {
  groq: {
    url: "https://api.groq.com/openai/v1/chat/completions",
    keyEnv: "GROQ_API_KEY",
  },
  zai: {
    url: "https://api.z.ai/api/paas/v4/chat/completions",
    keyEnv: "ZAI_API_KEY",
  },
  openrouter: {
    url: "https://openrouter.ai/api/v1/chat/completions",
    keyEnv: "OPENROUTER_API_KEY",
    extraHeaders: {
      "HTTP-Referer": "https://aegis-bot.asuyhung.workers.dev",
      "X-Title": "Aegis Bot",
    },
  },
};

const MODELS = {
  // Chat brain — Z.AI GLM Flash (FREE) primary, llama-70b backup (NO compound, sering 413)
  // BRAIN ORCHESTRATOR — Z.AI Flash primary, OpenRouter free fallback
  senior: [
    "zai/glm-4.7-flash",
    "zai/glm-4.5-flash",
    "openrouter/meta-llama/llama-3.3-70b-instruct:free",
    "openrouter/qwen/qwen-2.5-72b-instruct:free",
  ],
  // REASONER — Z.AI Flash primary, OpenRouter free fallback
  reason: [
    "zai/glm-4.7-flash",
    "zai/glm-4.5-flash",
    "openrouter/deepseek/deepseek-r1:free",
    "openrouter/meta-llama/llama-3.3-70b-instruct:free",
  ],
  // Distill (JSON output)
  analyze: [
    "groq/llama-3.3-70b-versatile",
    "groq/meta-llama/llama-4-scout-17b-16e-instruct",
    "zai/glm-4.7-flash",        // FREE forever, support JSON
    "groq/qwen/qwen3-32b",
  ],
  // Klasifikasi cepat
  fast: [
    "groq/llama-3.1-8b-instant",
    "zai/glm-4.5-flash",        // FREE forever
    "groq/qwen/qwen3-32b",
  ],
};

const splitModel = (full) => {
  const slash = full.indexOf("/");
  return { provider: full.slice(0, slash), model: full.slice(slash + 1) };
};

const isRateLimit = (status, text) =>
  status === 429 || /rate.?limit|too many|quota/i.test(text || "");

export const aiCall = async (env, role, { prompt, messages, temperature = 0.2, max_tokens = 400, json = false }) => {
  const list = MODELS[role] || MODELS.fast;
  let lastErr = "";
  for (const full of list) {
    const { provider, model } = splitModel(full);
    const cfg = PROVIDERS[provider];
    if (!cfg) { lastErr = `provider tidak dikenal: ${provider}`; continue; }
    const apiKey = env[cfg.keyEnv];
    if (!apiKey) { lastErr = `key kosong: ${cfg.keyEnv}`; continue; }
    try {
      const body = {
        model,
        messages: messages || [{ role: "user", content: prompt }],
        temperature,
        max_tokens,
        ...(json ? { response_format: { type: "json_object" } } : {}),
      };
      const res = await fetch(cfg.url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          ...(cfg.extraHeaders || {}),
        },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const data = await res.json();
        return {
          content: data.choices?.[0]?.message?.content?.trim() || "",
          model: full,
          usage: data.usage,
        };
      }
      const errText = await res.text();
      lastErr = `${full}: ${res.status} ${errText}`;
      if (!isRateLimit(res.status, errText)) throw new Error(lastErr);
      console.warn(`[ai] ${role}/${full} rate-limit → fallback`);
    } catch (err) {
      lastErr = err.message;
      if (!/rate|429|quota/i.test(err.message)) throw err;
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
