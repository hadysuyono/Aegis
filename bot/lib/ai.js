// Aegis AI router — multi-model, bagi tugas seperti otak manusia.
// Tiap fungsi punya peran spesifik + fallback chain kalau model rate-limit.

import Groq from "groq-sdk";
import { trackUsage, getUsageToday } from "./usage.js";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Quota notification callback (di-set dari index.js)
let onAlert = null;
export const setAlertHandler = (fn) => { onAlert = fn; };

// Limit Groq compound (CEO): RPD 250 per hari (reset UTC midnight = 07:00 WIB)
const COMPOUND_LIMIT = 250;
const ALERT_THRESHOLDS = [200, 230, 245]; // 80%, 92%, 98%
const alertedToday = new Set();

const nextResetWIB = () => {
  const now = new Date();
  const utcMidnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  const wibReset = new Date(utcMidnight.getTime() + 7 * 3600_000);
  const diffMin = Math.round((utcMidnight - now) / 60_000);
  const hours = Math.floor(diffMin / 60);
  const mins = diffMin % 60;
  const resetStr = wibReset.toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit", day: "numeric", month: "short",
  });
  return { resetStr, hours, mins };
};

const checkCompoundQuota = async () => {
  try {
    const today = await getUsageToday();
    const calls = today?.senior?.by_model?.["groq/compound"] || 0;
    for (const t of ALERT_THRESHOLDS) {
      if (calls >= t && !alertedToday.has(t)) {
        alertedToday.add(t);
        const sisa = COMPOUND_LIMIT - calls;
        const { resetStr, hours, mins } = nextResetWIB();
        if (onAlert) onAlert(`⚠️ Compound ${calls}/${COMPOUND_LIMIT} hari ini. Sisa ${sisa} panggilan.\n🕐 Reset: ${resetStr} WIB (${hours}j ${mins}m lagi)`);
      }
    }
  } catch (e) { console.warn("[quota check]", e.message); }
};

// Peta peran → model utama + fallback. Compound TPD unlimited — buat chat utama saja.
const MODELS = {
  // CEO: chat utama Hady (TPD unlimited compound). RPD 250+250=500 total per hari.
  senior: ["groq/compound", "groq/compound-mini"],
  // Reasoning (briefings, anomaly, recall, self-tuning, refleksi)
  reason: ["openai/gpt-oss-120b", "llama-3.3-70b-versatile", "meta-llama/llama-4-scout-17b-16e-instruct"],
  // Analyst: ekstrak entitas, distill (JSON output)
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
      if (model === "groq/compound") checkCompoundQuota().catch(() => {});
      return { content: res.choices[0]?.message?.content?.trim() || "", model };
    } catch (err) {
      lastErr = err;
      if (!isRateLimit(err)) throw err; // error lain → langsung throw
      console.warn(`AI ${role}: ${model} rate-limit, fallback...`);
      if (model === "groq/compound" && onAlert) {
        const { resetStr, hours, mins } = nextResetWIB();
        onAlert(`🚫 Compound *limit habis*. Aegis pindah ke fallback.\n🕐 Reset: ${resetStr} WIB (${hours}j ${mins}m lagi)`);
      }
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
