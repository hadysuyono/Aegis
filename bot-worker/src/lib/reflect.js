// Weekly reflect — refleksi mingguan.

import { aiCall } from "./ai.js";
import { readJSON, writeFile } from "./store.js";
import { nowJakarta } from "./time.js";

const isoWeek = (date) => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const wk = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(wk).padStart(2, "0")}`;
};

const inLastWeek = (items, dateField) => {
  const cutoff = Date.now() - 7 * 86400_000;
  return items.filter(it => {
    const v = it[dateField];
    if (!v) return false;
    const t = new Date(v).getTime();
    return !isNaN(t) && t >= cutoff;
  });
};

export const weeklyReflect = async (env) => {
  const [people, projects, events, decisions, beliefs] = await Promise.all([
    readJSON(env, "07-SYSTEM/memory/people.json", { people: [] }),
    readJSON(env, "07-SYSTEM/memory/projects.json", { projects: [] }),
    readJSON(env, "07-SYSTEM/memory/events.json", { events: [] }),
    readJSON(env, "07-SYSTEM/memory/decisions.json", { decisions: [] }),
    readJSON(env, "07-SYSTEM/memory/beliefs.json", { beliefs: [] }),
  ]);

  const recent = {
    people_baru: inLastWeek(people.people, "first_seen"),
    project_aktif: projects.projects.filter(p => p.status === "aktif").slice(0, 10),
    event_minggu_ini: inLastWeek(events.events, "datetime_iso"),
    decision_minggu_ini: inLastWeek(decisions.decisions, "date"),
    belief_baru: inLastWeek(beliefs.beliefs, "first_seen"),
  };

  const total = Object.values(recent).reduce((a, arr) => a + arr.length, 0);
  if (total === 0) return { skipped: true, reason: "Tidak ada aktivitas baru minggu ini." };

  const today = nowJakarta();
  const prompt = `Kamu Aegis. Hari ini ${today.iso}. Ringkasan aktivitas Pak Hady 7 hari terakhir:
${JSON.stringify(recent, null, 2)}

Tulis Weekly Reflection (Markdown, bahasa Indonesia, sapaan "Pak Hady"), 250 kata max:
## Minggu Ini Dalam 1 Kalimat
## Yang Maju
## Yang Stagnan / Perlu Perhatian
## Pola yang Saya Lihat
## Belief Baru / Berubah (skip kalau gak ada)
## Rekomendasi Saya

Singkat, tajam, tidak bertele-tele.`;

  const { content } = await aiCall(env, "reason", { prompt, temperature: 0.4, max_tokens: 800 });
  const wk = isoWeek(new Date());
  const path = `04-AEGIS-OUTPUTS/syntheses/${wk}.md`;
  const body = `---\ncreated: ${today.iso}\nweek: ${wk}\nsource: weekly_reflect\n---\n\n${content}\n`;
  await writeFile(env, path, body, `reflect: weekly synthesis ${wk}`);
  return { skipped: false, week: wk, path, snippet: content.slice(0, 500) };
};
