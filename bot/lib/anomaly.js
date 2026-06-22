// Anomaly detector — scan memory cari pola aneh: belief contradicting, project mandek,
// decision pending lama, reminder yang terus di-snooze. Lapor ke Hady proaktif.

import { aiCall } from "./ai.js";
import { readJSON } from "./store.js";
import { listActive } from "./reminders.js";
import { nowJakarta } from "./time.js";

const daysBetween = (a, b) => Math.floor((new Date(b) - new Date(a)) / 86400_000);

export const detectAnomalies = async () => {
  const today = nowJakarta();
  const [projects, decisions, beliefs, reminders] = await Promise.all([
    readJSON("07-SYSTEM/memory/projects.json", { projects: [] }),
    readJSON("07-SYSTEM/memory/decisions.json", { decisions: [] }),
    readJSON("07-SYSTEM/memory/beliefs.json", { beliefs: [] }),
    listActive(),
  ]);

  // Heuristic scan
  const flags = [];

  // Project aktif tapi tidak disebut > 21 hari
  for (const p of (projects.projects || []).filter(x => x.status === "aktif")) {
    if (p.last_mentioned && daysBetween(p.last_mentioned, today.date) > 21) {
      flags.push(`Project "${p.name}" tidak disebut sejak ${p.last_mentioned} (${daysBetween(p.last_mentioned, today.date)} hari)`);
    }
  }

  // Belief lebih dari 60 hari, tidak pernah confirm ulang
  for (const b of (beliefs.beliefs || []).filter(x => x.status === "aktif")) {
    if (b.first_seen && daysBetween(b.first_seen, today.date) > 60) {
      flags.push(`Belief "${b.belief.slice(0, 60)}" sudah ${daysBetween(b.first_seen, today.date)} hari, belum di-review`);
    }
  }

  // Reminder masa lalu yang masih aktif (terlewat?)
  const past = reminders.filter(r => new Date(r.datetime_iso) < new Date() - 2 * 86400_000);
  if (past.length > 0) {
    flags.push(`${past.length} reminder lewat tapi belum di-mark — cek apa benar2 selesai`);
  }

  // Decision banyak hari ini (lebih dari 5 dalam 7 hari → mungkin Bapak overload)
  const last7days = (decisions.decisions || []).filter(d => daysBetween(d.date, today.date) <= 7);
  if (last7days.length >= 5) {
    flags.push(`${last7days.length} keputusan dalam 7 hari — pace agak tinggi, mungkin perlu rest`);
  }

  if (flags.length === 0) return { hasAnomaly: false, message: null };

  // Compose final message via senior (natural)
  const prompt = `Kamu Aegis. Ditemukan anomali di memori Pak Hady. Susun pesan singkat (max 4 kalimat) ke Pak Hady dengan gaya senior advisor — tenang, jujur, tidak alarmist.

Anomali:
${flags.map((f, i) => `${i + 1}. ${f}`).join("\n")}

Format: mulai dengan "🔍 Saya spot beberapa hal:". Lalu list singkat. Akhiri dengan saran tindakan 1 kalimat.`;

  try {
    const { content } = await aiCall("reason", { prompt, temperature: 0.3, max_tokens: 400 });
    return { hasAnomaly: true, count: flags.length, message: content || flags.join("\n") };
  } catch {
    return { hasAnomaly: true, count: flags.length, message: `🔍 Anomali:\n${flags.join("\n")}` };
  }
};
