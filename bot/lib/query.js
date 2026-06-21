// Query — jawab tanya jadwal dengan baca SUMBER RAW (reminders + events + inbox files).
// Tidak bergantung pada distill yang bisa gagal. Compound yang reason.

import { listActive } from "./reminders.js";
import { readJSON, listFolder, readText } from "./store.js";
import { aiCall } from "./ai.js";
import { nowJakarta, formatFriendly } from "./time.js";

const buildRange = (rangeKey) => {
  const now = new Date();
  const jakarta = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
  const y = jakarta.getFullYear(), m = jakarta.getMonth(), d = jakarta.getDate();
  const at = (yy, mm, dd, hh = 0, mi = 0) =>
    new Date(Date.UTC(yy, mm, dd, hh - 7, mi)).toISOString();

  switch (rangeKey) {
    case "hari_ini": return [at(y, m, d, 0, 0), at(y, m, d, 23, 59), "hari ini"];
    case "besok":    return [at(y, m, d + 1, 0, 0), at(y, m, d + 1, 23, 59), "besok"];
    case "lusa":     return [at(y, m, d + 2, 0, 0), at(y, m, d + 2, 23, 59), "lusa"];
    case "minggu_ini": {
      const dow = jakarta.getDay();
      const monOffset = dow === 0 ? -6 : 1 - dow;
      return [at(y, m, d + monOffset, 0, 0), at(y, m, d + monOffset + 6, 23, 59), "minggu ini"];
    }
    case "minggu_depan": {
      const dow = jakarta.getDay();
      const monOffset = dow === 0 ? 1 : 8 - dow;
      return [at(y, m, d + monOffset, 0, 0), at(y, m, d + monOffset + 6, 23, 59), "minggu depan"];
    }
    case "bulan_ini": return [at(y, m, 1, 0, 0), at(y, m + 1, 0, 23, 59), "bulan ini"];
    default:          return [at(y, m, d, 0, 0), at(y, m, d + 30, 23, 59), "30 hari ke depan"];
  }
};

const extractBody = (md) => {
  const m = md.match(/^---[\s\S]*?---\s*([\s\S]*)$/);
  return (m ? m[1] : md).trim();
};

const loadInboxNotes = async () => {
  const files = (await listFolder("00-INBOX")).filter(f => f.name.endsWith(".md"));
  const notes = [];
  for (const f of files.slice(-40)) { // ambil 40 terbaru
    const content = await readText(`00-INBOX/${f.name}`);
    if (!content) continue;
    notes.push({ file: f.name, body: extractBody(content) });
  }
  return notes;
};

export const answerSchedule = async (question, rangeKey) => {
  const [start, end, label] = buildRange(rangeKey);
  const today = nowJakarta();

  const [reminders, eventsDoc, notes] = await Promise.all([
    listActive(),
    readJSON("07-SYSTEM/memory/events.json", { events: [] }),
    loadInboxNotes(),
  ]);

  const structured = [
    ...reminders.map(r => ({ event: r.event, datetime_iso: r.datetime_iso, source: "reminder" })),
    ...(eventsDoc.events || []).map(e => ({ event: e.event, datetime_iso: e.datetime_iso, source: "event" })),
  ].filter(x => x.datetime_iso >= start && x.datetime_iso <= end);

  const prompt = `Kamu Aegis. Hari ini ${today.iso} (Asia/Jakarta).

Hady bertanya: "${question}"
Periode yang ditanya: ${label} (${start} sampai ${end}).

Sumber 1 — Jadwal terstruktur dalam periode ini:
${structured.length ? JSON.stringify(structured, null, 2) : "(kosong)"}

Sumber 2 — Catatan mentah Hady di INBOX (mungkin ada jadwal yang belum di-extract):
${notes.length ? notes.map(n => `[${n.file}] ${n.body}`).join("\n\n") : "(kosong)"}

Tugas:
- Baca SEMUA sumber. Cari yang masuk periode "${label}".
- Konversi tanggal Indonesia/English (Juni/June, Agu/August, dll) → tanggal ISO. "22 June 2026" = 2026-06-22.
- Sebutkan SEMUA jadwal yang masuk periode, ambil dari mana saja (struktur ATAU catatan mentah).
- Jawab Bahasa Indonesia santai-sopan, panggil "Pak". Maksimal 4 kalimat. 1 emoji maks.
- JUJUR: kalau memang tidak ada → bilang santai. JANGAN salah jawab "kosong" kalau ada di catatan mentah.`;

  const { content } = await aiCall("senior", { prompt, temperature: 0.2, max_tokens: 400 });
  return content || "Maaf Pak, ada masalah saat menjawab.";
};
