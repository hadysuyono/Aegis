// Anomaly detector — scan memory cari pola aneh, lapor proaktif.

import { aiCall } from "./ai.js";
import { readJSON } from "./store.js";
import { listActive } from "./reminders.js";
import { nowJakarta } from "./time.js";

const daysBetween = (a, b) => Math.floor((new Date(b) - new Date(a)) / 86400_000);

export const detectAnomalies = async (env) => {
  const today = nowJakarta();
  const [projects, decisions, beliefs, reminders] = await Promise.all([
    readJSON(env, "07-SYSTEM/memory/projects.json", { projects: [] }),
    readJSON(env, "07-SYSTEM/memory/decisions.json", { decisions: [] }),
    readJSON(env, "07-SYSTEM/memory/beliefs.json", { beliefs: [] }),
    listActive(env),
  ]);

  const flags = [];
  for (const p of (projects.projects || []).filter(x => x.status === "aktif")) {
    if (p.last_mentioned && daysBetween(p.last_mentioned, today.date) > 21) {
      flags.push(`Project "${p.name}" tidak disebut sejak ${p.last_mentioned} (${daysBetween(p.last_mentioned, today.date)} hari)`);
    }
  }
  for (const b of (beliefs.beliefs || []).filter(x => x.status === "aktif")) {
    if (b.first_seen && daysBetween(b.first_seen, today.date) > 60) {
      flags.push(`Belief "${b.belief.slice(0, 60)}" sudah ${daysBetween(b.first_seen, today.date)} hari, belum di-review`);
    }
  }
  const past = reminders.filter(r => new Date(r.datetime_iso) < new Date(Date.now() - 2 * 86400_000));
  if (past.length > 0) flags.push(`${past.length} reminder lewat tapi belum di-mark — cek apa benar2 selesai`);
  const last7 = (decisions.decisions || []).filter(d => daysBetween(d.date, today.date) <= 7);
  if (last7.length >= 5) flags.push(`${last7.length} keputusan dalam 7 hari — pace tinggi`);

  if (flags.length === 0) return { hasAnomaly: false, message: null };

  const prompt = `Kamu Aegis. Ditemukan anomali di memori Pak Hady. Tulis pesan singkat (max 4 kalimat) gaya senior advisor — tenang, jujur.

Anomali:
${flags.map((f, i) => `${i + 1}. ${f}`).join("\n")}

Format: mulai "🔍 Saya spot beberapa hal:", lalu list singkat, akhiri saran tindakan 1 kalimat.`;

  try {
    const { content } = await aiCall(env, "reason", { prompt, temperature: 0.3, max_tokens: 400 });
    return { hasAnomaly: true, count: flags.length, message: content || `🔍 Anomali:\n${flags.join("\n")}` };
  } catch {
    return { hasAnomaly: true, count: flags.length, message: `🔍 Anomali:\n${flags.join("\n")}` };
  }
};
