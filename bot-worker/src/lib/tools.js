// Tool registry — versi Workers.

import { writeFile, readJSON, listFolder, readText } from "./store.js";
import { addReminder, listActive, removeReminder } from "./reminders.js";
import { nowJakarta, formatFriendly } from "./time.js";
import { aiCall } from "./ai.js";

export const TOOL_SCHEMA = [
  { name: "save_note", description: "Simpan catatan/info baru ke inbox (pesan tanpa jadwal)", params: { text: "string", importance: "P0|P1|P2", category: "ide|tugas|info|orang" } },
  { name: "get_schedule", description: "Ambil jadwal Hady untuk periode tertentu", params: { range: "hari_ini|besok|lusa|minggu_ini|minggu_depan|bulan_ini" } },
  { name: "add_reminder", description: "Buat reminder. WAJIB reply user konfirmasi DULU kecuali user sudah jelas approve.", params: { datetime_iso: "YYYY-MM-DDTHH:mm:ss+07:00", event: "ringkas 3-8 kata", source: "pesan asli" } },
  { name: "search_memory", description: "Cari di memori Aegis (profil, orang, project, decision)", params: { query: "pertanyaan user" } },
  { name: "list_reminders", description: "Lihat semua reminder aktif", params: {} },
  { name: "remove_reminder", description: "Hapus reminder by ID", params: { id: "string" } },
];

const J = (obj) => JSON.stringify(obj);

const saveToInbox = async (env, text, meta) => {
  const { date, time, iso } = nowJakarta();
  const path = `00-INBOX/${date}-${time}.md`;
  const front = Object.entries({ created: iso, source: "telegram", ...meta }).map(([k, v]) => `${k}: ${v}`).join("\n");
  const body = `---\n${front}\n---\n\n${text}\n`;
  await writeFile(env, path, body, `inbox: ${date}-${time}`);
  return path;
};

const extractBody = (md) => {
  const m = md.match(/^---[\s\S]*?---\s*([\s\S]*)$/);
  return (m ? m[1] : md).trim();
};

const loadInboxNotes = async (env, limit = 40) => {
  const files = (await listFolder(env, "00-INBOX")).filter(f => f.name.endsWith(".md"));
  const notes = [];
  for (const f of files.slice(-limit)) {
    const content = await readText(env, `00-INBOX/${f.name}`);
    if (content) notes.push({ file: f.name, body: extractBody(content) });
  }
  return notes;
};

const buildRange = (rangeKey) => {
  const now = new Date();
  const jak = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
  const y = jak.getFullYear(), m = jak.getMonth(), d = jak.getDate();
  const at = (yy, mm, dd, hh = 0, mi = 0) =>
    new Date(Date.UTC(yy, mm, dd, hh - 7, mi)).toISOString();
  switch (rangeKey) {
    case "hari_ini": return [at(y, m, d, 0, 0), at(y, m, d, 23, 59), "hari ini"];
    case "besok": return [at(y, m, d + 1, 0, 0), at(y, m, d + 1, 23, 59), "besok"];
    case "lusa": return [at(y, m, d + 2, 0, 0), at(y, m, d + 2, 23, 59), "lusa"];
    case "minggu_ini": {
      const dow = jak.getDay();
      const o = dow === 0 ? -6 : 1 - dow;
      return [at(y, m, d + o, 0, 0), at(y, m, d + o + 6, 23, 59), "minggu ini"];
    }
    case "minggu_depan": {
      const dow = jak.getDay();
      const o = dow === 0 ? 1 : 8 - dow;
      return [at(y, m, d + o, 0, 0), at(y, m, d + o + 6, 23, 59), "minggu depan"];
    }
    case "bulan_ini": return [at(y, m, 1, 0, 0), at(y, m + 1, 0, 23, 59), "bulan ini"];
    default: return [at(y, m, d, 0, 0), at(y, m, d + 30, 23, 59), "30 hari ke depan"];
  }
};

