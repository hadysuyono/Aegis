// Aegis Worker — Cloudflare Workers entry (webhook + cron dispatcher).

import { handleMessage } from "./lib/brain.js";
import { sendMessage, answerCallback, editMessageReplyMarkup, getFileLink, fbKeyboard } from "./lib/telegram.js";
import { resetState } from "./lib/state.js";
import { listActive, removeReminder, dueReminders, markNotified } from "./lib/reminders.js";
import { writeJSON, readJSON } from "./lib/store.js";
import { distill, distillText } from "./lib/distill.js";
import { generateMorningBrief, generateEveningRecap } from "./lib/briefings.js";
import { detectAnomalies } from "./lib/anomaly.js";
import { dailySnapshot } from "./lib/backup.js";
import { syncKnowledge } from "./lib/knowledge-sync.js";
import { weeklyReflect } from "./lib/reflect.js";
import { generateClaudeMdSuggestion, generateFeedbackDigest } from "./lib/self-update.js";
import { aiCall } from "./lib/ai.js";
import { nowJakarta, formatFriendly } from "./lib/time.js";

const isOwner = (env, from) => String(from?.id) === String(env.TELEGRAM_CHAT_ID);

// === Command handlers ===
const COMMANDS = {
  start: async (env, msg) =>
    sendMessage(env, msg.chat.id,
      "✅ Aegis aktif (Cloudflare Workers, gratis selamanya).\n\n" +
      "Chat saja apa pun — saya paham konteksnya.\n\n" +
      "Command:\n" +
      "/list — reminder aktif\n" +
      "/hapus <id> — hapus reminder\n" +
      "/distill — proses inbox\n" +
      "/sync_knowledge — sync 01-KNOWLEDGE\n" +
      "/brief — morning brief\n" +
      "/recap — evening recap\n" +
      "/anomaly — scan anomali\n" +
      "/backup — snapshot manual\n" +
      "/refleksi — refleksi mingguan\n" +
      "/tune — saran self-tuning\n" +
      "/cari <topik> — scout web\n" +
      "/reset — bersih ingatan chat\n" +
      "/ping"),

  ping: (env, msg) => sendMessage(env, msg.chat.id, "pong"),

  reset: async (env, msg) => {
    await resetState(env, msg.chat.id);
    return sendMessage(env, msg.chat.id, "🧹 Memori chat dibersihkan.");
  },

  list: async (env, msg) => {
    const items = await listActive(env);
    if (items.length === 0) return sendMessage(env, msg.chat.id, "📭 Tidak ada reminder aktif.");
    const lines = items.map((r, i) => `${i + 1}. 📝 ${r.event}\n   📅 ${formatFriendly(r.datetime_iso)}\n   🔖 ${r.id}`);
    return sendMessage(env, msg.chat.id, `📋 Reminder aktif (${items.length}):\n\n${lines.join("\n\n")}`);
  },

  hapus: async (env, msg, args) => {
    const id = args.trim();
    if (!id) return sendMessage(env, msg.chat.id, "Format: /hapus <id>");
    const ok = await removeReminder(env, id);
    return sendMessage(env, msg.chat.id, ok ? `🗑️ ${id} dihapus.` : `❌ ${id} tidak ditemukan.`);
  },

  distill: async (env, msg) => {
    await sendMessage(env, msg.chat.id, "🧠 Distill jalan...");
    try {
      const res = await distill(env);
      if (res.processed === 0) return sendMessage(env, msg.chat.id, "📭 Inbox kosong.");
      const t = res.totals;
      return sendMessage(env, msg.chat.id,
        `✅ Distill ${res.processed} catatan.\n👤 +${t.people} • 📦 +${t.projects} • 📅 +${t.events} • ⚖️ +${t.decisions} • 💡 +${t.beliefs}\n🗄️ ${res.archived.length} dipindah arsip.`);
    } catch (err) { return sendMessage(env, msg.chat.id, `❌ ${err.message}`); }
  },

  sync_knowledge: async (env, msg) => {
    await sendMessage(env, msg.chat.id, "📚 Sync knowledge...");
    try {
      const res = await syncKnowledge(env);
      return sendMessage(env, msg.chat.id, `✅ ${res.files} file ter-update di 01-KNOWLEDGE/`);
    } catch (err) { return sendMessage(env, msg.chat.id, `❌ ${err.message}`); }
  },

  brief: async (env, msg) => {
    await sendMessage(env, msg.chat.id, "🌅 Bikin morning brief...");
    try {
      const b = await generateMorningBrief(env);
      return sendMessage(env, msg.chat.id, b, { parse_mode: "Markdown", ...fbKeyboard("morning") });
    } catch (err) { return sendMessage(env, msg.chat.id, `❌ ${err.message}`); }
  },

  recap: async (env, msg) => {
    await sendMessage(env, msg.chat.id, "🌙 Bikin evening recap...");
    try {
      const r = await generateEveningRecap(env);
      return sendMessage(env, msg.chat.id, r, { parse_mode: "Markdown", ...fbKeyboard("evening") });
    } catch (err) { return sendMessage(env, msg.chat.id, `❌ ${err.message}`); }
  },

  anomaly: async (env, msg) => {
    await sendMessage(env, msg.chat.id, "🔍 Scan anomali...");
    try {
      const res = await detectAnomalies(env);
      if (!res.hasAnomaly) return sendMessage(env, msg.chat.id, "✅ Bersih, tidak ada anomali.");
      return sendMessage(env, msg.chat.id, res.message, fbKeyboard("anomaly"));
    } catch (err) { return sendMessage(env, msg.chat.id, `❌ ${err.message}`); }
  },

  backup: async (env, msg) => {
    await sendMessage(env, msg.chat.id, "💾 Snapshot...");
    try {
      const res = await dailySnapshot(env);
      return sendMessage(env, msg.chat.id, `✅ Snapshot ${res.date}: ${res.count} file di 06-ARCHIVE/backup/${res.date}/`);
    } catch (err) { return sendMessage(env, msg.chat.id, `❌ ${err.message}`); }
  },

  refleksi: async (env, msg) => {
    await sendMessage(env, msg.chat.id, "🪞 Bikin refleksi minggu ini...");
    try {
      const res = await weeklyReflect(env);
      if (res.skipped) return sendMessage(env, msg.chat.id, `📭 ${res.reason}`);
      return sendMessage(env, msg.chat.id, `📝 Refleksi → ${res.path}\n\n${res.snippet}`);
    } catch (err) { return sendMessage(env, msg.chat.id, `❌ ${err.message}`); }
  },

  tune: async (env, msg) => {
    await sendMessage(env, msg.chat.id, "🔧 Bikin saran self-tuning...");
    try {
      const [c, f] = await Promise.all([generateClaudeMdSuggestion(env), generateFeedbackDigest(env)]);
      let m = `📝 CLAUDE.md saran → ${c.path}\n\n${c.snippet}`;
      if (!f.skipped) m += `\n\n---\n\n📊 Feedback Digest → ${f.path}\n\n${f.snippet}`;
      return sendMessage(env, msg.chat.id, m);
    } catch (err) { return sendMessage(env, msg.chat.id, `❌ ${err.message}`); }
  },

  cari: async (env, msg, args) => {
    const q = args.trim();
    if (!q) return sendMessage(env, msg.chat.id, "Format: /cari <pertanyaan>");
    await sendMessage(env, msg.chat.id, "🔎 Scout web...");
    try {
      const prompt = `Kamu Aegis. Hady minta info: "${q}". Pakai web search internalmu, jawab bahasa Indonesia sopan (panggil "Pak"), maks 5 kalimat.`;
      const { content } = await aiCall(env, "senior", { prompt, temperature: 0.3, max_tokens: 500 });
      return sendMessage(env, msg.chat.id, content || "Maaf Pak, tidak dapat hasil.", fbKeyboard("scout"));
    } catch (err) { return sendMessage(env, msg.chat.id, `❌ ${err.message}`); }
  },
};

