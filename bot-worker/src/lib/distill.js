// Distill — extract entitas dari catatan inbox, merge ke memory.

import { aiCall, safeJSON } from "./ai.js";
import { readJSON, writeJSON, writeFile, listFolder, readText, deleteFile } from "./store.js";
import { nowJakarta } from "./time.js";

const MEM = {
  owner: "07-SYSTEM/memory/owner.json",
  people: "07-SYSTEM/memory/people.json",
  projects: "07-SYSTEM/memory/projects.json",
  events: "07-SYSTEM/memory/events.json",
  decisions: "07-SYSTEM/memory/decisions.json",
  beliefs: "07-SYSTEM/memory/beliefs.json",
};

const norm = (s) => (s || "").toLowerCase().trim();
const sid = (prefix) => `${prefix}_${Math.random().toString(36).slice(2, 8)}`;
const extractBody = (md) => {
  const m = md.match(/^---[\s\S]*?---\s*([\s\S]*)$/);
  return (m ? m[1] : md).trim();
};

const extract = async (env, text) => {
  const today = nowJakarta();
  const prompt = `Ekstrak entitas dari catatan Hady. Hari ini: ${today.iso}.

Output STRICT JSON, tanpa code fence. Schema:
{
  "owner_profile": {"name": "...", "role": "...", "businesses": ["..."], "facts": ["..."]} atau null,
  "people": [{"name": "Nama lain", "role": "...", "context": "...", "notes": ["..."]}],
  "projects": [{"name": "...", "status": "aktif|jeda|selesai", "notes": ["..."]}],
  "events": [{"datetime_iso": "YYYY-MM-DDTHH:mm:ss+07:00", "event": "ringkas 3-8 kata", "involves": ["nama"], "project": "..."}],
  "decisions": [{"decision": "...", "reason": "..."}],
  "beliefs": [{"belief": "..."}]
}

Aturan:
- owner_profile: HANYA kalau pesan tentang Hady sendiri ("saya Hady...", "bisnis saya...").
- people: orang LAIN saja, bukan Hady.
- project: topik kerja besar.
- event: butuh tanggal/waktu eksplisit.
- decision: ada kata "saya pilih/putuskan/akan/mau".
- belief: pernyataan prinsip.
- Tanggal: "22 June" = 2026-06-22, "5 Agu" = 08-05.
- Tanpa entitas → array kosong [].

CONTOH:
Input: "Saya Hady, owner armada M44 (11 unit), M53 (11 unit), bajaj operasional, pemilik Aegis."
Output: {"owner_profile":{"name":"Hady","role":"owner armada","businesses":["M44","M53","bajaj","Aegis"],"facts":["M44 punya 11 unit","M53 punya 11 unit","bajaj untuk operasional"]},"people":[],"projects":[{"name":"M44","status":"aktif","notes":["11 unit"]},{"name":"M53","status":"aktif","notes":["11 unit"]},{"name":"bajaj","status":"aktif","notes":["operasional"]},{"name":"Aegis","status":"aktif","notes":[]}],"events":[],"decisions":[],"beliefs":[]}

Catatan: """${text}"""`;

  const { content } = await aiCall(env, "analyze", { prompt, temperature: 0.1, max_tokens: 800, json: true });
  const p = safeJSON(content, null);
  if (!p) return { owner_profile: null, people: [], projects: [], events: [], decisions: [], beliefs: [] };
  return {
    owner_profile: p.owner_profile && typeof p.owner_profile === "object" ? p.owner_profile : null,
    people: Array.isArray(p.people) ? p.people : [],
    projects: Array.isArray(p.projects) ? p.projects : [],
    events: Array.isArray(p.events) ? p.events : [],
    decisions: Array.isArray(p.decisions) ? p.decisions : [],
    beliefs: Array.isArray(p.beliefs) ? p.beliefs : [],
  };
};

const findOrCreate = (list, candidate, prefix, today) => {
  const cand = norm(candidate.name);
  const existing = list.find(x =>
    norm(x.name) === cand || (x.aliases || []).some(a => norm(a) === cand)
  );
  if (existing) { existing.last_mentioned = today; return existing; }
  const fresh = { id: sid(prefix), name: candidate.name, first_seen: today, last_mentioned: today, notes: [] };
  list.push(fresh);
  return fresh;
};

const mergeOwner = (doc, candidate, today) => {
  if (!candidate) return false;
  let changed = false;
  if (candidate.name && !doc.name) { doc.name = candidate.name; changed = true; }
  if (candidate.role && !doc.role) { doc.role = candidate.role; changed = true; }
  doc.businesses ||= [];
  doc.context_facts ||= [];
  if (Array.isArray(candidate.businesses)) {
    for (const b of candidate.businesses) {
      const n = (b || "").toLowerCase().trim();
      if (n && !doc.businesses.some(x => x.toLowerCase().trim() === n)) { doc.businesses.push(b); changed = true; }
    }
  }
  if (Array.isArray(candidate.facts)) {
    for (const f of candidate.facts) {
      if (f && !doc.context_facts.includes(f)) { doc.context_facts.push(f); changed = true; }
    }
  }
  if (changed) doc.last_updated = today;
  return changed;
};

