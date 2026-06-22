// Aegis AI router — multi-model, bagi tugas seperti otak manusia.
// Tiap fungsi punya peran spesifik + fallback chain kalau model rate-limit.

import Groq from "groq-sdk";
import { trackUsage } from "./usage.js";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Peta peran → model utama + fallback. Compound RPD 250 — HEMAT untuk chat utama saja.
const MODELS = {
  // CEO: chat utama Hady (compound). RPD 250 = ~250 reply per hari, cukup untuk dialog.
  senior: ["groq/compound", "groq/compound-mini", "openai/gpt-oss-120b", "llama-3.3-70b-versatile"],
  // Reasoning (briefings, anomaly, recall, self-tuning) — pakai gpt-oss-120b, hindari compound
  reason: ["openai/gpt-oss-120b", "llama-3.3-70b-versatile", "meta-llama/llama-4-scout-17b-16e-instruct"],
  // Analyst: ekstrak entitas, distill. JSON output — compound diskip.
  analyze: ["llama-3.3-70b-versatile", "meta-llama/llama-4-scout-17b-16e-instruct", "qwen/qwen3-32b", "openai/gpt-oss-120b"],
  // Junior / reflex: klasifikasi cepat (volume tinggi)
  fast: ["llama-3.1-8b-instant", "qwen/qwen3-32b", "llama-3.3-70b-versatile"],
};

const isRateLimit = (err) =>
  err?.status === 429 ||
  /rate.?limit|too many|quota/i.test(err?.message || "");

// Coba model satu per satu — kalau rate-limit, loncat ke fallback
const callWithFallback = async (role, params) => {
  const list = MODELS[role] || MODELS.fast;
  let lastErr;
  for (const model of list) {
    try {
      const res = await groq.chat.completions.create({ ...params, model });
      trackUsage({
        role, model,
        prompt_tokens: res.usage?.prompt_tokens || 0,
        completion_tokens: res.usage?.completion_tokens || 0,
      }).catch(() => {});
      return { content: res.choices[0]?.message?.content?.trim() || "", model };
    } catch (err) {
      lastErr = err;
      if (!isRateLimit(err)) throw err; // error lain → langsung throw
      console.warn(`AI ${role}: ${model} rate-limit, fallback...`);
    }
  }
  throw lastErr || new Error(`No model available for role ${role}`);
};

export const aiCall = (role, { prompt, messages, temperature = 0.2, max_tokens = 400, json = false }) =>
  callWithFallback(role, {
    messages: messages || [{ role: "user", content: prompt }],
    temperature,
    max_tokens,
    ...(json ? { response_format: { type: "json_object" } } : {}),
  });

export const safeJSON = (raw, fallback = {}) => {
  try { return JSON.parse(raw); } catch { return fallback; }
};
