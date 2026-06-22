// AI router — Groq via fetch (no SDK biar ringan & kompatible Workers).

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

const MODELS = {
  senior: ["groq/compound", "groq/compound-mini"],
  reason: ["openai/gpt-oss-120b", "llama-3.3-70b-versatile", "meta-llama/llama-4-scout-17b-16e-instruct"],
  analyze: ["llama-3.3-70b-versatile", "meta-llama/llama-4-scout-17b-16e-instruct", "qwen/qwen3-32b"],
  fast: ["llama-3.1-8b-instant", "qwen/qwen3-32b"],
};

const isRateLimit = (status, text) =>
  status === 429 || /rate.?limit|too many|quota/i.test(text || "");

export const aiCall = async (env, role, { prompt, messages, temperature = 0.2, max_tokens = 400, json = false }) => {
  const list = MODELS[role] || MODELS.fast;
  let lastErr = "";
  for (const model of list) {
    try {
      const body = {
        model,
        messages: messages || [{ role: "user", content: prompt }],
        temperature,
        max_tokens,
        ...(json ? { response_format: { type: "json_object" } } : {}),
      };
      const res = await fetch(GROQ_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const data = await res.json();
        return {
          content: data.choices?.[0]?.message?.content?.trim() || "",
          model,
          usage: data.usage,
        };
      }
      const errText = await res.text();
      lastErr = `${res.status} ${errText}`;
      if (!isRateLimit(res.status, errText)) throw new Error(lastErr);
      console.warn(`[ai] ${role}/${model} rate-limit → fallback`);
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