const mergePerson = (list, p, today) => {
  const target = findOrCreate(list, p, "person", today);
  if (p.role && !target.role) target.role = p.role;
  if (p.context && !target.context) target.context = p.context;
  if (Array.isArray(p.notes)) for (const n of p.notes) {
    if (n && !target.notes.includes(n)) target.notes.push(n);
  }
};

const mergeProject = (list, p, today) => {
  const target = findOrCreate(list, p, "proj", today);
  if (p.status) target.status = p.status;
  if (Array.isArray(p.notes)) for (const n of p.notes) {
    if (n && !target.notes.includes(n)) target.notes.push(n);
  }
};

const mergeBelief = (list, b, today) => {
  const cand = norm(b.belief);
  if (!cand) return;
  if (list.some(x => norm(x.belief) === cand)) return;
  list.push({ id: sid("bel"), belief: b.belief, first_seen: today, status: "aktif" });
};

// Distill 1 teks langsung (real-time per pesan masuk)
export const distillText = async (env, text, sourceFile = "live") => {
  if (!text || text.trim().length < 3) return null;
  const ex = await extract(env, text).catch(e => { console.error("distillText:", e.message); return null; });
  if (!ex) return null;

  const owner = await readJSON(env, MEM.owner, { name: null, role: null, businesses: [], context_facts: [], last_updated: null });
  const people = await readJSON(env, MEM.people, { schema: "person", version: 1, people: [] });
  const projects = await readJSON(env, MEM.projects, { schema: "project", version: 1, projects: [] });
  const events = await readJSON(env, MEM.events, { schema: "event", version: 1, events: [] });
  const decisions = await readJSON(env, MEM.decisions, { schema: "decision", version: 1, decisions: [] });
  const beliefs = await readJSON(env, MEM.beliefs, { schema: "belief", version: 1, beliefs: [] });

  const { date: today } = nowJakarta();
  const totals = { owner: 0, people: 0, projects: 0, events: 0, decisions: 0, beliefs: 0 };

  if (mergeOwner(owner, ex.owner_profile, today)) totals.owner = 1;
  for (const p of ex.people) { mergePerson(people.people, p, today); totals.people++; }
  for (const p of ex.projects) { mergeProject(projects.projects, p, today); totals.projects++; }
  for (const e of ex.events) {
    if (!e.datetime_iso || !e.event) continue;
    events.events.push({ id: sid("ev"), datetime_iso: e.datetime_iso, event: e.event, involves: e.involves || [], project: e.project || null, status: "scheduled", source_file: sourceFile, recorded: today });
    totals.events++;
  }
  for (const d of ex.decisions) {
    if (!d.decision) continue;
    decisions.decisions.push({ id: sid("dec"), date: today, decision: d.decision, reason: d.reason || "", source_file: sourceFile });
    totals.decisions++;
  }
  for (const b of ex.beliefs) { mergeBelief(beliefs.beliefs, b, today); totals.beliefs++; }

  // Sequential writes (hindari SHA conflict)
  if (totals.owner) await writeJSON(env, MEM.owner, owner, "memory: owner update");
  if (totals.people) await writeJSON(env, MEM.people, people, `memory: people +${totals.people}`);
  if (totals.projects) await writeJSON(env, MEM.projects, projects, `memory: projects +${totals.projects}`);
  if (totals.events) await writeJSON(env, MEM.events, events, `memory: events +${totals.events}`);
  if (totals.decisions) await writeJSON(env, MEM.decisions, decisions, `memory: decisions +${totals.decisions}`);
  if (totals.beliefs) await writeJSON(env, MEM.beliefs, beliefs, `memory: beliefs +${totals.beliefs}`);

  return totals;
};

// Nightly distill: scan inbox, extract, archive
export const distill = async (env) => {
  const files = (await listFolder(env, "00-INBOX")).filter(f => f.name.endsWith(".md"));
  if (files.length === 0) return { processed: 0, totals: {}, archived: [] };

  const totals = { owner: 0, people: 0, projects: 0, events: 0, decisions: 0, beliefs: 0 };
  const archived = [];
  const { date: today } = nowJakarta();
  const ym = today.slice(0, 7);

  for (const f of files) {
    const content = await readText(env, `00-INBOX/${f.name}`);
    if (!content) continue;
    const body = extractBody(content);
    if (!body) continue;
    const t = await distillText(env, body, f.name);
    if (t) for (const k of Object.keys(totals)) totals[k] += t[k] || 0;
    // archive
    await writeFile(env, `06-ARCHIVE/inbox/${ym}/${f.name}`, content, `archive: ${f.name}`);
    await deleteFile(env, `00-INBOX/${f.name}`, `inbox: clean after distill ${f.name}`);
    archived.push(f.name);
  }
  return { processed: files.length, totals, archived };
};
