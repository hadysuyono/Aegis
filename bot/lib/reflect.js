// Layer 4 — Reflect: tiap minggu Aegis evaluasi diri & update operating doc.

import { readJSON, writeFile } from "./store.js";
import { aiCall } from "./ai.js";
import { nowJakarta } from "./time.js";

const MEM = {
  people: "07-SYSTEM/memory/people.json",
  projects: "07-SYSTEM/memory/projects.json",
  events: "07-SYSTEM/memory/events.json",
  decisions: "07-SYSTEM/memory/decisions.json",
  beliefs: "07-SYSTEM/memory/beliefs.json",
};

const isoWeek = (date) => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const wk = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(wk).padStart(2, "0")}`;
};

// Item dalam 7 hari terakhir (pakai field tanggal yang ada)
const inLastWeek = (items, dateField) => {
  const cutoff = Date.now() - 7 * 86400_000;
  return items.filter(it => {
    const v = it[dateField];
    if (!v) return false;
    const t = new Date(v).getTime();
    return !isNaN(t) && t >= cutoff;
  });
};

export const weeklyReflect = async () => {
  const [peopleDoc, projDoc, eventDoc, decDoc, belDoc] = await Promise.all([
    readJSON(MEM.people, { people: [] }),
    readJSON(MEM.projects, { projects: [] }),
    readJSON(MEM.events, { events: [] }),
    readJSON(MEM.decisions, { decisions: [] }),
    readJSON(MEM.beliefs, { beliefs: [] }),
  ]);

  const recent = {
    people_baru: inLastWeek(peopleDoc.people, "first_seen"),
    project_aktif: projDoc.projects.filter(p => p.status === "aktif").slice(0, 10),
    event_minggu_ini: inLastWeek(eventDoc.events, "datetime_iso"),
    decision_minggu_ini: inLastWeek(decDoc.decisions, "date"),
    belief_baru: inLastWeek(belDoc.beliefs, "first_seen"),
  };

  const totalCount = Object.values(recent).reduce((a, arr) => a + arr.length, 0);
  if (totalCount === 0) {
    return { skipped: true, reason: "Tidak ada aktivitas baru minggu ini." };
  }

  const today = nowJakarta();
  const prompt = `Kamu Aegis — asisten pribadi Hady. Hari ini ${today.iso}.

Ini ringkasan aktivitas Hady 7 hari terakhir (hasil distill catatan):
${JSON.stringify(recent, null, 2)}

Tugas: tulis **Weekly Reflection** untuk Hady. Format Markdown, bahasa Indonesia sopan ("Pak Hady"). Singkat, tajam, tidak bertele-tele.

Struktur:
## Minggu Ini Dalam 1 Kalimat
(satu kalimat jujur tentang minggu ini)

## Yang Maju
- (2-3 hal yang advance)

## Yang Stagnan / Perlu Perhatian
- (2-3 hal yang mandek atau perlu Bapak putuskan)

## Pola yang Saya Lihat
- (1-2 pola dari data: perilaku, orang, project)

## Belief Baru / Berubah
- (kalau ada belief baru atau yang bertentangan)

## Rekomendasi Saya
- (1-3 langkah konkret minggu depan)

Maks 250 kata. Jujur kalau data tipis — jangan dipaksa-paksakan.`;

  const { content } = await aiCall("reason", { prompt, temperature: 0.4, max_tokens: 800 });

  const wk = isoWeek(new Date());
  const path = `04-AEGIS-OUTPUTS/syntheses/${wk}.md`;
  const body = `---\ncreated: ${today.iso}\nweek: ${wk}\nsource: weekly_reflect\n---\n\n${content}\n`;
  await writeFile(path, body, `reflect: weekly synthesis ${wk}`);

  return { skipped: false, week: wk, path, snippet: content.slice(0, 500), counts: Object.fromEntries(Object.entries(recent).map(([k, v]) => [k, v.length])) };
};