const answerScheduleNL = async (env, question, range) => {
  const [start, end, label] = buildRange(range);
  const today = nowJakarta();
  const [reminders, eventsDoc, notes] = await Promise.all([
    listActive(env),
    readJSON(env, "07-SYSTEM/memory/events.json", { events: [] }),
    loadInboxNotes(env),
  ]);
  const structured = [
    ...reminders.map(r => ({ event: r.event, datetime_iso: r.datetime_iso, src: "reminder" })),
    ...(eventsDoc.events || []).map(e => ({ event: e.event, datetime_iso: e.datetime_iso, src: "event" })),
  ].filter(x => x.datetime_iso >= start && x.datetime_iso <= end);

  const prompt = `Kamu Aegis. Hari ini ${today.iso}. Hady tanya: "${question}". Periode ditanya: ${label}.

Struktur jadwal periode ini:
${structured.length ? JSON.stringify(structured, null, 2) : "(kosong)"}

Catatan inbox mentah (mungkin ada jadwal belum di-extract):
${notes.length ? notes.map(n => `[${n.file}] ${n.body}`).join("\n") : "(kosong)"}

Jawab Bapak (panggil "Pak"), bahasa Indonesia sopan, maks 3 kalimat, 1 emoji. Cari tanggal di catatan mentah juga ("22 June" = 2026-06-22).`;
  const { content } = await aiCall(env, "reason", { prompt, temperature: 0.3, max_tokens: 400 });
  return content;
};

const searchMemoryNL = async (env, query) => {
  const today = nowJakarta();
  const [owner, people, projects, events, decisions, beliefs] = await Promise.all([
    readJSON(env, "07-SYSTEM/memory/owner.json", {}),
    readJSON(env, "07-SYSTEM/memory/people.json", { people: [] }),
    readJSON(env, "07-SYSTEM/memory/projects.json", { projects: [] }),
    readJSON(env, "07-SYSTEM/memory/events.json", { events: [] }),
    readJSON(env, "07-SYSTEM/memory/decisions.json", { decisions: [] }),
    readJSON(env, "07-SYSTEM/memory/beliefs.json", { beliefs: [] }),
  ]);
  const ctx = { profil: owner, people: people.people, projects: projects.projects, events: events.events, decisions: decisions.decisions, beliefs: beliefs.beliefs };
  const prompt = `Kamu Aegis. Hari ini ${today.iso}. Hady tanya: "${query}".

Memori terstruktur:
${JSON.stringify(ctx, null, 2)}

Jawab Bapak (panggil "Pak"), sopan, maks 4 kalimat, 1 emoji. JUJUR kalau memori tidak punya jawaban — bilang belum ada catatan.`;
  const { content } = await aiCall(env, "reason", { prompt, temperature: 0.3, max_tokens: 350 });
  return content;
};

export const dispatch = async (env, toolName, params = {}) => {
  try {
    switch (toolName) {
      case "save_note": {
        if (!params.text || params.text.length < 3) return J({ error: "text terlalu pendek" });
        const importance = ["P0", "P1", "P2"].includes(params.importance) ? params.importance : "P2";
        const category = ["ide", "tugas", "info", "orang", "jadwal"].includes(params.category) ? params.category : "info";
        const path = await saveToInbox(env, params.text, { importance, category });
        return J({ ok: true, saved_to: path });
      }
      case "get_schedule": {
        const range = ["hari_ini", "besok", "lusa", "minggu_ini", "minggu_depan", "bulan_ini"].includes(params.range) ? params.range : "besok";
        const summary = await answerScheduleNL(env, `Ambil jadwal ${range}`, range);
        return J({ ok: true, summary });
      }
      case "add_reminder": {
        if (!params.datetime_iso || !params.event) return J({ error: "datetime_iso dan event wajib" });
        const r = await addReminder(env, { datetime_iso: params.datetime_iso, event: params.event, source: params.source || params.event });
        return J({ ok: true, ...r });
      }
      case "search_memory": {
        if (!params.query) return J({ error: "query wajib" });
        const answer = await searchMemoryNL(env, params.query);
        return J({ ok: true, answer });
      }
      case "list_reminders": {
        const items = await listActive(env);
        return J({ ok: true, count: items.length, items: items.slice(0, 20).map(r => ({ id: r.id, event: r.event, datetime_iso: r.datetime_iso })) });
      }
      case "remove_reminder": {
        if (!params.id) return J({ error: "id wajib" });
        const ok = await removeReminder(env, params.id);
        return J({ ok, removed: ok });
      }
      default:
        return J({ error: `tool "${toolName}" tidak dikenal` });
    }
  } catch (err) {
    return J({ error: err.message });
  }
};
