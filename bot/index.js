// Aegis Bot v0.5 — Unified Brain
// Otak (compound) handle setiap pesan & putuskan tool yang dipanggil.
// Env wajib: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID,
//            GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO, GROQ_API_KEY

import { Telegraf } from "telegraf";
import { handleMessage, resetState } from "./lib/brain.js";
import { listActive, removeReminder, dueReminders, markNotified } from "./lib/reminders.js";
import { distill } from "./lib/distill.js";
import { weeklyReflect } from "./lib/reflect.js";
import { recordFeedback, summary as feedbackSummary } from "./lib/feedback.js";
import { aiCall } from "./lib/ai.js";
import { nowJakarta, formatFriendly } from "./lib/time.js";

const REQUIRED = [
  "TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID",
  "GITHUB_TOKEN", "GITHUB_OWNER", "GITHUB_REPO", "GROQ_API_KEY",
];
for (const k of REQUIRED) {
  if (!process.env[k]) { console.error(`Missing env: ${k}`); process.exit(1); }
}

const OWNER_ID = String(process.env.TELEGRAM_CHAT_ID);
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

const fbKeyboard = (source) => ({
  reply_markup: {
    inline_keyboard: [[
      { text: "👍 Bagus", callback_data: `fb:up:${source}` },
      { text: "👎 Kurang", callback_data: `fb:down:${source}` },
    ]],
  },
});

// === Guard: hanya Hady ===
bot.use(async (ctx, next) => {
  if (String(ctx.from?.id) !== OWNER_ID) {
    console.warn(`Blocked: ${ctx.from?.id} (${ctx.from?.username})`);
    return;
  }
  return next();
});

// === Commands (fast-path, bypass brain) ===
bot.start((ctx) => ctx.reply(
  "✅ Aegis aktif. Saya otak Bapak — chat saja apa pun, saya pahami konteksnya.\n\n" +
  "Command langsung:\n" +
  "/list — reminder aktif\n" +
  "/hapus <id> — hapus reminder\n" +
  "/distill — proses inbox manual\n" +
  "/refleksi — refleksi mingguan\n" +
  "/cari <topik> — scout web\n" +
  "/feedback — statistik feedback\n" +
  "/reset — bersihkan ingatan percakapan\n" +
  "/ping — cek hidup"
));

bot.command("ping", (ctx) => ctx.reply("pong"));

bot.command("reset", (ctx) => {
  resetState(ctx.from.id);
  return ctx.reply("🧹 Memori percakapan dibersihkan. Mulai dari awal.");
});

bot.command("list", async (ctx) => {
  try {
    const items = await listActive();
    if (items.length === 0) return ctx.reply("📭 Tidak ada pengingat aktif.");
    const lines = items.map((r, i) =>
      `${i + 1}. 📝 ${r.event}\n   📅 ${formatFriendly(r.datetime_iso)}\n   🔖 ${r.id}`
    );
    await ctx.reply(`📋 Pengingat aktif (${items.length}):\n\n${lines.join("\n\n")}`);
  } catch (err) {
    await ctx.reply(`❌ Gagal: ${err.message}`);
  }
});

bot.command("hapus", async (ctx) => {
  const id = ctx.message.text.replace(/^\/hapus\s*/i, "").trim();
  if (!id) return ctx.reply("Format: /hapus <id>\nLihat ID di /list");
  try {
    const ok = await removeReminder(id);
    await ctx.reply(ok ? `🗑️ Pengingat ${id} dihapus.` : `❌ ID ${id} tidak ditemukan.`);
  } catch (err) {
    await ctx.reply(`❌ Gagal: ${err.message}`);
  }
});

bot.command("distill", async (ctx) => {
  await ctx.reply("🧠 Distill jalan... baca inbox & ekstrak entitas.");
  try {
    const res = await distill();
    if (res.processed === 0) return ctx.reply("📭 Inbox kosong. Tidak ada yang di-distill.");
    const t = res.totals;
    await ctx.reply(
      `✅ Distill ${res.processed} catatan.\n` +
      `👤 +${t.people} • 📦 +${t.projects} • 📅 +${t.events} • ⚖️ +${t.decisions} • 💡 +${t.beliefs}\n` +
      `🗄️ ${res.archived?.length || 0} file dipindah ke arsip.`
    );
  } catch (err) {
    console.error("distill error:", err);
    await ctx.reply(`❌ Gagal distill: ${err.message}`);
  }
});

bot.command("cari", async (ctx) => {
  const q = ctx.message.text.replace(/^\/cari\s*/i, "").trim();
  if (!q) return ctx.reply("Format: /cari <pertanyaan>");
  await ctx.reply("🔎 Scout web... tunggu sebentar.");
  try {
    const prompt = `Kamu Aegis. Hady minta info: "${q}". Pakai web search internalmu, jawab Bahasa Indonesia sopan (panggil "Pak"), maks 5 kalimat, sebut sumber kalau ada.`;
    const { content } = await aiCall("senior", { prompt, temperature: 0.3, max_tokens: 500 });
    await ctx.reply(content || "Maaf Pak, tidak dapat hasil.", fbKeyboard("scout"));
  } catch (err) {
    console.error("cari error:", err);
    await ctx.reply(`❌ Gagal scout: ${err.message}`);
  }
});

