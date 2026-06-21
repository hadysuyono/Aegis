// Aegis Bot v0.3 — smart capture: classify → confirm → save
// Env wajib: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID,
//            GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO, GROQ_API_KEY

import { Telegraf } from "telegraf";
import { writeFile, listFolder, readText } from "./lib/store.js";
import { analyze } from "./lib/groq.js";
import { addReminder, dueReminders, markNotified, listActive, removeReminder } from "./lib/reminders.js";
import { answerSchedule } from "./lib/query.js";
import { distill, distillText } from "./lib/distill.js";
import { answerCatatan } from "./lib/recall.js";
import { weeklyReflect } from "./lib/reflect.js";
import { recordFeedback, summary as feedbackSummary } from "./lib/feedback.js";
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

// In-memory pending confirmation (chat_id → pending action)
const pending = new Map();

// Inline keyboard untuk feedback 👍/👎
const fbKeyboard = (source) => ({
  reply_markup: {
    inline_keyboard: [[
      { text: "👍 Bagus", callback_data: `fb:up:${source}` },
      { text: "👎 Kurang", callback_data: `fb:down:${source}` },
    ]],
  },
});

const saveToFile = async (folder, text, meta) => {
  const { date, time, iso } = nowJakarta();
  const path = `${folder}/${date}-${time}.md`;
  const front = Object.entries({ created: iso, source: "telegram", ...meta })
    .map(([k, v]) => `${k}: ${v}`).join("\n");
  const body = `---\n${front}\n---\n\n${text}\n`;
  await writeFile(path, body, `${folder}: ${date}-${time}`);
  return path;
};

// Guard
bot.use(async (ctx, next) => {
  if (String(ctx.from?.id) !== OWNER_ID) return;
  return next();
});

bot.start((ctx) => ctx.reply(
  "✅ Aegis aktif.\n\n" +
  "Saya baca tiap pesan & klasifikasi:\n" +
  "• Penting → simpan & kalau ada jadwal saya konfirmasi dulu\n" +
  "• Test/noise → simpan ke arsip (tidak ganggu)\n" +
  "• Pertanyaan → saya jawab dari memori\n\n" +
  "Command:\n" +
  "/list • /hapus <id> — kelola pengingat\n" +
  "/distill • /scan — proses inbox\n" +
  "/refleksi — refleksi mingguan\n" +
  "/feedback — ringkasan feedback\n" +
  "/ping — cek bot"
));

bot.command("ping", (ctx) => ctx.reply("pong"));

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

// Extract isi pesan dari file inbox (skip frontmatter)
const extractBody = (md) => {
  const m = md.match(/^---[\s\S]*?---\s*([\s\S]*)$/);
  return (m ? m[1] : md).trim();
};

bot.command("distill", async (ctx) => {
  await ctx.reply("🧠 Distill jalan... baca inbox & ekstrak entitas.");
  try {
    const res = await distill();
    if (res.processed === 0) return ctx.reply("📭 Inbox kosong. Tidak ada yang di-distill.");
    const t = res.totals;
    await ctx.reply(
      `✅ Distill ${res.processed} catatan.\n\n` +
      `👤 Orang: +${t.people}\n` +
      `📦 Project: +${t.projects}\n` +
      `📅 Event: +${t.events}\n` +
      `⚖️ Decision: +${t.decisions}\n` +
      `💡 Belief: +${t.beliefs}\n\n` +
      `🗄️ ${res.archived.length} file dipindah ke arsip.`
    );
  } catch (err) {
    console.error("distill error:", err);
    await ctx.reply(`❌ Gagal distill: ${err.message}`);
  }
});

bot.command("cari", async (ctx) => {
  const q = ctx.message.text.replace(/^\/cari\s*/i, "").trim();
  if (!q) return ctx.reply("Format: /cari <pertanyaan>\nContoh: /cari harga BBM pertamax hari ini");
  await ctx.reply("🔎 Scout web... tunggu sebentar.");
  try {
    const { aiCall } = await import("./lib/ai.js");
    const prompt = `Kamu Aegis. Hady minta info: "${q}"

Pakai kemampuan web search internalmu untuk cari jawaban terbaru. Jawab Bahasa Indonesia sopan (panggil "Pak"), maksimal 5 kalimat, sebut sumber kalau ada. Kalau tidak yakin atau tidak ketemu, jujur bilang.`;
    const { content } = await aiCall("senior", { prompt, temperature: 0.3, max_tokens: 500 });
    await ctx.reply(content || "Maaf Pak, tidak dapat hasil.", fbKeyboard("scout"));
  } catch (err) {
    console.error("cari error:", err);
    await ctx.reply(`❌ Gagal scout: ${err.message}`);
  }
});

