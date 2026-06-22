// Morning Brief & Evening Recap (Workers).

import { aiCall } from "./ai.js";
import { readJSON, listFolder, readText } from "./store.js";
import { listActive } from "./reminders.js";
import { nowJakarta, formatFriendly } from "./time.js";

const extractBody = (md) => {
  const m = md.match(/^---[\s\S]*?---\s*([\s\S]*)$/);
  return (m ? m[1] : md).trim();
};

const loadInboxNotes = async (env, limit = 20) => {
  const files = (await listFolder(env, "00-INBOX")).filter(f => f.name.endsWith(".md"));
  const notes = [];
  for (const f of files.slice(-limit)) {
    const content = await readText(env, `00-INBOX/${f.name}`);
    if (content) notes.push({ file: f.name, body: extractBody(content) });
  }
  return notes;
};

const todayBounds = () => {
  const n = nowJakarta();
  const [y, m, d] = n.date.split("-").map(Number);
  const startUtc = new Date(Date.UTC(y, m - 1, d, -7, 0)).toISOString();
  const endUtc = new Date(Date.UTC(y, m - 1, d, 16, 59)).toISOString();
  return { start: startUtc, end: endUtc, date: n.date };
};

export const generateMorningBrief = async (env) => {
  const today = nowJakarta();
  const { start, end } = todayBounds();
  const [owner, projects, events, decisions, reminders, notes] = await Promise.all([
    readJSON(env, "07-SYSTEM/memory/owner.json", {}),
    readJSON(env, "07-SYSTEM/memory/projects.json", { projects: [] }),
    readJSON(env, "07-SYSTEM/memory/events.json", { events: [] }),
    readJSON(env, "07-SYSTEM/memory/decisions.json", { decisions: [] }),
    listActive(env),
    loadInboxNotes(env, 10),
  ]);

  const todayReminders = reminders.filter(r => r.datetime_iso >= start && r.datetime_iso <= end)
    .sort((a, b) => a.datetime_iso.localeCompare(b.datetime_iso))
    .map(r => `${r.event} — ${formatFriendly(r.datetime_iso)}`);
  const todayEvents = (events.events || []).filter(e => e.datetime_iso >= start && e.datetime_iso <= end)
    .map(e => `${e.event} — ${formatFriendly(e.datetime_iso)}`);
  const recentDecisions = (decisions.decisions || []).slice(-5).map(d => `${d.decision}`);

  const prompt = `Kamu Aegis. Hari ini ${today.iso}. Tulis MORNING BRIEF singkat untuk Pak Hady (gaya senior advisor).

Profil: ${JSON.stringify(owner)}
Project aktif: ${(projects.projects || []).filter(p => p.status === "aktif").slice(0, 8).map(p => p.name).join(", ") || "(belum ada)"}
Jadwal hari ini: ${[...todayReminders, ...todayEvents].join(" | ") || "(kosong)"}
Decision terakhir: ${recentDecisions.join(" • ") || "(tidak ada)"}
Catatan terbaru: ${notes.slice(-5).map(n => n.body.slice(0, 80)).join(" | ") || "(kosong)"}

Format Markdown, total 200 kata max:
## 🌅 Pagi, Pak Hady
(satu kalimat sapaan + tema hari)

## 🎯 The One Thing
(satu hal paling penting hari ini)

## 📅 Hari Ini
(jadwal & komitmen)

## ⚠️ Perlu Perhatian
(open loops, decision pending — skip kalau gak ada)

Langsung mulai, jangan "Berikut adalah".`;

  const { content } = await aiCall(env, "reason", { prompt, temperature: 0.3, max_tokens: 600 });
  return content || "🌅 Pagi Pak Hady, belum bisa rangkai brief.";
};

export const generateEveningRecap = async (env) => {
  const today = nowJakarta();
  const { start, end } = todayBounds();
  const [decisions, reminders, notes] = await Promise.all([
    readJSON(env, "07-SYSTEM/memory/decisions.json", { decisions: [] }),
    listActive(env),
    loadInboxNotes(env, 30),
  ]);

  const todayDecisions = (decisions.decisions || []).filter(d => d.date === today.date);
  const upcomingReminders = reminders.filter(r => r.datetime_iso >= end).slice(0, 5);
  const todayNotes = notes.filter(n => n.file.startsWith(today.date));

  const prompt = `Kamu Aegis. Malam ${today.iso}. Tulis EVENING RECAP.

Catatan hari ini (${todayNotes.length}): ${todayNotes.slice(0, 8).map(n => n.body.slice(0, 80)).join(" | ") || "(tidak ada)"}
Decision hari ini: ${todayDecisions.map(d => d.decision).join(" • ") || "(tidak ada)"}
Reminder berikutnya: ${upcomingReminders.map(r => `${r.event} — ${formatFriendly(r.datetime_iso)}`).join(" | ") || "(kosong)"}

Format Markdown, 150 kata max:
## 🌙 Malam, Pak Hady
(sapaan + tema)

## ✅ Yang Berhasil
(2-3 hal)

## 🤔 Yang Belum Selesai
(open loops — skip kalau gak ada)

## 🌅 Persiapan Besok
(1-2 hal)

Jujur kalau data tipis.`;

  const { content } = await aiCall(env, "reason", { prompt, temperature: 0.4, max_tokens: 500 });
  return content || "🌙 Malam Pak Hady, belum bisa rangkai recap.";
};
