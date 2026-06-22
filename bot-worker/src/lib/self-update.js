// Self-update: saran update CLAUDE.md + feedback digest.

import { aiCall } from "./ai.js";
import { readJSON, readText, writeFile } from "./store.js";
import { nowJakarta } from "./time.js";

export const generateClaudeMdSuggestion = async (env) => {
  const today = nowJakarta();
  const [feedbackDoc, ownerDoc, projDoc, belDoc, decDoc, currentClaude] = await Promise.all([
    readJSON(env, "07-SYSTEM/feedback.json", { items: [] }),
    readJSON(env, "07-SYSTEM/memory/owner.json", {}),
    readJSON(env, "07-SYSTEM/memory/projects.json", { projects: [] }),
    readJSON(env, "07-SYSTEM/memory/beliefs.json", { beliefs: [] }),
    readJSON(env, "07-SYSTEM/memory/decisions.json", { decisions: [] }),
    readText(env, "CLAUDE.md"),
  ]);

  const tally = { up: 0, down: 0, bySource: {} };
  for (const f of feedbackDoc.items || []) {
    tally[f.rating]++;
    tally.bySource[f.source] ||= { up: 0, down: 0 };
    tally.bySource[f.source][f.rating]++;
  }

  const prompt = `Kamu Aegis. Review CLAUDE.md Pak Hady & saran update ringkas.

CLAUDE.md (excerpt 1000 char):
"""${(currentClaude || "(belum ada)").slice(0, 1000)}"""

Data Pak Hady:
Profil: ${JSON.stringify(ownerDoc)}
${(projDoc.projects || []).filter(p => p.status === "aktif").length} project aktif
${(belDoc.beliefs || []).length} belief • ${(decDoc.decisions || []).length} decision

Feedback: 👍 ${tally.up} • 👎 ${tally.down}
${Object.entries(tally.bySource).map(([s, c]) => `  ${s}: 👍${c.up}/👎${c.down}`).join("\n")}

Tugas Markdown (300 kata max):
## 📝 Update Saran CLAUDE.md
### Yang Bagus
### Yang Perlu Tambah
### Yang Perlu Revisi
### Patch yang Saya Saran

Jujur, jangan dipaksa.`;

  const { content } = await aiCall(env, "reason", { prompt, temperature: 0.3, max_tokens: 700 });
  const path = `04-AEGIS-OUTPUTS/self-tuning/${today.date}-claude-md-suggestion.md`;
  const body = `---\ncreated: ${today.iso}\nsource: self_update\n---\n\n${content}\n`;
  await writeFile(env, path, body, `self-tuning: claude.md ${today.date}`);
  return { path, snippet: content.slice(0, 400) };
};

export const generateFeedbackDigest = async (env) => {
  const today = nowJakarta();
  const feedbackDoc = await readJSON(env, "07-SYSTEM/feedback.json", { items: [] });
  const items = feedbackDoc.items || [];
  if (items.length === 0) return { skipped: true };

  const recent = items.slice(-50);
  const bySource = {};
  for (const f of recent) {
    bySource[f.source] ||= { up: 0, down: 0 };
    bySource[f.source][f.rating]++;
  }
  const problematic = Object.entries(bySource).filter(([_, c]) => c.down > c.up).map(([s, c]) => `${s}: 👎${c.down} > 👍${c.up}`);

  const prompt = `Kamu Aegis. Analisis feedback Pak Hady (50 terakhir):
${Object.entries(bySource).map(([s, c]) => `- ${s}: 👍${c.up} | 👎${c.down}`).join("\n")}

Problematik:
${problematic.join("\n") || "(tidak ada)"}

Tugas (300 kata Markdown):
## 📊 Feedback Digest
### Pola
### Sumber Bermasalah
### Saran Tuning Prompt

Jujur dan to-the-point.`;

  const { content } = await aiCall(env, "reason", { prompt, temperature: 0.3, max_tokens: 500 });
  const path = `04-AEGIS-OUTPUTS/self-tuning/${today.date}-feedback-digest.md`;
  const body = `---\ncreated: ${today.iso}\nsource: feedback_digest\n---\n\n${content}\n`;
  await writeFile(env, path, body, `self-tuning: feedback digest ${today.date}`);
  return { skipped: false, path, snippet: content.slice(0, 400) };
};
