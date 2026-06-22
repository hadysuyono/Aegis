// Aegis Worker — entry point Cloudflare Workers
// Webhook Telegram + Cron Triggers (semua scheduled jobs)

import { handleMessage, } from "./lib/brain.js";
import { sendMessage, answerCallback, editMessageReplyMarkup, getFileLink, fbKeyboard } from "./lib/telegram.js";
import { resetState } from "./lib/state.js";
import { listActive, removeReminder, dueReminders, markNotified } from "./lib/reminders.js";
import { writeJSON, readJSON, writeFile, listFolder } from "./lib/store.js";
import { nowJakarta, formatFriendly } from "./lib/time.js";
import { aiCall } from "./lib/ai.js";

// === Helpers ===
const isOwner = (env, from) => String(from?.id) === String(env.TELEGRAM_CHAT_ID);

const handleCommand = async (env, msg, cmd, args) => {
  const chatId = msg.chat.id;
  switch (cmd) {
    case "start":
      return sendMessage(env, chatId,
        "✅ Aegis aktif. Chat saya apa pun — saya pahami konteksnya.\n\n" +
        "Command:\n/list — reminder aktif\n/hapus <id> — hapus reminder\n" +
        "/reset — bersihkan ingatan chat\n/ping — cek hidup");
    case "ping":
      return sendMessage(env, chatId, "pong");
    case "reset":
      await resetState(env, chatId);
      return sendMessage(env, chatId, "🧹 Memori chat dibersihkan.");
    case "list": {
      const items = await listActive(env);
      if (items.length === 0) return sendMessage(env, chatId, "📭 Tidak ada reminder aktif.");
      const lines = items.map((r, i) => `${i + 1}. 📝 ${r.event}\n   📅 ${formatFriendly(r.datetime_iso)}\n   🔖 ${r.id}`);
      return sendMessage(env, chatId, `📋 Reminder aktif (${items.length}):\n\n${lines.join("\n\n")}`);
    }
    case "hapus": {
      const id = args.trim();
      if (!id) return sendMessage(env, chatId, "Format: /hapus <id>");
      const ok = await removeReminder(env, id);
      return sendMessage(env, chatId, ok ? `🗑️ ${id} dihapus.` : `❌ ${id} tidak ditemukan.`);
    }
    default:
      return null;
  }
};

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
    if (!trRes.ok) throw new Error(`whisper ${trRes.status}: ${await trRes.text()}`);
    const { text } = await trRes.json();
    if (!text || text.trim().length < 2) return sendMessage(env, msg.chat.id, "🤷 Tidak terdengar.");
    await sendMessage(env, msg.chat.id, `🎙️ _"${text}"_`, { parse_mode: "Markdown" });
    const reply = await handleMessage(env, msg.chat.id, text);
    return sendMessage(env, msg.chat.id, reply, fbKeyboard("brain"));
  } catch (err) {
    return sendMessage(env, msg.chat.id, `❌ Gagal transkrip: ${err.message}`);
  }
};

const handleCallback = async (env, cb) => {
  const data = cb.data || "";
  if (data.startsWith("fb:")) {
    const [, rating, source] = data.split(":");
    try {
      const fbDoc = await readJSON(env, "07-SYSTEM/feedback.json", { items: [] });
      fbDoc.items.push({
        ts: nowJakarta().iso,
        message_id: cb.message.message_id,
        rating, source,
      });
      await writeJSON(env, "07-SYSTEM/feedback.json", fbDoc, `feedback: ${rating} on ${source}`);
      await answerCallback(env, cb.id, rating === "up" ? "Makasih, Pak 👍" : "Catat, saya perbaiki.");
      await editMessageReplyMarkup(env, cb.message.chat.id, cb.message.message_id, { inline_keyboard: [] });
    } catch (err) {
      await answerCallback(env, cb.id, "Gagal catat.");
    }
  }
};

// === Cron handlers ===
const cronReminders = async (env) => {
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

const cronMorningBrief = async (env) => {
  const today = nowJakarta();
  const reminders = await listActive(env);
  const startUtc = new Date(Date.UTC(...today.date.split("-").map((x, i) => i === 1 ? +x - 1 : +x), -7, 0)).toISOString();
  const endUtc = new Date(Date.UTC(...today.date.split("-").map((x, i) => i === 1 ? +x - 1 : +x), 16, 59)).toISOString();
  const todayReminders = reminders.filter(r => r.datetime_iso >= startUtc && r.datetime_iso <= endUtc);

  const prompt = `Kamu Aegis. Hari ini ${today.iso}. Tulis MORNING BRIEF singkat untuk Pak Hady.

Jadwal hari ini:
${todayReminders.length ? todayReminders.map(r => `- ${r.event} — ${formatFriendly(r.datetime_iso)}`).join("\n") : "(kosong)"}

Format Markdown, max 200 kata: ## 🌅 Pagi, Pak Hady (sapaan singkat), ## 🎯 The One Thing, ## 📅 Hari Ini. Kalau jadwal kosong, kasih tahu santai.`;
  const { content } = await aiCall(env, "reason", { prompt, temperature: 0.3, max_tokens: 500 });
  await sendMessage(env, env.TELEGRAM_CHAT_ID, content, { parse_mode: "Markdown", ...fbKeyboard("morning") });
};

// === Main fetch handler ===
export default {
  async fetch(req, env, ctx) {
    if (req.method !== "POST") return new Response("Aegis Worker alive", { status: 200 });

    let update;
    try { update = await req.json(); } catch { return new Response("bad json", { status: 400 }); }

    // ack telegram fast — process in background
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
          const [cmd, ...rest] = msg.text.slice(1).split(/\s+/);
          const args = rest.join(" ");
          const handled = await handleCommand(env, msg, cmd.toLowerCase(), args);
          if (handled !== null) return;
        }
        if (msg.text) return handleText(env, msg);
        if (msg.voice) return handleVoice(env, msg);
      } catch (err) {
        console.error("[handler]", err);
        try { await sendMessage(env, env.TELEGRAM_CHAT_ID, `❌ Error: ${err.message?.slice(0, 200)}`); } catch {}
      }
    })());

    return new Response("ok", { status: 200 });
  },

  // === Cron Triggers ===
  async scheduled(event, env, ctx) {
    ctx.waitUntil((async () => {
      const cron = event.cron;
      try {
        if (cron === "0 23 * * *") await cronMorningBrief(env);          // 06:00 WIB
        else if (cron === "0 14 * * *") {                                 // 21:00 WIB
          // evening recap — basic version
          await sendMessage(env, env.TELEGRAM_CHAT_ID, "🌙 (recap evening — TODO lengkap)");
        }
        // Reminder dispatch tiap 5 menit (kalau ada due)
        await cronReminders(env);
      } catch (err) {
        console.error("[scheduled]", err);
      }
    })());
  },
};
