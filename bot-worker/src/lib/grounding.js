// GROUNDING — middleware data-first.
// SEBELUM AI dipanggil, auto-tarik data relevan dari vault Obsidian.
// AI dapat KONTEKS lengkap → reply natural berdasar data nyata (TIDAK BISA NGARANG).
//
// Filosofi (Hady 2026-06-30):
// "AI WAJIB tarik data Obsidian DULU sebelum jawab. AI bukan otak yang putuskan,
//  AI cuma narator dari data."

import { readJSON } from "./store.js";
import { nowJakarta } from "./time.js";

const PATH_REMINDERS  = "07-SYSTEM/reminders.json";
const PATH_PEOPLE     = "07-SYSTEM/memory/people.json";
const PATH_PROJECTS   = "07-SYSTEM/memory/projects.json";
const PATH_DECISIONS  = "07-SYSTEM/memory/decisions.json";
const PATH_EVENTS     = "07-SYSTEM/memory/events.json";
const PATH_BELIEFS    = "07-SYSTEM/memory/beliefs.json";
const PATH_OWNER      = "07-SYSTEM/memory/owner.json";

// Klasifikasi intent — keyword sederhana (anti-pusing, anti-overhead).
const detectIntent = (text) => {
  const t = (text || "").toLowerCase();
  const has = (re) => re.test(t);
  return {
    schedule:  has(/jadwal|agenda|reminder|pengingat|kapan|besok|lusa|minggu|tanggal\s+\d|hari ini|jam\s+\d|pertemuan|meeting|rapat/),
    person:    has(/siapa|orang|kary|karyawan|tim|esra|apri|nama/),
    project:   has(/project|proyek|m44|m53|bajaj|reguler|capital|sentinel|aegis|3s|smartsystem/),
    decision:  has(/keputusan|decision|pilih|memutuskan|sepakat/),
    event:     has(/event|kejadian|riwayat|history|kemarin|minggu lalu/),
    finance:   has(/uang|setor|cash|coh|saldo|hutang|gaji|biaya|nominal|harga|pengeluaran/),
    belief:    has(/percaya|prinsip|filosofi|nilai|value/),
    aboutMe:   has(/saya|aku|gw|gue|hady|hady suyono|owner|bos|pak/),
    greeting:  has(/^(hai|halo|hi|hello|test|tes|coba|pagi|siang|sore|malam|thanks?|makasih|ok|sip|gas)$/i),
  };
};

// Filter reminders ke range relevan (±1 hari past untuk konteks, +14 hari future).
const filterReminders = (reminders, daysPast = 1, daysFuture = 14) => {
  const nowMs = Date.now();
  const lo = nowMs - daysPast * 86400000;
  const hi = nowMs + daysFuture * 86400000;
  return reminders
    .map(r => ({ ...r, ts: new Date(r.datetime_iso).getTime() }))
    .filter(r => !isNaN(r.ts) && r.ts >= lo && r.ts <= hi)
    .sort((a, b) => a.ts - b.ts)
    .slice(0, 15);
};

const fmtReminders = (list) => {
  if (!list.length) return "(tidak ada jadwal dalam rentang -1 sd +14 hari)";
  return list.map(r => {
    const status = r.notified ? "✓ sudah lewat/dikirim" : "⏳ belum";
    return `- ${r.datetime_iso} — ${r.event} [${status}]`;
  }).join("\n");
};

// Snippet ringkas dari memory JSON (cap 1500 char per file biar tidak boros).
const snippetJSON = (obj, max = 1500) => {
  try {
    const s = JSON.stringify(obj, null, 2);
    return s.length > max ? s.slice(0, max) + `\n... [+${s.length - max} char terpotong]` : s;
  } catch { return "(parse error)"; }
};

