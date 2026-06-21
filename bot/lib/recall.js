// Layer 3 — Recall: jawab pertanyaan pakai memory terstruktur, bukan raw inbox.

import { readJSON } from "./store.js";
import { aiCall } from "./ai.js";
import { listActive } from "./reminders.js";
import { nowJakarta, formatFriendly } from "./time.js";

const MEM = {
  owner: "07-SYSTEM/memory/owner.json",
  people: "07-SYSTEM/memory/people.json",
  projects: "07-SYSTEM/memory/projects.json",
  events: "07-SYSTEM/memory/events.json",
  decisions: "07-SYSTEM/memory/decisions.json",
  beliefs: "07-SYSTEM/memory/beliefs.json",
};

// Filter naive — keyword match (ringan, hemat token)
const matchAny = (haystack, needles) =>
  needles.some(n => haystack.toLowerCase().includes(n.toLowerCase()));

const filterByKeywords = (items, keywords, fields) => {
  if (!keywords || keywords.length === 0) return items.slice(0, 20); // cap default
  return items.filter(it => {
    const text = fields.map(f => JSON.stringify(it[f] || "")).join(" ");
    return matchAny(text, keywords);
  }).slice(0, 20);
};

const tokenize = (q) => (q || "")
  .toLowerCase()
  .replace(/[^a-z0-9\s]/g, " ")
  .split(/\s+/)
  .filter(w => w.length >= 3 && !["dan", "yang", "apa", "saya", "ada", "ini", "itu", "kah"].includes(w));

export const answerCatatan = async (question) => {
  const today = nowJakarta();

  const [ownerDoc, peopleDoc, projDoc, eventDoc, decDoc, belDoc, reminders] = await Promise.all([
    readJSON(MEM.owner, { name: null, role: null, businesses: [], context_facts: [] }),
    readJSON(MEM.people, { people: [] }),
    readJSON(MEM.projects, { projects: [] }),
    readJSON(MEM.events, { events: [] }),
    readJSON(MEM.decisions, { decisions: [] }),
    readJSON(MEM.beliefs, { beliefs: [] }),
    listActive(),
  ]);

  const keywords = tokenize(question);

  const ctx = {
    profil_hady: {
      name: ownerDoc.name, role: ownerDoc.role,
      businesses: ownerDoc.businesses || [], facts: ownerDoc.context_facts || [],
    },
    people: filterByKeywords(peopleDoc.people, keywords, ["name", "role", "context", "notes", "aliases"]),
    projects: filterByKeywords(projDoc.projects, keywords, ["name", "notes", "status"]),
    events: filterByKeywords(eventDoc.events, keywords, ["event", "involves", "project"]),
    decisions: filterByKeywords(decDoc.decisions, keywords, ["decision", "reason"]),
    beliefs: filterByKeywords(belDoc.beliefs, keywords, ["belief"]),
    reminders_aktif: reminders.slice(0, 10).map(r => ({
      event: r.event, kapan: formatFriendly(r.datetime_iso),
    })),
  };

  const hasProfil = ctx.profil_hady.name || (ctx.profil_hady.businesses || []).length > 0 || (ctx.profil_hady.facts || []).length > 0;
  const hasOther = ["people","projects","events","decisions","beliefs","reminders_aktif"]
    .some(k => Array.isArray(ctx[k]) && ctx[k].length > 0);
  const isEmpty = !hasProfil && !hasOther;

  const prompt = `Kamu Aegis — asisten pribadi Hady. Hari ini ${today.iso}.

Hady bertanya: "${question}"

Memori internal Aegis (hasil distill catatan Hady):
${JSON.stringify(ctx, null, 2)}

${isEmpty ? "MEMORI INTERNAL KOSONG untuk pertanyaan ini." : ""}

Tugas:
- Jawab langsung dalam Bahasa Indonesia santai-sopan, panggil "Pak".
- Prioritas: pakai memori internal di atas KALAU relevan dengan pertanyaan.
- KALAU pertanyaan tentang FAKTA UMUM/dunia luar (berita, harga, cuaca, info publik) yang tidak ada di memori, kamu BOLEH gunakan kemampuan web search internalmu untuk jawab.
- KALAU pertanyaan tentang URUSAN PRIBADI Hady tapi memori kosong → jujur bilang belum ada catatan dan saran apa yang bisa dicatat.
- JANGAN mengarang fakta pribadi tentang Hady.
- Maks 4 kalimat, 1 emoji.`;

  const { content } = await aiCall("senior", { prompt, temperature: 0.3, max_tokens: 400 });
  return content || "Maaf Pak, ada masalah saat menjawab.";
};
