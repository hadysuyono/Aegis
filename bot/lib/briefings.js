// Morning Brief & Evening Recap — Aegis lapor proaktif tiap pagi & malam.

import { aiCall } from "./ai.js";
import { readJSON, listFolder, readText } from "./store.js";
import { listActive } from "./reminders.js";
import { nowJakarta, formatFriendly } from "./time.js";

const extractBody = (md) => {
  const m = md.match(/^---[\s\S]*?---\s*([\s\S]*)$/);
  return (m ? m[1] : md).trim();
};

const loadInboxNotes = async (limit = 50) => {
  const files = (await listFolder("00-INBOX")).filter(f => f.name.endsWith(".md"));
  const notes = [];
  for (const f of files.slice(-limit)) {
    const content = await readText(`00-INBOX/${f.name}`);
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

export const generateMorningBrief = async () => {
  const today = nowJakarta();
  const { start, end } = todayBounds();

  const [owner, projects, events, decisions, beliefs, reminders, notes] = await Promise.all([
    readJSON("07-SYSTEM/memory/owner.json", {}),
    readJSON("07-SYSTEM/memory/projects.json", { projects: [] }),
    readJSON("07-SYSTEM/memory/events.json", { events: [] }),
    readJSON("07-SYSTEM/memory/decisions.json", { decisions: [] }),
    readJSON("07-SYSTEM/memory/beliefs.json", { beliefs: [] }),
    listActive(),
    loadInboxNotes(15),
  ]);

  const todayReminders = reminders
    .filter(r => r.datetime_iso >= start && r.datetime_iso <= end)
    .sort((a, b) => a.datetime_iso.localeCompare(b.datetime_iso))
    .map(r => `${r.event} — ${formatFriendly(r.datetime_iso)}`);

  const todayEvents = (events.events || [])
    .filter(e => e.datetime_iso >= start && e.datetime_iso <= end)
    .map(e => `${e.event} — ${formatFriendly(e.datetime_iso)}`);

  const recentDecisions = (decisions.decisions || []).slice(-5).map(d => `${d.decision} (${d.reason})`);

  const prompt = `Kamu Aegis — asisten pribadi Pak Hady. Hari ini ${today.iso}.

Tugas: tulis MORNING BRIEF untuk Pak Hady. Ringkas, tajam, gaya senior advisor.

Konteks yang Bapak miliki:
- Profil: ${JSON.stringify(owner)}
- Project aktif: ${(projects.projects || []).filter(p => p.status === "aktif").slice(0, 8).map(p => p.name).join(", ") || "(belum ada)"}
- Jadwal hari ini: ${[...todayReminders, ...todayEvents].join(" | ") || "(kosong)"}
- Decision terakhir Bapak: ${recentDecisions.join(" • ") || "(tidak ada)"}
- Catatan inbox terbaru: ${notes.slice(-5).map(n => n.body.slice(0, 100)).join(" | ") || "(kosong)"}

Format Markdown, 4 section max, total 200 kata:
## 🌅 Pagi, Pak Hady
(satu kalimat sapaan + tema hari)

## 🎯 The One Thing
(satu hal paling penting hari ini, kalau ada)

## 📅 Hari Ini
(jadwal & komitmen — kalau kosong, bilang santai)

## ⚠️ Yang Perlu Perhatian
(open loops, decision pending, belief yang bertentangan; kalau gak ada, skip section)

Jangan ucapkan "berikut adalah" — langsung mulai.`;

  const { content } = await aiCall("reason", { prompt, temperature: 0.3, max_tokens: 600 });
  return content || "🌅 Pagi Pak Hady, hari ini saya belum bisa rangkai brief.";
};

export const generateEveningRecap = async () => {
  const today = nowJakarta();
  const { start, end } = todayBounds();

  const [decisions, reminders, notes] = await Promise.all([
    readJSON("07-SYSTEM/memory/decisions.json", { decisions: [] }),
    listActive(),
    loadInboxNotes(30),
  ]);

  const todayDecisions = (decisions.decisions || []).filter(d => d.date === today.date);
  const upcomingReminders = reminders.filter(r => r.datetime_iso >= end).slice(0, 5);
  const todayNotes = notes.filter(n => n.file.startsWith(today.date));

  const prompt = `Kamu Aegis — asisten Pak Hady. Sekarang malam ${today.iso}.

Tugas: tulis EVENING RECAP. Refleksi hari ini + persiapan besok.

Konteks:
- Catatan masuk hari ini: ${todayNotes.length} item — ${todayNotes.slice(0, 8).map(n => n.body.slice(0, 80)).join(" | ") || "(tidak ada)"}
- Decision Bapak hari ini: ${todayDecisions.map(d => d.decision).join(" • ") || "(tidak ada)"}
- Reminder berikutnya: ${upcomingReminders.map(r => `${r.event} — ${formatFriendly(r.datetime_iso)}`).join(" | ") || "(kosong)"}

Format Markdown, total 150 kata max:
## 🌙 Malam, Pak Hady
(sapaan + tema hari)

## ✅ Yang Berhasil Hari Ini
(2-3 hal nyata)

## 🤔 Yang Belum Selesai
(open loops kalau ada; kalau gak ada, skip)

## 🌅 Persiapan Besok
(1-2 hal yang sebaiknya Bapak siapkan)

Jujur, jangan dipaksa-paksakan kalau data tipis.`;

  const { content } = await aiCall("reason", { prompt, temperature: 0.4, max_tokens: 500 });
  return content || "🌙 Malam Pak Hady, hari ini saya belum bisa rangkai recap.";
};
