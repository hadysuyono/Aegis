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
import { generateAuthUrl, exchangeCode, createEvent as gcalCreate, isConfigured as gcalReady } from "./lib/google-calendar.js";
import { generateMorningBrief, generateEveningRecap } from "./lib/briefings.js";
import { detectAnomalies } from "./lib/anomaly.js";
import { dailySnapshot } from "./lib/backup.js";
import { generateClaudeMdSuggestion, generateFeedbackDigest } from "./lib/self-update.js";
import { getUsageToday, getUsageLast7Days } from "./lib/usage.js";
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

bot.command("brief", async (ctx) => {
  await ctx.reply("🌅 Bikin morning brief...");
  try {
    const b = await generateMorningBrief();
    await ctx.reply(b, { parse_mode: "Markdown", ...fbKeyboard("morning") });
  } catch (err) { await ctx.reply(`❌ ${err.message}`); }
});

bot.command("anomaly", async (ctx) => {
  await ctx.reply("🔍 Scan anomali...");
  try {
    const res = await detectAnomalies();
    if (!res.hasAnomaly) return ctx.reply("✅ Bersih, tidak ada anomali.");
    await ctx.reply(res.message, fbKeyboard("anomaly"));
  } catch (err) { await ctx.reply(`❌ ${err.message}`); }
});

bot.command("usage", async (ctx) => {
  try {
    const today = await getUsageToday();
    const week = await getUsageLast7Days();
    const lines = ["📊 *Token Usage*", "", "*Hari Ini:*"];
    let totalToday = 0;
    for (const [role, s] of Object.entries(today)) {
      lines.push(`• ${role}: ${s.calls} calls, ${s.prompt + s.completion} tokens`);
      totalToday += s.prompt + s.completion;
    }
    if (Object.keys(today).length === 0) lines.push("(belum ada hari ini)");
    lines.push(`*Total hari ini: ${totalToday} tokens*`);
    lines.push("", "*7 Hari Terakhir (total):*");
    let total7 = 0, calls7 = 0;
    for (const day of Object.values(week)) {
      for (const s of Object.values(day)) {
        total7 += s.prompt + s.completion;
        calls7 += s.calls;
      }
    }
    lines.push(`${calls7} calls • ${total7} tokens`);
    await ctx.reply(lines.join("\n"), { parse_mode: "Markdown" });
  } catch (err) { await ctx.reply(`❌ ${err.message}`); }
});

bot.command("tune", async (ctx) => {
  await ctx.reply("🔧 Bikin saran tuning CLAUDE.md + digest feedback...");
  try {
    const [c, f] = await Promise.all([generateClaudeMdSuggestion(), generateFeedbackDigest()]);
    let msg = `📝 Saran CLAUDE.md → ${c.path}\n\n${c.snippet}`;
    if (!f.skipped) msg += `\n\n---\n\n📊 Feedback Digest → ${f.path}\n\n${f.snippet}`;
    await ctx.reply(msg);
  } catch (err) { await ctx.reply(`❌ ${err.message}`); }
});

bot.command("backup", async (ctx) => {
  await ctx.reply("💾 Bikin snapshot...");
  try {
    const res = await dailySnapshot();
    await ctx.reply(`✅ Snapshot ${res.date}: ${res.count} file di 06-ARCHIVE/backup/${res.date}/`);
  } catch (err) { await ctx.reply(`❌ ${err.message}`); }
});