bot.command("refleksi", async (ctx) => {
  await ctx.reply("🪞 Bikin refleksi minggu ini...");
  try {
    const res = await weeklyReflect();
    if (res.skipped) return ctx.reply(`📭 ${res.reason}`);
    await ctx.reply(`📝 Refleksi siap → ${res.path}\n\n${res.snippet}${res.snippet.length >= 500 ? "..." : ""}`);
  } catch (err) {
    console.error("refleksi error:", err);
    await ctx.reply(`❌ Gagal: ${err.message}`);
  }
});

bot.command("feedback", async (ctx) => {
  try {
    const s = await feedbackSummary();
    if (s.total === 0) return ctx.reply("📭 Belum ada feedback.");
    const lines = Object.entries(s.bySource).map(([src, c]) => `• ${src}: 👍 ${c.up} | 👎 ${c.down}`);
    await ctx.reply(`📊 Feedback (total ${s.total})\n👍 ${s.up} | 👎 ${s.down}\n\n${lines.join("\n")}`);
  } catch (err) {
    await ctx.reply(`❌ Gagal: ${err.message}`);
  }
});

// === Feedback inline button callback ===
bot.on("callback_query", async (ctx) => {
  const data = ctx.callbackQuery.data || "";
  if (!data.startsWith("fb:")) return;
  const [, rating, source] = data.split(":");
  try {
    await recordFeedback({
      message_id: ctx.callbackQuery.message.message_id,
      rating, source,
    });
    await ctx.answerCbQuery(rating === "up" ? "Makasih, Pak 👍" : "Catat, akan saya perbaiki.");
    await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
  } catch (err) {
    console.error("feedback error:", err);
    await ctx.answerCbQuery("Gagal catat feedback.");
  }
});

// === Main: semua pesan teks → brain orchestrator ===
bot.on("text", async (ctx) => {
  const text = ctx.message.text.trim();
  if (!text) return;
  try {
    const reply = await handleMessage(ctx.from.id, text);
    await ctx.reply(reply, fbKeyboard("brain"));
  } catch (err) {
    console.error("brain handler error:", err);
    await ctx.reply(`❌ Maaf Pak, ada error: ${err.message}`);
  }
});

// === Reminder dispatch loop tiap 60 detik ===
const reminderLoop = async () => {
  try {
    const due = await dueReminders();
    if (due.length === 0) return;
    const ids = [];
    for (const r of due) {
      await bot.telegram.sendMessage(
        OWNER_ID,
        `🔔 *Pengingat*\n📝 ${r.event}\n📅 ${formatFriendly(r.datetime_iso)}\n\n_Pesan asli:_\n${r.source}`,
        { parse_mode: "Markdown" }
      );
      ids.push(r.id);
    }
    await markNotified(ids);
  } catch (err) { console.error("reminderLoop error:", err.message); }
};
setInterval(reminderLoop, 60_000);
setTimeout(reminderLoop, 5_000);

// === Nightly distill jam 23:00 WIB ===
let distillLastRunDate = null;
const distillLoop = async () => {
  try {
    const n = nowJakarta();
    if (n.iso.slice(11, 13) === "23" && n.iso.slice(14, 16) === "00" && distillLastRunDate !== n.date) {
      distillLastRunDate = n.date;
      const res = await distill();
      if (res.processed > 0) {
        const t = res.totals;
        await bot.telegram.sendMessage(
          OWNER_ID,
          `🌙 Distill malam: ${res.processed} catatan diproses.\n👤 +${t.people} • 📦 +${t.projects} • 📅 +${t.events}`
        );
      }
    }
  } catch (err) { console.error("distillLoop error:", err.message); }
};
setInterval(distillLoop, 60_000);

// === Weekly reflect Minggu 19:00 WIB ===
let reflectLastRunWeek = null;
const reflectLoop = async () => {
  try {
    const now = new Date();
    const j = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Jakarta", hour12: false }));
    if (j.getDay() === 0 && j.getHours() === 19 && j.getMinutes() === 0) {
      const wk = `${j.getFullYear()}-W${Math.ceil((j.getDate() + 6) / 7)}`;
      if (reflectLastRunWeek === wk) return;
      reflectLastRunWeek = wk;
      const res = await weeklyReflect();
      if (!res.skipped) {
        await bot.telegram.sendMessage(
          OWNER_ID,
          `🪞 Refleksi ${res.week}\n\n${res.snippet}${res.snippet.length >= 500 ? "..." : ""}`,
          fbKeyboard("reflect")
        );
      }
    }
  } catch (err) { console.error("reflectLoop error:", err.message); }
};
setInterval(reflectLoop, 60_000);

// === Startup ===
bot.catch((err) => console.error("Bot error:", err));
bot.launch().then(async () => {
  console.log("Aegis bot v0.5 (unified brain) running");
  // Auto-distill setelah startup (sekali, untuk rapikan inbox lama)
  setTimeout(async () => {
    try {
      const res = await distill();
      if (res.processed > 0) {
        const t = res.totals;
        await bot.telegram.sendMessage(
          OWNER_ID,
          `🚀 Aegis siap. Inbox dirapikan: ${res.processed} catatan diproses.\n` +
          `🧠 owner +${t.owner||0} • orang +${t.people||0} • project +${t.projects||0} • event +${t.events||0}`
        );
      }
    } catch (err) { console.error("startup distill error:", err.message); }
  }, 10_000);
});

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
