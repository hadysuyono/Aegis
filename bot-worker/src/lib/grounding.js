// GROUNDING v2 — DATA-FIRST, ALWAYS-LOAD CORE MEMORY.
// Filosofi (Hady 2026-06-30):
//   "Aegis bukan cuma untuk tanya jadwal/karyawan. SEMUA memory yang sudah tertanam
//    di vault harus terkoneksi satu sama lain dan aktif."
//
// Strategi:
//   - SELALU load core memory (small, ~5KB) — owner, people, projects, decisions,
//     events, beliefs, reminders, 02-PROJECTS pages.
//   - INTENT-BASED load tambahan: 01-KNOWLEDGE notes, inbox 7 hari terakhir.
//   - Cache 60s in-memory per Worker isolate biar tidak slam GitHub API.
//   - AI dapat KONTEKS UTUH → bisa cross-reference (Arip + hutang + M44 → 1 jawaban).

import { readJSON, readText, listFolder } from "./store.js";
import { nowJakarta } from "./time.js";

const PATHS = {
  reminders: "07-SYSTEM/reminders.json",
  owner:     "07-SYSTEM/memory/owner.json",
  people:    "07-SYSTEM/memory/people.json",
  projects:  "07-SYSTEM/memory/projects.json",
  decisions: "07-SYSTEM/memory/decisions.json",
  events:    "07-SYSTEM/memory/events.json",
  beliefs:   "07-SYSTEM/memory/beliefs.json",
};

// In-memory cache (per Worker isolate, reset saat cold start).
let _cache = null;
let _cacheTs = 0;
const CACHE_TTL_MS = 60 * 1000; // 60 detik

const loadCore = async (env) => {
  const now = Date.now();
  if (_cache && (now - _cacheTs) < CACHE_TTL_MS) return _cache;

  // Load all small memory paralel
  const [reminders, owner, people, projects, decisions, events, beliefs] = await Promise.all([
    readJSON(env, PATHS.reminders, { reminders: [] }).catch(() => ({ reminders: [] })),
    readJSON(env, PATHS.owner, null).catch(() => null),
    readJSON(env, PATHS.people, null).catch(() => null),
    readJSON(env, PATHS.projects, null).catch(() => null),
    readJSON(env, PATHS.decisions, null).catch(() => null),
    readJSON(env, PATHS.events, null).catch(() => null),
    readJSON(env, PATHS.beliefs, null).catch(() => null),
  ]);

  // Load 02-PROJECTS markdown pages (semua project home pages)
  let projectPages = "";
  try {
    const items = await listFolder(env, "02-PROJECTS");
    const mdFiles = items.filter(f => f.type === "file" && f.name.endsWith(".md")).slice(0, 8);
    const contents = await Promise.all(
      mdFiles.map(async f => {
        const txt = await readText(env, `02-PROJECTS/${f.name}`).catch(() => null);
        return txt ? `── ${f.name} ──\n${txt.slice(0, 2500)}` : null;
      })
    );
    projectPages = contents.filter(Boolean).join("\n\n");
  } catch {}

  _cache = { reminders, owner, people, projects, decisions, events, beliefs, projectPages };
  _cacheTs = now;
  return _cache;
};

// Filter reminders ke range relevan (-1 sd +14 hari).
const filterReminders = (reminders) => {
  const nowMs = Date.now();
  const lo = nowMs - 86400000;
  const hi = nowMs + 14 * 86400000;
  return reminders
    .map(r => ({ ...r, ts: new Date(r.datetime_iso).getTime() }))
    .filter(r => !isNaN(r.ts) && r.ts >= lo && r.ts <= hi)
    .sort((a, b) => a.ts - b.ts)
    .slice(0, 20);
};

const fmtReminders = (list) => {
  if (!list.length) return "(tidak ada jadwal aktif dalam rentang -1 sd +14 hari)";
  return list.map(r => {
    const status = r.notified ? "✓ sudah lewat" : "⏳ belum lewat";
    return `- ${r.datetime_iso} — ${r.event} [${status}]`;
  }).join("\n");
};

