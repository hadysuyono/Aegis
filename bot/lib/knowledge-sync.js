// Knowledge sync — generate 01-KNOWLEDGE/*.md dari memory JSON.
// Tiap malam regenerate, biar Hady bisa baca di Obsidian + graph view aktif (wikilinks).

import { readJSON, writeFile } from "./store.js";
import { nowJakarta, formatFriendly } from "./time.js";

const fm = (data) => `---\n${Object.entries(data).map(([k, v]) => `${k}: ${v}`).join("\n")}\n---\n\n`;

const renderOwner = (owner) => {
  if (!owner?.name) return null;
  return fm({ updated: nowJakarta().iso, source: "memory/owner.json", type: "profile" }) +
`# Profile

**Nama:** ${owner.name}
**Role:** ${owner.role || "-"}
**Bisnis:** ${(owner.businesses || []).map(b => `[[${b}]]`).join(", ") || "-"}

## Facts
${(owner.context_facts || []).map(f => `- ${f}`).join("\n") || "- (belum ada)"}
`;
};

const renderPeople = (peopleDoc) => {
  const items = peopleDoc.people || [];
  let body = fm({ updated: nowJakarta().iso, source: "memory/people.json", type: "people", count: items.length }) +
    `# People (${items.length})\n\n`;
  if (items.length === 0) return body + "_(belum ada orang yg tercatat)_\n";
  for (const p of items) {
    body += `## [[${p.name}]]\n`;
    if (p.role) body += `- **Role:** ${p.role}\n`;
    if (p.context) body += `- **Konteks:** ${p.context}\n`;
    body += `- **First seen:** ${p.first_seen || "?"} • **Last:** ${p.last_mentioned || "?"}\n`;
    if (p.notes?.length) body += p.notes.map(n => `- ${n}`).join("\n") + "\n";
    body += "\n";
  }
  return body;
};

const renderProjects = (projDoc) => {
  const items = projDoc.projects || [];
  let body = fm({ updated: nowJakarta().iso, source: "memory/projects.json", type: "projects", count: items.length }) +
    `# Projects (${items.length})\n\n`;
  if (items.length === 0) return body + "_(belum ada project)_\n";
  for (const p of items) {
    body += `## [[${p.name}]] ${p.status === "aktif" ? "🟢" : p.status === "selesai" ? "✅" : "⏸"} ${p.status}\n`;
    body += `- **First seen:** ${p.first_seen} • **Last:** ${p.last_mentioned}\n`;
    if (p.notes?.length) body += p.notes.map(n => `- ${n}`).join("\n") + "\n";
    body += "\n";
  }
  return body;
};

const renderEvents = (eventsDoc) => {
  const items = (eventsDoc.events || []).sort((a, b) => b.datetime_iso.localeCompare(a.datetime_iso));
  let body = fm({ updated: nowJakarta().iso, source: "memory/events.json", type: "events", count: items.length }) +
    `# Events (${items.length})\n\n`;
  if (items.length === 0) return body + "_(belum ada event)_\n";
  for (const e of items.slice(0, 50)) {
    body += `## ${e.event}\n`;
    body += `- **Kapan:** ${formatFriendly(e.datetime_iso)}\n`;
    if (e.project) body += `- **Project:** [[${e.project}]]\n`;
    if (e.involves?.length) body += `- **Orang:** ${e.involves.map(n => `[[${n}]]`).join(", ")}\n`;
    body += `- **Status:** ${e.status || "scheduled"}\n\n`;
  }
  return body;
};

const renderDecisions = (decDoc) => {
  const items = (decDoc.decisions || []).slice().reverse();
  let body = fm({ updated: nowJakarta().iso, source: "memory/decisions.json", type: "decisions", count: items.length }) +
    `# Decisions (${items.length})\n\n`;
  if (items.length === 0) return body + "_(belum ada decision)_\n";
  for (const d of items.slice(0, 50)) {
    body += `## ${d.decision}\n`;
    body += `- **Tanggal:** ${d.date}\n`;
    if (d.reason) body += `- **Alasan:** ${d.reason}\n`;
    body += "\n";
  }
  return body;
};

const renderBeliefs = (belDoc) => {
  const items = belDoc.beliefs || [];
  let body = fm({ updated: nowJakarta().iso, source: "memory/beliefs.json", type: "beliefs", count: items.length }) +
    `# Beliefs (${items.length})\n\n`;
  if (items.length === 0) return body + "_(belum ada belief tercatat)_\n";
  for (const b of items) {
    body += `## ${b.belief}\n`;
    body += `- **First seen:** ${b.first_seen} • **Status:** ${b.status || "aktif"}\n\n`;
  }
  return body;
};

export const syncKnowledge = async () => {
  const [owner, people, projects, events, decisions, beliefs] = await Promise.all([
    readJSON("07-SYSTEM/memory/owner.json", null),
    readJSON("07-SYSTEM/memory/people.json", { people: [] }),
    readJSON("07-SYSTEM/memory/projects.json", { projects: [] }),
    readJSON("07-SYSTEM/memory/events.json", { events: [] }),
    readJSON("07-SYSTEM/memory/decisions.json", { decisions: [] }),
    readJSON("07-SYSTEM/memory/beliefs.json", { beliefs: [] }),
  ]);

  const writes = [];
  const ownerMd = renderOwner(owner);
  if (ownerMd) writes.push(writeFile("01-KNOWLEDGE/profile.md", ownerMd, "knowledge: sync profile"));
  writes.push(writeFile("01-KNOWLEDGE/people.md", renderPeople(people), "knowledge: sync people"));
  writes.push(writeFile("01-KNOWLEDGE/projects.md", renderProjects(projects), "knowledge: sync projects"));
  writes.push(writeFile("01-KNOWLEDGE/events.md", renderEvents(events), "knowledge: sync events"));
  writes.push(writeFile("01-KNOWLEDGE/decisions.md", renderDecisions(decisions), "knowledge: sync decisions"));
  writes.push(writeFile("01-KNOWLEDGE/beliefs.md", renderBeliefs(beliefs), "knowledge: sync beliefs"));

  for (const w of writes) await w; // sequential biar tidak SHA conflict

  return { files: 6 };
};
