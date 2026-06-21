// Aegis Bot v0.3 — smart capture: classify → confirm → save
// Env wajib: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID,
//            GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO, GROQ_API_KEY

import { Telegraf } from "telegraf";
import { writeFile } from "./lib/store.js";
import { analyze } from "./lib/groq.js";
import { addReminder, dueReminders, markNotified, listActive, removeReminder } from "./lib/reminders.js";
import { answerSchedule } from "./lib/query.js";
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
  "• Test/noise → simpan ke arsip (tidak ganggu)\n\n" +
  "Command: /list /hapus /ping"
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

    // 1b. Tanya jadwal → jawab dari reminders
    if (a.intent === "tanya_jadwal") {
      const answer = await answerSchedule(a.date_range);
      return ctx.reply(answer);
    }

    // 1c. Tanya catatan (versi awal: belum dukung full search inbox)
    if (a.intent === "tanya_catatan") {
      return ctx.reply("🔎 Fitur cari catatan belum aktif. Sebentar lagi saya bangun (Memory Bank).");
    }

    // 2. Test/noise → archive silent (tidak balas)
    if (a.category === "test" || a.category === "noise" || a.importance === "P3") {
      await saveToFile("06-ARCHIVE/test", text, { importance: a.importance, category: a.category, reason: a.reason });
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

    // 4. Penting tapi tanpa jadwal → simpan ke inbox silent
    await saveToFile("00-INBOX", text, { importance: a.importance, category: a.category });
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

bot.catch((err) => console.error("Bot error:", err));
bot.launch().then(() => console.log("Aegis bot v0.3 running"));

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