export const buildGrounding = async (env, userText) => {
  const intent = detectIntent(userText);
  const { iso, date } = nowJakarta();
  const blocks = [];

  // SELALU sertakan waktu sekarang — biar AI tau "hari ini" itu kapan persis.
  blocks.push(`📅 WAKTU SEKARANG: ${iso} (Asia/Jakarta), tanggal ${date}`);

  // Greeting murni → tidak perlu load data berat
  if (intent.greeting && !intent.schedule && !intent.person && !intent.project &&
      !intent.decision && !intent.event && !intent.finance) {
    return wrapContext(blocks);
  }

  // Owner profile — kalau pertanyaan tentang "saya/Hady"
  if (intent.aboutMe) {
    const owner = await readJSON(env, PATH_OWNER, null).catch(() => null);
    if (owner) blocks.push(`👤 PROFIL HADY (owner.json):\n${snippetJSON(owner, 800)}`);
  }

  // Schedule — selalu load kalau ada hint waktu
  if (intent.schedule) {
    try {
      const data = await readJSON(env, PATH_REMINDERS, { reminders: [] });
      const list = filterReminders(data.reminders || []);
      blocks.push(`📆 JADWAL HADY (reminders.json, rentang -1 sd +14 hari):\n${fmtReminders(list)}`);
    } catch (e) {
      blocks.push(`📆 JADWAL HADY: (gagal load: ${e.message})`);
    }
  }

  // People
  if (intent.person) {
    const people = await readJSON(env, PATH_PEOPLE, null).catch(() => null);
    if (people) blocks.push(`👥 ORANG TERCATAT (people.json):\n${snippetJSON(people)}`);
  }

  // Projects
  if (intent.project) {
    const projects = await readJSON(env, PATH_PROJECTS, null).catch(() => null);
    if (projects) blocks.push(`📦 PROYEK (projects.json):\n${snippetJSON(projects)}`);
  }

  // Decisions
  if (intent.decision) {
    const decisions = await readJSON(env, PATH_DECISIONS, null).catch(() => null);
    if (decisions) blocks.push(`📋 KEPUTUSAN TERCATAT (decisions.json):\n${snippetJSON(decisions)}`);
  }

  // Events / finance riwayat
  if (intent.event || intent.finance) {
    const events = await readJSON(env, PATH_EVENTS, null).catch(() => null);
    if (events) blocks.push(`📜 KEJADIAN/RIWAYAT (events.json):\n${snippetJSON(events)}`);
  }

  // Beliefs / prinsip
  if (intent.belief) {
    const beliefs = await readJSON(env, PATH_BELIEFS, null).catch(() => null);
    if (beliefs) blocks.push(`💡 PRINSIP/NILAI HADY (beliefs.json):\n${snippetJSON(beliefs, 800)}`);
  }

  return wrapContext(blocks);
};

const wrapContext = (blocks) => {
  if (blocks.length <= 1) {
    // Cuma waktu — tetap kirim biar AI tau tanggal hari ini
    return `\n\n<KONTEKS_DARI_VAULT_OBSIDIAN_HADY>\n${blocks.join("\n")}\n</KONTEKS_DARI_VAULT_OBSIDIAN_HADY>\n\n⚠️ ATURAN: gunakan KONTEKS di atas. JANGAN ngarang. Kalau info tidak ada di konteks, JUJUR bilang "Belum ada catatan, Pak."`;
  }
  return `\n\n<KONTEKS_DARI_VAULT_OBSIDIAN_HADY>\n${blocks.join("\n\n")}\n</KONTEKS_DARI_VAULT_OBSIDIAN_HADY>\n\n⚠️ ATURAN WAJIB:
1. Gunakan KONTEKS di atas sebagai sumber kebenaran.
2. JANGAN NGARANG fakta di luar konteks.
3. Kalau yang ditanya tidak ada di konteks, JUJUR bilang "Belum ada catatan di vault, Pak." JANGAN tebak.
4. Sebut angka, tanggal, nama PERSIS seperti di konteks.`;
};