bot.command("recap", async (ctx) => {
  await ctx.reply("🌙 Bikin evening recap...");
  try {
    const r = await generateEveningRecap();
    await ctx.reply(r, { parse_mode: "Markdown", ...fbKeyboard("evening") });
  } catch (err) { await ctx.reply(`❌ ${err.message}`); }
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

// === Google Calendar setup commands ===
bot.command("cal_auth", async (ctx) => {
  try {
    const url = generateAuthUrl();
    await ctx.reply(
      "🔐 Auth Google Calendar (1x setup):\n\n" +
      "1. Buka link ini di browser:\n" + url + "\n\n" +
      "2. Login akun Google yg HP-nya pakai Calendar\n" +
      "3. Klik *Allow* / Izinkan\n" +
      "4. Browser akan error \"can't reach localhost\" — ITU NORMAL\n" +
      "5. Copy semua URL di address bar (mulai http://localhost?code=...)\n" +
      "6. Kirim balik dengan format: `/cal_code <code>` (ambil dari ?code=... sampai sebelum &)\n\n" +
      "Contoh: kalau URL `http://localhost?code=4/0AbCD-abc&scope=...`, kirim `/cal_code 4/0AbCD-abc`",
      { parse_mode: "Markdown", disable_web_page_preview: true }
    );
  } catch (err) {
    await ctx.reply(`❌ Gagal: ${err.message}`);
  }
});

bot.command("cal_code", async (ctx) => {
  const code = ctx.message.text.replace(/^\/cal_code\s*/i, "").trim();
  if (!code) return ctx.reply("Format: /cal_code <code dari URL>");
  try {
    await exchangeCode(decodeURIComponent(code));
    await ctx.reply("✅ Google Calendar auth sukses! Sekarang setiap reminder baru akan otomatis muncul di Google Calendar Bapak (notif H-1 jam & H-10 menit).\n\nCoba test: /cal_test");
  } catch (err) {
    await ctx.reply(`❌ Gagal exchange code: ${err.message}\n\nCoba /cal_auth lagi.`);
  }
});

bot.command("cal_test", async (ctx) => {
  try {
    if (!await gcalReady()) return ctx.reply("Belum auth. Ketik /cal_auth dulu.");
    const start = new Date(Date.now() + 30 * 60_000); // 30 menit dari sekarang
    const ev = await gcalCreate({
      datetime_iso: start.toISOString(),
      event: "🧪 Test Aegis Calendar Sync",
      source: "Test sync dari Aegis bot",
    });
    await ctx.reply(`✅ Test event dibuat di Google Calendar.\n📅 ${ev.htmlLink}\n\nCek HP Bapak — event baru harusnya muncul dalam beberapa detik.`, { disable_web_page_preview: true });
  } catch (err) {
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

// === Voice note → transkrip Groq Whisper → forward ke brain ===
bot.on("voice", async (ctx) => {
  try {
    await ctx.reply("🎙️ Transkrip suara...");
    const fileLink = await ctx.telegram.getFileLink(ctx.message.voice.file_id);
    const audioRes = await fetch(fileLink.href);
    if (!audioRes.ok) throw new Error(`download fail: ${audioRes.status}`);
    const audioBuf = await audioRes.arrayBuffer();

    const fd = new FormData();
    fd.append("file", new Blob([audioBuf], { type: "audio/ogg" }), "voice.ogg");
    fd.append("model", "whisper-large-v3");
    fd.append("language", "id");
    fd.append("response_format", "json");

    const trRes = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
      body: fd,
    });
    if (!trRes.ok) throw new Error(`Groq whisper ${trRes.status}: ${await trRes.text()}`);
    const { text } = await trRes.json();
    if (!text || text.trim().length < 2) {
      return ctx.reply("🤷 Tidak terdengar suaranya, Pak.");
    }
    await ctx.reply(`🎙️ _"${text}"_`, { parse_mode: "Markdown" });
    const reply = await handleMessage(ctx.from.id, text);
    await ctx.reply(reply, fbKeyboard("brain"));
  } catch (err) {
    console.error("voice handler error:", err);
    await ctx.reply(`❌ Gagal transkrip: ${err.message}`);
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

// === Morning brief 06:00 WIB tiap hari ===
let briefLastRunDate = null;
const briefLoop = async () => {
  try {
    const n = nowJakarta();
    if (n.iso.slice(11, 13) === "06" && n.iso.slice(14, 16) === "00" && briefLastRunDate !== n.date) {
      briefLastRunDate = n.date;
      const brief = await generateMorningBrief();
      await bot.telegram.sendMessage(OWNER_ID, brief, { parse_mode: "Markdown", ...fbKeyboard("morning") });
    }
  } catch (err) { console.error("briefLoop error:", err.message); }
};
setInterval(briefLoop, 60_000);

// === Evening recap 21:00 WIB tiap hari ===
let recapLastRunDate = null;
const recapLoop = async () => {
  try {
    const n = nowJakarta();
    if (n.iso.slice(11, 13) === "21" && n.iso.slice(14, 16) === "00" && recapLastRunDate !== n.date) {
      recapLastRunDate = n.date;
      const recap = await generateEveningRecap();
      await bot.telegram.sendMessage(OWNER_ID, recap, { parse_mode: "Markdown", ...fbKeyboard("evening") });
    }
  } catch (err) { console.error("recapLoop error:", err.message); }
};
setInterval(recapLoop, 60_000);

// === Daily backup snapshot 03:00 WIB (jam paling sepi) ===
let backupLastRunDate = null;
const backupLoop = async () => {
  try {
    const n = nowJakarta();
    if (n.iso.slice(11, 13) === "03" && n.iso.slice(14, 16) === "00" && backupLastRunDate !== n.date) {
      backupLastRunDate = n.date;
      const res = await dailySnapshot();
      console.log(`[backup] daily snapshot ${res.date}: ${res.count} files`);
    }
  } catch (err) { console.error("backupLoop error:", err.message); }
};
setInterval(backupLoop, 60_000);

// === Anomaly scan 12:00 WIB siang (kalau ada, push notif ke Hady) ===
let anomalyLastRunDate = null;
const anomalyLoop = async () => {
  try {
    const n = nowJakarta();
    if (n.iso.slice(11, 13) === "12" && n.iso.slice(14, 16) === "00" && anomalyLastRunDate !== n.date) {
      anomalyLastRunDate = n.date;
      const res = await detectAnomalies();
      if (res.hasAnomaly) {
        await bot.telegram.sendMessage(OWNER_ID, res.message, fbKeyboard("anomaly"));
      }
    }
  } catch (err) { console.error("anomalyLoop error:", err.message); }
};
setInterval(anomalyLoop, 60_000);

// === Weekly self-tuning Minggu 20:00 WIB (Aegis evaluasi & saran improve diri) ===
let tuneLastRunWeek = null;
const tuneLoop = async () => {
  try {
    const now = new Date();
    const j = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Jakarta", hour12: false }));
    if (j.getDay() === 0 && j.getHours() === 20 && j.getMinutes() === 0) {
      const wk = `${j.getFullYear()}-W${Math.ceil((j.getDate() + 6) / 7)}`;
      if (tuneLastRunWeek === wk) return;
      tuneLastRunWeek = wk;
      const [c, f] = await Promise.all([
        generateClaudeMdSuggestion().catch(() => null),
        generateFeedbackDigest().catch(() => ({ skipped: true })),
      ]);
      if (c) {
        await bot.telegram.sendMessage(
          OWNER_ID,
          `🔧 *Self-tuning minggu ${wk}*\n\nSaran CLAUDE.md siap → ${c.path}\n\n${c.snippet}`,
          { parse_mode: "Markdown" }
        );
      }
      if (f && !f.skipped) {
        await bot.telegram.sendMessage(OWNER_ID, `📊 Feedback Digest siap → ${f.path}`);
      }
    }
  } catch (err) { console.error("tuneLoop error:", err.message); }
};
setInterval(tuneLoop, 60_000);

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

process.on("unhandledRejection", (reason) => {
  console.error("[unhandledRejection]", reason);
});
process.on("uncaughtException", (err) => {
  console.error("[uncaughtException]", err);
});
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