bot.command("refleksi", async (ctx) => {
  await ctx.reply("🪞 Bikin refleksi minggu ini... tunggu sebentar.");
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
    const lines = Object.entries(s.bySource).map(([src, c]) =>
      `• ${src}: 👍 ${c.up} | 👎 ${c.down}`);
    await ctx.reply(`📊 Feedback (total ${s.total})\n👍 ${s.up} | 👎 ${s.down}\n\n${lines.join("\n")}`);
  } catch (err) {
    await ctx.reply(`❌ Gagal: ${err.message}`);
  }
});

// Handler tombol feedback inline
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

bot.command("scan", async (ctx) => {
  await ctx.reply("🔍 Scan inbox... tunggu sebentar.");
  try {
    const files = (await listFolder("00-INBOX")).filter(f => f.name.endsWith(".md"));
    if (files.length === 0) return ctx.reply("📭 Inbox kosong.");
    let found = 0;
    const summary = [];
    for (const f of files) {
      const content = await readText(`00-INBOX/${f.name}`);
      if (!content) continue;
      const body = extractBody(content);
      if (!body) continue;
      const a = await analyze(body);
      if (a.has_schedule && a.datetime_iso && a.event) {
        const { id, friendly } = await addReminder({
          datetime_iso: a.datetime_iso, event: a.event, source: body,
        });
        found++;
        summary.push(`• ${a.event} — ${friendly} (${id})`);
      }
    }
    if (found === 0) return ctx.reply(`✅ Scan ${files.length} catatan. Tidak ada jadwal terdeteksi.`);
    await ctx.reply(`✅ Scan ${files.length} catatan.\n🎯 ${found} jadwal ditemukan & disimpan:\n\n${summary.join("\n")}`);
  } catch (err) {
    console.error("scan error:", err);
    await ctx.reply(`❌ Gagal scan: ${err.message}`);
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

const handleConfirmation = async (ctx, text) => {
  const p = pending.get(ctx.from.id);
  if (!p) return false;
  const normalized = text.toLowerCase().trim();
  if (!/^(ya|y|yes|ok|oke|tidak|t|no|batal|skip)$/i.test(normalized)) return false;
  pending.delete(ctx.from.id);
  if (/^(tidak|t|no|batal|skip)$/i.test(normalized)) {
    await saveToFile("00-INBOX", p.source, { importance: p.importance, category: p.category });
    return ctx.reply("👌 Tidak dijadwalkan.");
  }
  // ya
  const { id, friendly } = await addReminder({
    datetime_iso: p.datetime_iso, event: p.event, source: p.source,
  });
  return ctx.reply(`⏰ Dijadwalkan\n📝 ${p.event}\n📅 ${friendly}\n🔖 ${id}`);
};

bot.on("text", async (ctx) => {
  const text = ctx.message.text.trim();
  try {
    // 0. Cek apakah ini balasan konfirmasi pending
    if (await handleConfirmation(ctx, text)) return;

    // 1. Analisis pesan
    const a = await analyze(text);

    // 1b. Tanya jadwal → jawab dari reminders (natural via Groq) + feedback
    if (a.intent === "tanya_jadwal") {
      const answer = await answerSchedule(text, a.date_range);
      await ctx.reply(answer, fbKeyboard("schedule"));
      return;
    }

    // 1c. Tanya catatan → recall dari memory terstruktur (Layer 3)
    if (a.intent === "tanya_catatan") {
      const answer = await answerCatatan(text);
      const sent = await ctx.reply(answer, fbKeyboard("recall"));
      return;
    }

    // 2. Test/noise → buang (tidak disimpan sama sekali, silent)
    if (a.category === "test" || a.category === "noise" || a.importance === "P3") {
      console.log(`[noise drop] "${text.slice(0, 60)}" → ${a.category}/${a.importance}`);
      return;
    }

    // 3. Ada jadwal → minta konfirmasi dulu
    if (a.has_schedule && a.datetime_iso && a.event) {
      pending.set(ctx.from.id, {
        source: text, event: a.event, datetime_iso: a.datetime_iso,
        importance: a.importance, category: a.category,
      });
      return ctx.reply(
        `🤖 Mau saya jadwalkan?\n\n` +
        `📝 ${a.event}\n` +
        `📅 ${formatFriendly(a.datetime_iso)}\n` +
        `⚡ Prioritas: ${a.importance}\n\n` +
        `Balas: *ya* / *tidak*`,
        { parse_mode: "Markdown" }
      );
    }

    // 4. Penting tapi tanpa jadwal → simpan ke inbox + BLOCKING distill (visible feedback)
    const inboxPath = await saveToFile("00-INBOX", text, { importance: a.importance, category: a.category });
    let extracted;
    try {
      extracted = await distillText(text, inboxPath.split("/").pop());
    } catch (err) {
      console.error("inline distill error:", err);
      await ctx.reply(`📝 Tercatat ke inbox.\n⚠️ Distill error: ${err.message}`);
      return;
    }
    if (extracted) {
      const parts = [];
      if (extracted.owner) parts.push("profil owner");
      if (extracted.people) parts.push(`${extracted.people} orang`);
      if (extracted.projects) parts.push(`${extracted.projects} project`);
      if (extracted.events) parts.push(`${extracted.events} event`);
      if (extracted.decisions) parts.push(`${extracted.decisions} keputusan`);
      if (extracted.beliefs) parts.push(`${extracted.beliefs} belief`);
      if (parts.length > 0) {
        await ctx.reply(`🧠 Dipelajari: ${parts.join(", ")}.`);
      } else {
        await ctx.reply(`📝 Tercatat ke inbox. (Tidak ada entitas baru yg di-ekstrak)`);
      }
    } else {
      await ctx.reply(`📝 Tercatat ke inbox. (distill return null)`);
    }
    return;
  } catch (err) {
    console.error("handle text error:", err);
    await ctx.reply(`❌ Gagal: ${err.message}`);
  }
});

// Scheduler reminder tiap 60 detik
const checkLoop = async () => {
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
  } catch (err) {
    console.error("checkLoop error:", err.message);
  }
};

setInterval(checkLoop, 60_000);
setTimeout(checkLoop, 5_000);

// Daily distill scheduler — jam 23:00 WIB
let distillLastRunDate = null;
const distillLoop = async () => {
  try {
    const n = nowJakarta();
    const hour = n.iso.slice(11, 13);
    const minute = n.iso.slice(14, 16);
    if (hour === "23" && minute === "00" && distillLastRunDate !== n.date) {
      distillLastRunDate = n.date;
      console.log("nightly distill triggered");
      const res = await distill();
      if (res.processed > 0) {
        const t = res.totals;
        await bot.telegram.sendMessage(
          OWNER_ID,
          `🌙 *Distill malam ini*\n` +
          `📥 ${res.processed} catatan diproses\n` +
          `👤 +${t.people} • 📦 +${t.projects} • 📅 +${t.events}\n` +
          `⚖️ +${t.decisions} • 💡 +${t.beliefs}`,
          { parse_mode: "Markdown" }
        );
      }
    }
  } catch (err) {
    console.error("distillLoop error:", err.message);
  }
};
setInterval(distillLoop, 60_000);

// Weekly reflect scheduler — Minggu 19:00 WIB
let reflectLastRunWeek = null;
const reflectLoop = async () => {
  try {
    const now = new Date();
    const jakartaStr = now.toLocaleString("en-US", { timeZone: "Asia/Jakarta", hour12: false });
    const j = new Date(jakartaStr);
    const dow = j.getDay(); // 0 = Sunday
    const hh = j.getHours();
    const mm = j.getMinutes();
    if (dow === 0 && hh === 19 && mm === 0) {
      const wkKey = `${j.getFullYear()}-${Math.ceil((j.getDate() + 6) / 7)}`;
      if (reflectLastRunWeek === wkKey) return;
      reflectLastRunWeek = wkKey;
      console.log("weekly reflect triggered");
      const res = await weeklyReflect();
      if (!res.skipped) {
        await bot.telegram.sendMessage(
          OWNER_ID,
          `🪞 *Refleksi minggu ${res.week}*\n\n${res.snippet}${res.snippet.length >= 500 ? "...\n\n📄 Lengkap di vault." : ""}`,
          { parse_mode: "Markdown", ...fbKeyboard("reflect") }
        );
      }
    }
  } catch (err) {
    console.error("reflectLoop error:", err.message);
  }
};
setInterval(reflectLoop, 60_000);

bot.catch((err) => console.error("Bot error:", err));
bot.launch().then(() => console.log("Aegis bot v0.3 running"));

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