// === Message handlers ===
const handleText = async (env, msg) => {
  const text = msg.text.trim();
  if (!text) return;
  const reply = await handleMessage(env, msg.chat.id, text);
  return sendMessage(env, msg.chat.id, reply, fbKeyboard("brain"));
};

const handleVoice = async (env, msg) => {
  await sendMessage(env, msg.chat.id, "🎙️ Transkrip suara...");
  try {
    const fileLink = await getFileLink(env, msg.voice.file_id);
    const audioRes = await fetch(fileLink);
    if (!audioRes.ok) throw new Error(`audio fetch ${audioRes.status}`);
    const audioBuf = await audioRes.arrayBuffer();
    const fd = new FormData();
    fd.append("file", new Blob([audioBuf], { type: "audio/ogg" }), "voice.ogg");
    fd.append("model", "whisper-large-v3");
    fd.append("language", "id");
    const trRes = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.GROQ_API_KEY}` },
      body: fd,
    });
    if (!trRes.ok) throw new Error(`whisper ${trRes.status}`);
    const { text } = await trRes.json();
    if (!text || text.trim().length < 2) return sendMessage(env, msg.chat.id, "🤷 Tidak terdengar.");
    await sendMessage(env, msg.chat.id, `🎙️ _"${text}"_`, { parse_mode: "Markdown" });
    const reply = await handleMessage(env, msg.chat.id, text);
    return sendMessage(env, msg.chat.id, reply, fbKeyboard("brain"));
  } catch (err) {
    return sendMessage(env, msg.chat.id, `❌ Gagal transkrip: ${err.message}`);
  }
};

const handlePhoto = async (env, msg) => {
  await sendMessage(env, msg.chat.id, "🖼️ Lihat gambar...");
  try {
    // Telegram kirim array foto resolusi berbeda; ambil yg terbesar
    const photo = msg.photo[msg.photo.length - 1];
    const fileLink = await getFileLink(env, photo.file_id);
    const caption = msg.caption?.trim() || "Apa yang Bapak ingin saya jelaskan dari gambar ini?";

    // Panggil GLM-4.6V via Z.AI (FREE)
    const res = await fetch("https://api.z.ai/api/paas/v4/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.ZAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "glm-4.6v-flash",
        messages: [{
          role: "user",
          content: [
            { type: "image_url", image_url: { url: fileLink } },
            { type: "text", text: `Kamu Aegis, asisten Pak Hady. Beliau kirim gambar ini dengan pertanyaan: "${caption}". Jawab dengan bahasa Indonesia sopan, panggil "Pak", 2-4 kalimat.` },
          ],
        }],
        temperature: 0.3,
        max_tokens: 600,
      }),
    });
    if (!res.ok) throw new Error(`vision ${res.status}`);
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content?.trim() || "Maaf Pak, gambarnya tidak terbaca jelas.";
    return sendMessage(env, msg.chat.id, text, fbKeyboard("vision"));
  } catch (err) {
    return sendMessage(env, msg.chat.id, `❌ Gagal analisa gambar: ${err.message}`);
  }
};

const handleVideo = async (env, msg) => {
  await sendMessage(env, msg.chat.id, "🎥 Analisa video (thumbnail + suara)...");
  try {
    const video = msg.video || msg.video_note || msg.animation;
    const thumb = video.thumbnail || video.thumb;
    const caption = msg.caption?.trim() || "";

    // 1. Vision: analisa thumbnail
    let visual = "(tidak ada thumbnail)";
    if (thumb?.file_id) {
      const thumbLink = await getFileLink(env, thumb.file_id);
      const visionRes = await fetch("https://api.z.ai/api/paas/v4/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${env.ZAI_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "glm-4.6v-flash",
          messages: [{
            role: "user",
            content: [
              { type: "image_url", image_url: { url: thumbLink } },
              { type: "text", text: "Deskripsikan adegan utama dalam thumbnail video ini (objek, orang, setting). Singkat 2-3 kalimat." },
            ],
          }],
          temperature: 0.3, max_tokens: 400,
        }),
      });
      if (visionRes.ok) {
        const v = await visionRes.json();
        visual = v.choices?.[0]?.message?.content || visual;
      }
    }

    // 2. Audio: transkrip suara (kalau ada)
    let audio = "(tidak ada audio jelas)";
    try {
      const videoLink = await getFileLink(env, video.file_id);
      const videoRes = await fetch(videoLink);
      if (videoRes.ok) {
        const videoBuf = await videoRes.arrayBuffer();
        // Max 25 MB Whisper limit
        if (videoBuf.byteLength <= 25 * 1024 * 1024) {
          const fd = new FormData();
          fd.append("file", new Blob([videoBuf], { type: video.mime_type || "video/mp4" }), "video.mp4");
          fd.append("model", "whisper-large-v3");
          fd.append("language", "id");
          const trRes = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
            method: "POST",
            headers: { Authorization: `Bearer ${env.GROQ_API_KEY}` },
            body: fd,
          });
          if (trRes.ok) {
            const { text } = await trRes.json();
            if (text?.trim()) audio = text.trim();
          }
        }
      }
    } catch (e) { console.warn("[video audio]", e.message); }

    // 3. Combine via reasoning
    const today = nowJakarta();
    const synthPrompt = `Kamu Aegis. Pak Hady kirim video${caption ? ` dengan caption: "${caption}"` : ""}.

Visual (dari thumbnail): ${visual}
Audio (transkrip): ${audio}

Hari ini ${today.iso}. Jawab Pak Hady sopan, 3-4 kalimat, sebutkan apa yang kamu paham dari video — visual & suara. Kalau Pak Hady kasih caption pertanyaan, jawab itu.`;
    const { content } = await aiCall(env, "reason", { prompt: synthPrompt, temperature: 0.3, max_tokens: 600 });
    return sendMessage(env, msg.chat.id, content, fbKeyboard("video"));
  } catch (err) {
    return sendMessage(env, msg.chat.id, `❌ Gagal analisa video: ${err.message}`);
  }
};

const handleCallback = async (env, cb) => {
  const data = cb.data || "";
  if (!data.startsWith("fb:")) return;
  const [, rating, source] = data.split(":");
  try {
    const fbDoc = await readJSON(env, "07-SYSTEM/feedback.json", { items: [] });
    fbDoc.items.push({ ts: nowJakarta().iso, message_id: cb.message.message_id, rating, source });
    await writeJSON(env, "07-SYSTEM/feedback.json", fbDoc, `feedback: ${rating} on ${source}`);
    await answerCallback(env, cb.id, rating === "up" ? "Makasih, Pak 👍" : "Catat, saya perbaiki.");
    await editMessageReplyMarkup(env, cb.message.chat.id, cb.message.message_id, { inline_keyboard: [] });
  } catch (err) {
    await answerCallback(env, cb.id, "Gagal catat.");
  }
};

// === Cron dispatcher (1 cron tiap 10 menit, internal dispatch per slot) ===
const cronReminderDispatch = async (env) => {
  const due = await dueReminders(env);
  if (due.length === 0) return;
  const ids = [];
  for (const r of due) {
    await sendMessage(env, env.TELEGRAM_CHAT_ID,
      `🔔 *Pengingat*\n📝 ${r.event}\n📅 ${formatFriendly(r.datetime_iso)}\n\n_Pesan asli:_\n${r.source}`,
      { parse_mode: "Markdown" });
    ids.push(r.id);
  }
  await markNotified(env, ids);
};

const FIRED_KEY = "cron:fired";
const wasFired = async (env, key) => (await env.AEGIS_KV.get(`${FIRED_KEY}:${key}`)) === "1";
const markFired = (env, key, ttl = 60 * 60 * 23) => env.AEGIS_KV.put(`${FIRED_KEY}:${key}`, "1", { expirationTtl: ttl });

const runDailyJobs = async (env) => {
  const n = nowJakarta();
  const hh = n.iso.slice(11, 13);
  const mm = n.iso.slice(14, 16);
  const slot = `${n.date}-${hh}${mm}`;

  // 03:00 WIB - Backup
  if (hh === "03" && mm === "00" && !(await wasFired(env, `backup-${n.date}`))) {
    await dailySnapshot(env).catch(e => console.error("backup:", e.message));
    await markFired(env, `backup-${n.date}`);
  }
  // 06:00 WIB - Morning brief
  if (hh === "06" && mm === "00" && !(await wasFired(env, `brief-${n.date}`))) {
    const b = await generateMorningBrief(env).catch(e => `Brief error: ${e.message}`);
    await sendMessage(env, env.TELEGRAM_CHAT_ID, b, { parse_mode: "Markdown", ...fbKeyboard("morning") });
    await markFired(env, `brief-${n.date}`);
  }
  // 12:00 WIB - Anomaly scan
  if (hh === "12" && mm === "00" && !(await wasFired(env, `anomaly-${n.date}`))) {
    const res = await detectAnomalies(env).catch(() => ({ hasAnomaly: false }));
    if (res.hasAnomaly) await sendMessage(env, env.TELEGRAM_CHAT_ID, res.message, fbKeyboard("anomaly"));
    await markFired(env, `anomaly-${n.date}`);
  }
  // 21:00 WIB - Evening recap
  if (hh === "21" && mm === "00" && !(await wasFired(env, `recap-${n.date}`))) {
    const r = await generateEveningRecap(env).catch(e => `Recap error: ${e.message}`);
    await sendMessage(env, env.TELEGRAM_CHAT_ID, r, { parse_mode: "Markdown", ...fbKeyboard("evening") });
    await markFired(env, `recap-${n.date}`);
  }
  // 23:00 WIB - Distill + sync knowledge
  if (hh === "23" && mm === "00" && !(await wasFired(env, `distill-${n.date}`))) {
    const res = await distill(env).catch(e => ({ processed: 0, totals: {}, archived: [], error: e.message }));
    if (res.processed > 0) {
      const t = res.totals;
      await sendMessage(env, env.TELEGRAM_CHAT_ID,
        `🌙 Distill malam: ${res.processed} catatan.\n👤 +${t.people || 0} • 📦 +${t.projects || 0} • 📅 +${t.events || 0}`);
    }
    await syncKnowledge(env).catch(e => console.error("knowledge sync:", e.message));
    await markFired(env, `distill-${n.date}`);
  }
  // Sunday 19:00 WIB - Weekly reflect
  const dow = new Date(n.isoOffset).getUTCDay() === 0 ? 0 : new Date(n.isoOffset).getDay(); // 0 = Sunday
  if (dow === 0 && hh === "19" && mm === "00" && !(await wasFired(env, `reflect-${n.date}`))) {
    const res = await weeklyReflect(env).catch(e => ({ skipped: true, reason: e.message }));
    if (!res.skipped) await sendMessage(env, env.TELEGRAM_CHAT_ID, `🪞 Refleksi ${res.week}\n\n${res.snippet}`, fbKeyboard("reflect"));
    await markFired(env, `reflect-${n.date}`);
  }
  // Sunday 20:00 WIB - Self-tune
  if (dow === 0 && hh === "20" && mm === "00" && !(await wasFired(env, `tune-${n.date}`))) {
    try {
      const [c, f] = await Promise.all([generateClaudeMdSuggestion(env), generateFeedbackDigest(env)]);
      await sendMessage(env, env.TELEGRAM_CHAT_ID, `🔧 Self-tune ${n.date}\nCLAUDE.md saran → ${c.path}\nFeedback digest → ${f.skipped ? "(skip)" : f.path}`);
    } catch (err) { console.error("tune:", err.message); }
    await markFired(env, `tune-${n.date}`);
  }
};

// === Worker entry ===
export default {
  async fetch(req, env, ctx) {
    if (req.method !== "POST") return new Response("Aegis Worker alive", { status: 200 });
    let update;
    try { update = await req.json(); } catch { return new Response("bad json", { status: 400 }); }

    ctx.waitUntil((async () => {
      try {
        if (update.callback_query) {
          if (!isOwner(env, update.callback_query.from)) return;
          await handleCallback(env, update.callback_query);
          return;
        }
        const msg = update.message;
        if (!msg || !isOwner(env, msg.from)) return;

        if (msg.text?.startsWith("/")) {
          const [cmdRaw, ...rest] = msg.text.slice(1).split(/\s+/);
          const cmd = cmdRaw.toLowerCase().split("@")[0]; // strip @botname
          const args = rest.join(" ");
          const handler = COMMANDS[cmd];
          if (handler) { await handler(env, msg, args); return; }
        }
        if (msg.text) return handleText(env, msg);
        if (msg.voice) return handleVoice(env, msg);
        if (msg.photo) return handlePhoto(env, msg);
        if (msg.video || msg.video_note || msg.animation) return handleVideo(env, msg);
      } catch (err) {
        console.error("[handler]", err);
        try { await sendMessage(env, env.TELEGRAM_CHAT_ID, `❌ Error: ${err.message?.slice(0, 200)}`); } catch {}
      }
    })());

    return new Response("ok", { status: 200 });
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil((async () => {
      try {
        await cronReminderDispatch(env);
        await runDailyJobs(env);
      } catch (err) { console.error("[scheduled]", err); }
    })());
  },
};