// Snippet ringkas — cap per file.
const snippet = (obj, max = 2000) => {
  if (!obj) return "(belum ada data)";
  try {
    const s = JSON.stringify(obj, null, 2);
    return s.length > max ? s.slice(0, max) + `\n... [+${s.length - max} char dipotong]` : s;
  } catch { return "(parse error)"; }
};

// Intent detector — untuk load TAMBAHAN (inbox, knowledge files).
const detectExtras = (text) => {
  const t = (text || "").toLowerCase();
  return {
    recent: /kemarin|tadi|barusan|minggu lalu|recent|terakhir/.test(t),
    deep:   /jelaskan|kenapa|mengapa|alasan|bagaimana|sejarah|background/.test(t),
  };
};

// Load inbox 7 hari terakhir (kalau intent recent).
const loadRecentInbox = async (env) => {
  try {
    const { date } = nowJakarta();
    const ym = date.slice(0, 7); // 2026-06
    const items = await listFolder(env, `06-ARCHIVE/inbox/${ym}`).catch(() => []);
    const recent = items
      .filter(f => f.type === "file" && f.name.endsWith(".md"))
      .sort((a, b) => b.name.localeCompare(a.name))
      .slice(0, 7);
    const contents = await Promise.all(
      recent.map(async f => {
        const txt = await readText(env, `06-ARCHIVE/inbox/${ym}/${f.name}`).catch(() => null);
        return txt ? `── ${f.name} ──\n${txt.slice(0, 800)}` : null;
      })
    );
    return contents.filter(Boolean).join("\n\n");
  } catch { return ""; }
};

export const buildGrounding = async (env, userText) => {
  const core = await loadCore(env);
  const extras = detectExtras(userText);
  const { iso, date } = nowJakarta();

  const blocks = [
    `📅 WAKTU SEKARANG: ${iso} (Asia/Jakarta), tanggal ${date}`,
    `👤 PROFIL HADY (owner.json):\n${snippet(core.owner, 1500)}`,
    `📆 JADWAL HADY (reminders.json, -1 sd +14 hari):\n${fmtReminders(filterReminders(core.reminders.reminders || []))}`,
    `👥 ORANG TERCATAT (people.json):\n${snippet(core.people, 3000)}`,
    `📦 PROYEK MEMORY (projects.json):\n${snippet(core.projects, 2000)}`,
    `📋 KEPUTUSAN (decisions.json):\n${snippet(core.decisions, 2000)}`,
    `📜 EVENTS/RIWAYAT (events.json):\n${snippet(core.events, 2500)}`,
    `💡 PRINSIP/BELIEFS (beliefs.json):\n${snippet(core.beliefs, 1500)}`,
  ];

  // Project home pages (02-PROJECTS/*.md) — selalu inject biar AI tau status semua project
  if (core.projectPages) {
    blocks.push(`📚 PROJECT HOME PAGES (02-PROJECTS/):\n${core.projectPages.slice(0, 8000)}`);
  }

  // Inbox 7 hari terakhir — kalau intent recent/deep
  if (extras.recent || extras.deep) {
    const inbox = await loadRecentInbox(env);
    if (inbox) blocks.push(`📥 INBOX 7 HARI TERAKHIR:\n${inbox.slice(0, 5000)}`);
  }

  return `\n\n<KONTEKS_DARI_VAULT_OBSIDIAN_HADY>
${blocks.join("\n\n")}
</KONTEKS_DARI_VAULT_OBSIDIAN_HADY>

⚠️ ATURAN WAJIB (jangan dilanggar):
1. KONTEKS di atas adalah SUMBER KEBENARAN tentang Pak Hady — gunakan SEPENUHNYA.
2. JANGAN NGARANG fakta. Sebut nama, angka, tanggal PERSIS seperti di konteks.
3. CROSS-REFERENCE antar bagian: kalau ditanya "Arip", cek juga events/decisions yang melibatkan dia. Kalau ditanya "M44", cek juga people/events terkait.
4. Kalau info benar-benar tidak ada di konteks, JUJUR: "Belum ada catatan di vault, Pak." JANGAN tebak.
5. Reply natural, sopan, panggil "Pak" / "Pak Hady". Max 4 kalimat (kecuali Bapak minta detail).`;
};
